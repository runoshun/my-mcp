import { ModularMCPServer } from "./server.ts";
import { mergeConfigs, parseCliArgs } from "./config.ts";
import { ToolModule } from "./tools/tool-interface.ts";
import { geminiSearchTool } from "./tools/gemini-search.ts";
import { terminalCloseTool, terminalTool } from "./tools/terminal.ts";

const AVAILABLE_TOOLS = new Map<string, ToolModule>([
  [geminiSearchTool.id, geminiSearchTool],
  [terminalTool.id, terminalTool],
  [terminalCloseTool.id, terminalCloseTool],
]);

function printUsage() {
  console.log(`
Usage: deno run main.ts [options]

Options:
  --tools, -t <tools>     Comma-separated list of tools to enable
  --config, -c <file>     Path to configuration file
  --list, -l              List available tools and exit
  
Available tools:`);

  for (const [id, tool] of AVAILABLE_TOOLS) {
    console.log(`  ${id}: ${tool.description}`);
  }

  console.log("\nExamples:");
  console.log("  deno run main.ts --tools gemini-search");
  console.log("  deno run main.ts --config config.json");
  console.log("  deno run main.ts --list\n");
}

if (import.meta.main) {
  const cliConfig = parseCliArgs(Deno.args);

  if (cliConfig.listTools) {
    printUsage();
    Deno.exit(0);
  }

  try {
    const config = await mergeConfigs(cliConfig);
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
