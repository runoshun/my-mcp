import { ToolModule } from "./tool-interface.ts";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const geminiSearchTool: ToolModule = {
  id: "gemini-search",
  description: "Search the web and get summaries using Gemini CLI",

  getToolDefinition: () => ({
    tool: {
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
    },

    execute: async (args) => {
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
    },
  }),

  validate: async () => {
    try {
      const process = new Deno.Command("npx", {
        args: ["@google/gemini-cli", "--version"],
        stdout: "piped",
        stderr: "piped",
      });
      const { code } = await process.output();
      return code === 0;
    } catch {
      return false;
    }
  },
};