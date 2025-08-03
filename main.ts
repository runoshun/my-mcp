import { ModularMCPServer } from "./server.ts";
import { ToolModule } from "./tools/tool-interface.ts";
import { geminiSearchTool } from "./tools/gemini-search.ts";
import { terminalCloseTool, terminalTool } from "./tools/terminal.ts";
import {
  addObservationsTool,
  createEntitesTool,
  createRelationsTool,
  deleteEntitiesTool,
  deleteObservationsTool,
  deleteRelationsTool,
  openNodesTool,
  readGraphTool,
  searchNodesTool,
} from "./tools/memory.ts";

interface ServerConfig {
  tools?: string[];
  listTools?: boolean;
}

const AVAILABLE_TOOLS = new Map<string, ToolModule>([
  [geminiSearchTool.id, geminiSearchTool],
  [terminalTool.id, terminalTool],
  [terminalCloseTool.id, terminalCloseTool],
  [createEntitesTool.id, createEntitesTool],
  [createRelationsTool.id, createRelationsTool],
  [addObservationsTool.id, addObservationsTool],
  [deleteEntitiesTool.id, deleteEntitiesTool],
  [deleteObservationsTool.id, deleteObservationsTool],
  [deleteRelationsTool.id, deleteRelationsTool],
  [readGraphTool.id, readGraphTool],
  [searchNodesTool.id, searchNodesTool],
  [openNodesTool.id, openNodesTool],
]);

function parseCliArgs(args: string[]): ServerConfig {
  const config: ServerConfig = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--tools":
      case "-t":
        if (i + 1 < args.length) {
          config.tools = args[++i].split(",").map((t) => t.trim());
        }
        break;
      case "--list":
      case "-l":
        config.listTools = true;
        break;
    }
  }

  return config;
}

function printUsage() {
  console.log(`
Usage: deno run main.ts [options]

Options:
  --tools, -t <tools>     Comma-separated list of tools to enable
  --list, -l              List available tools and exit
  
Available tools:`);

  for (const [id, tool] of AVAILABLE_TOOLS) {
    console.log(`  ${id}: ${tool.description}`);
  }

  console.log("\nExamples:");
  console.log("  deno run main.ts --tools gemini-search");
  console.log("  deno run main.ts --list\n");
}

if (import.meta.main) {
  const config = parseCliArgs(Deno.args);

  if (config.listTools) {
    printUsage();
    Deno.exit(0);
  }

  try {
    const server = new ModularMCPServer(config, AVAILABLE_TOOLS);

    await server.initialize();
    await server.run();
  } catch (error) {
    console.error(
      `Server error: ${error instanceof Error ? error.message : String(error)}`,
    );
    Deno.exit(1);
  }
}
