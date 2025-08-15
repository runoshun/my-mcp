import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Server,
  StdioServerTransport,
} from "./deps/mcp-sdk.ts";

import { ToolModule, ToolRegistry } from "./tools/tool-interface.ts";
import { AVAILABLE_TOOLS } from "./tools/mod.ts";

interface ServerConfig {
  tools?: string[];
  listTools?: boolean;
}

class ModularMCPServer {
  private server: Server;
  private toolRegistry: ToolRegistry = new Map();

  constructor(
    private config: ServerConfig,
    private availableTools: Map<string, ToolModule[]>,
  ) {
    this.server = new Server(
      {
        name: "modular-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );
  }

  async initialize() {
    const toolsToLoad = this.config.tools ||
      Array.from(this.availableTools.keys());

    for (const toolId of toolsToLoad) {
      const toolModule = this.availableTools.get(toolId);
      if (!toolModule) {
        console.error(`Tool '${toolId}' not found`);
        continue;
      }

      let validationPassed = true;
      for (const tool of toolModule) {
        if (tool.validate && !(await tool.validate())) {
          console.error(`Tool '${toolId}' validation failed`);
          validationPassed = false;
          break;
        }
      }

      if (!validationPassed) {
        continue;
      }

      for (const tool of toolModule) {
        this.toolRegistry.set(tool.getToolDefinition().tool.name, tool);
      }
      console.error(`Loaded tool: ${toolId}`);
    }

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, () => {
      const tools = Array.from(this.toolRegistry.values()).map(
        (module) => module.getToolDefinition().tool,
      );

      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      for (const [, module] of this.toolRegistry) {
        const definition = module.getToolDefinition();
        if (definition.tool.name === name) {
          return await definition.execute(args || {});
        }
      }

      throw new Error(`Unknown tool: ${name}`);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  async cleanup() {
    for (const [, module] of this.toolRegistry) {
      if (module.cleanup) {
        await module.cleanup();
      }
    }
  }
}

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

  for (const [id, tools] of AVAILABLE_TOOLS) {
    console.log(`  ${id}:`);
    for (const tool of tools) {
      console.log(`  - ${tool.getToolDefinition().tool.name}`);
    }
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
