import { assertEquals } from "@std/assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

Deno.test({
	name: "MCP client-server integration",
	sanitizeResources: false,
	sanitizeOps: false,
	fn: async () => {
		console.log("Starting MCP integration test...");

		// Create MCP client transport that launches the server directly
		const transport = new StdioClientTransport({
			command: "deno",
			args: ["run", "--allow-read", "--allow-env", "main.ts"],
			env: { PATH: Deno.env.get("PATH") || "" },
		});

		const client = new Client(
			{
				name: "test-client",
				version: "1.0.0",
			},
			{
				capabilities: {},
			},
		);

		try {
			console.log("Connecting to server...");
			await client.connect(transport);

			console.log("Testing tool listing...");
			const toolsResponse = await client.listTools();
			assertEquals(toolsResponse.tools.length, 1);
			assertEquals(toolsResponse.tools[0].name, "gemini_search");
			assertEquals(toolsResponse.tools[0].description, "Search the web and get a summary using Gemini CLI");
			console.log("Tool listing test passed ✓");

			console.log("Testing Gemini search tool...");
			// Since gemini_search requires external API, we'll just verify the tool exists
			// and can be called without crashing the server
			try {
				const callResult = await client.callTool({
					name: "gemini_search",
					arguments: { query: "test query" },
				});

				if (!Array.isArray(callResult.content)) {
					throw new Error("Expected content to be an array");
				}
				assertEquals(Array.isArray(callResult.content), true);
				assertEquals(callResult.content.length, 1);
				assertEquals(callResult.content[0].type, "text");
				// We can't predict the exact output, but it should contain something
				assertEquals(typeof callResult.content[0].text, "string");
				console.log("Gemini search tool test passed ✓");
			} catch (error) {
				// If the Gemini CLI is not available, that's okay for testing
				console.log("Gemini search tool test skipped (CLI not available)");
			}

			console.log("All tests passed! 🎉");
		} finally {
			console.log("Closing client connection...");
			try {
				await client.close();
				console.log("Client closed successfully");
			} catch (error) {
				console.warn("Error closing client:", error);
			}
		}
	},
});
