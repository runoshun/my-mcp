import { ToolModule } from "./tool-interface.ts";
import { expandGlob } from "https://deno.land/std@0.224.0/fs/expand_glob.ts";
import { join, dirname } from "https://deno.land/std@0.224.0/path/mod.ts";

const DOCS_DIRS = ["docs", "doc"];
const DOCS_FILES = ["index.html", "index.md"];

interface PackageDocumentation {
  name: string;
  path: string;
  docPath: string;
  type: "field" | "docs" | "readme";
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

async function findDocumentation(
  packagePath: string,
): Promise<Omit<PackageDocumentation, "name"> | null> {
  // 1. Check package.json for a "doc_path" field
  const packageJsonPath = join(packagePath, "package.json");
  if (await fileExists(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(await Deno.readTextFile(packageJsonPath));
      if (packageJson.doc_path) {
        const docPath = join(packagePath, packageJson.doc_path);
        if (await fileExists(docPath)) {
          return { path: packagePath, docPath, type: "field" };
        }
      }
    } catch (e) {
      console.error(`Error reading or parsing ${packageJsonPath}: ${e.message}`);
    }
  }

  // 2. Check for a "docs" directory
  for (const dir of DOCS_DIRS) {
    const docsPath = join(packagePath, dir);
    if (await fileExists(docsPath)) {
      for (const file of DOCS_FILES) {
        const docFilePath = join(docsPath, file);
        if (await fileExists(docFilePath)) {
          return { path: packagePath, docPath: docFilePath, type: "docs" };
        }
      }
      // If no index, look for any .md or .html
      for await (const entry of Deno.readDir(docsPath)) {
        if (entry.isFile && (entry.name.endsWith(".md") || entry.name.endsWith(".html"))) {
          const docFilePath = join(docsPath, entry.name);
          return { path: packagePath, docPath: docFilePath, type: "docs" };
        }
      }
    }
  }


  // 3. Fallback to README.md
  const readmePath = join(packagePath, "README.md");
  if (await fileExists(readmePath)) {
    return { path: packagePath, docPath: readmePath, type: "readme" };
  }

  return null;
}

export async function findPackagesWithDocs(
  rootPath: string,
  globPattern = "*",
): Promise<PackageDocumentation[]> {
  const packages: PackageDocumentation[] = [];
  const packageJsonPattern = join(
    rootPath,
    "node_modules",
    globPattern,
    "package.json",
  );

  for await (const entry of expandGlob(packageJsonPattern)) {
    if (!entry.isFile) continue;
    const packagePath = dirname(entry.path);
    const packageJson = JSON.parse(await Deno.readTextFile(entry.path));
    const packageName = packageJson.name;

    const docInfo = await findDocumentation(packagePath);
    if (docInfo) {
      packages.push({
        name: packageName,
        ...docInfo,
      });
    }
  }

  return packages;
}

export const documentAvailablePackagesTool: ToolModule = {
  getToolDefinition: () => ({
    tool: {
      name: "document_available_packages",
      description: "Finds documentation for packages in a node_modules directory.",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The root path of the project to inspect. Defaults to the current directory.",
          },
          glob: {
            type: "string",
            description: "A glob pattern to filter packages. Defaults to '*'.",
          },
        },
        required: [],
      },
    },
    execute: async (args) => {
      const { path = ".", glob = "*" } = args as { path?: string; glob?: string };

      try {
        const packages = await findPackagesWithDocs(path, glob);
        const packageNames = packages.map((p) => ({
          name: p.name,
          type: p.type,
          docPath: p.docPath
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(packageNames, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error finding packages: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    },
  }),
};

export const documentReadTool: ToolModule = {
  getToolDefinition: () => ({
    tool: {
      name: "document_read",
      description: "Reads the documentation for a specific package.",
      inputSchema: {
        type: "object",
        properties: {
          packageName: {
            type: "string",
            description: "The name of the package to read.",
          },
          path: {
            type: "string",
            description: "The root path of the project to inspect. Defaults to the current directory.",
          },
        },
        required: ["packageName"],
      },
    },
    execute: async (args) => {
      const { packageName, path = "." } = args as { packageName: string; path?: string };

      try {
        // We don't know the glob for a specific package, so we find all and then filter.
        const packages = await findPackagesWithDocs(path, "*");
        const targetPackage = packages.find((p) => p.name === packageName);

        if (!targetPackage) {
          return {
            content: [{ type: "text", text: `Package '${packageName}' not found or has no documentation.` }],
          };
        }

        const docContent = await Deno.readTextFile(targetPackage.docPath);

        return {
          content: [
            {
              type: "text",
              text: docContent,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error reading documentation for ${packageName}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    },
  }),
};
