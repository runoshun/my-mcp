import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ToolModule, ToolRegistry } from "./tools/tool-interface.ts";
import { ServerConfig } from "./config.ts";

export class ModularMCPServer {
  private server: Server;
  private toolRegistry: ToolRegistry = new Map();
  
  constructor(
    private config: ServerConfig,
    private availableTools: Map<string, ToolModule>
  ) {
    this.server = new Server(
      {
        name: "gemini-tools",
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
    const toolsToLoad = this.config.tools || Array.from(this.availableTools.keys());
    
    for (const toolId of toolsToLoad) {
      const toolModule = this.availableTools.get(toolId);
      if (!toolModule) {
        console.error(`Tool '${toolId}' not found`);
        continue;
      }
      
      if (toolModule.validate) {
        const isValid = await toolModule.validate();
        if (!isValid) {
          console.error(`Tool '${toolId}' validation failed`);
          continue;
        }
      }
      
      this.toolRegistry.set(toolId, toolModule);
      console.error(`Loaded tool: ${toolId}`);
    }
    
    this.setupToolHandlers();
  }
  
  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.toolRegistry.values()).map(
        module => module.getToolDefinition().tool
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