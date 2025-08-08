import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { findPackagesWithDocs } from "./documentation.ts";

interface MockPackage {
  name: string;
  files: Record<string, string>;
}

async function setupMockProject(packages: MockPackage[]): Promise<string> {
  const projectPath = await Deno.makeTempDir({ prefix: "mcp-test-project-" });
  const nodeModulesPath = join(projectPath, "node_modules");
  await Deno.mkdir(nodeModulesPath);

  for (const pkg of packages) {
    const pkgPath = join(nodeModulesPath, pkg.name);
    await Deno.mkdir(pkgPath, { recursive: true });

    for (const [fileName, content] of Object.entries(pkg.files)) {
      const filePath = join(pkgPath, fileName);
      if (fileName.includes('/')) {
        await Deno.mkdir(join(pkgPath, fileName.substring(0, fileName.lastIndexOf('/'))), { recursive: true });
      }
      await Deno.writeTextFile(filePath, content);
    }
  }

  return projectPath;
}

const mockPackages: MockPackage[] = [
  {
    name: "pkg-with-docpath",
    files: {
      "package.json": JSON.stringify({ name: "pkg-with-docpath", doc_path: "docs/manual.md" }),
      "docs/manual.md": "This is the manual.",
    },
  },
  {
    name: "pkg-with-docs-html",
    files: {
        "package.json": JSON.stringify({ name: "pkg-with-docs-html" }),
        "docs/index.html": "<h1>Docs</h1>",
    },
  },
  {
    name: "pkg-with-readme",
    files: {
        "package.json": JSON.stringify({ name: "pkg-with-readme" }),
        "README.md": "This is a readme.",
    },
  },
  {
    name: "pkg-with-nothing",
    files: {
        "package.json": JSON.stringify({ name: "pkg-with-nothing" }),
        "index.js": "console.log('hello');",
    },
  },
  {
    name: "pkg-in-scope",
    files: {
        "package.json": JSON.stringify({ name: "@scope/pkg-in-scope" }),
        "README.md": "Scoped package readme.",
    },
  }
];

Deno.test("findPackagesWithDocs should find all packages with documentation", async () => {
  const projectPath = await setupMockProject(mockPackages);

  try {
    const found = await findPackagesWithDocs(projectPath);

    assertEquals(found.length, 4);

    const pkgWithDocpath = found.find(p => p.name === "pkg-with-docpath");
    assertExists(pkgWithDocpath);
    assertEquals(pkgWithDocpath.type, "field");
    assert(pkgWithDocpath.docPath.endsWith("docs/manual.md"));

    const pkgWithDocsHtml = found.find(p => p.name === "pkg-with-docs-html");
    assertExists(pkgWithDocsHtml);
    assertEquals(pkgWithDocsHtml.type, "docs");
    assert(pkgWithDocsHtml.docPath.endsWith("docs/index.html"));

    const pkgWithReadme = found.find(p => p.name === "pkg-with-readme");
    assertExists(pkgWithReadme);
    assertEquals(pkgWithReadme.type, "readme");
    assert(pkgWithReadme.docPath.endsWith("README.md"));

    const pkgInScope = found.find(p => p.name === "@scope/pkg-in-scope");
    assertExists(pkgInScope);
    assertEquals(pkgInScope.type, "readme");
    assert(pkgInScope.docPath.endsWith("README.md"));

  } finally {
    await Deno.remove(projectPath, { recursive: true });
  }
});

Deno.test("findPackagesWithDocs should filter packages with glob pattern", async () => {
    const projectPath = await setupMockProject(mockPackages);

    try {
      const found = await findPackagesWithDocs(projectPath, "pkg-with-doc*");
      assertEquals(found.length, 2);
    } finally {
      await Deno.remove(projectPath, { recursive: true });
    }
});

Deno.test("Document reading logic should retrieve correct content", async () => {
    const projectPath = await setupMockProject(mockPackages);

    try {
      const found = await findPackagesWithDocs(projectPath, "pkg-with-docpath");
      assertEquals(found.length, 1);
      const pkg = found[0];

      const content = await Deno.readTextFile(pkg.docPath);
      assertEquals(content, "This is the manual.");

    } finally {
      await Deno.remove(projectPath, { recursive: true });
    }
});
