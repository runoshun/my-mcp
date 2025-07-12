import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolResult,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

export function add(a: number, b: number): number {
  return a + b;
}

class MathToolsServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "math-tools",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "add",
            description: "Add two numbers",
            inputSchema: {
              type: "object",
              properties: {
                a: {
                  type: "number",
                  description: "First number to add",
                },
                b: {
                  type: "number", 
                  description: "Second number to add",
                },
              },
              required: ["a", "b"],
            },
          } as Tool,
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === "add") {
        const { a, b } = args as { a: number; b: number };
        const result = add(a, b);
        
        return {
          content: [
            {
              type: "text",
              text: `${a} + ${b} = ${result}`,
            },
          ],
        } as CallToolResult;
      }

      throw new Error(`Unknown tool: ${name}`);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

if (import.meta.main) {
  const server = new MathToolsServer();
  await server.run();
}
