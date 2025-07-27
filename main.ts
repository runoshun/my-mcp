import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  CallToolResult,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

class GeminiToolsServer {
  private server: Server;

  constructor() {
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

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "gemini_search",
            description: "Search the web and get a summary using Gemini CLI",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query to search for and summarize",
                },
              },
              required: ["query"],
            },
          } as Tool,
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === "gemini_search") {
        const { query } = args as { query: string };

        try {
          const process = new Deno.Command("npx", {
            args: [
              "@google/gemini-cli",
              "--model",
              "gemini-2.5-flash",
              "--prompt",
              `Search the web for "${query}" and provide a comprehensive summary of the search results. Include key information, main points, and relevant details.`,
            ],
            stdout: "piped",
            stderr: "piped",
          });

          const { code, stdout, stderr } = await process.output();
          const output = new TextDecoder().decode(stdout);
          const error = new TextDecoder().decode(stderr);

          if (code !== 0) {
            throw new Error(`Gemini CLI failed with code ${code}: ${error}`);
          }

          return {
            content: [
              {
                type: "text",
                text: output,
              },
            ],
          } as CallToolResult;
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error executing Gemini CLI search: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              },
            ],
          } as CallToolResult;
        }
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
  const server = new GeminiToolsServer();
  await server.run();
}
