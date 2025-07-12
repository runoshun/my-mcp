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
			assertEquals(toolsResponse.tools[0].name, "add");
			assertEquals(toolsResponse.tools[0].description, "Add two numbers");
			console.log("Tool listing test passed ✓");

			console.log("Testing tool execution...");
			const callResult = await client.callTool({
				name: "add",
				arguments: { a: 7, b: 3 },
			});

			if (!Array.isArray(callResult.content)) {
				throw new Error("Expected content to be an array");
			}
			assertEquals(Array.isArray(callResult.content), true);
			assertEquals(callResult.content.length, 1);
			assertEquals(callResult.content[0].type, "text");
			assertEquals(callResult.content[0].text, "7 + 3 = 10");
			console.log("Tool execution test passed ✓");

			console.log("Testing second calculation...");
			const callResult2 = await client.callTool({
				name: "add",
				arguments: { a: 15, b: 25 },
			});

			if (!Array.isArray(callResult2.content)) {
				throw new Error("Expected content to be an array");
			}
			assertEquals(Array.isArray(callResult2.content), true);
			assertEquals(callResult2.content.length, 1);
			assertEquals(callResult2.content[0].type, "text");
			assertEquals(callResult2.content[0].text, "15 + 25 = 40");
			console.log("Second calculation test passed ✓");

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
