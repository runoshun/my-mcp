import { assertEquals } from "@std/assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

Deno.test("add function", async () => {
	const { add } = await import("./main.ts");
	const result = add(2, 3);
	assertEquals(result, 5);
});

Deno.test("MCP client-server integration", async () => {
	// Create MCP client transport that launches the server directly
	const transport = new StdioClientTransport({
		command: "/home/devuser/.local/share/mise/installs/deno/2.2.5/bin/deno",
		args: ["run", "--allow-read", "--allow-env", "main.ts"],
		env: { PATH: Deno.env.get("PATH") || "" }
	});

	const client = new Client(
		{
			name: "test-client",
			version: "1.0.0",
		},
		{
			capabilities: {},
		}
	);

	try {
		// Connect to server (this will start the server process)
		await client.connect(transport);

		// Test listing tools
		const toolsResponse = await client.listTools();
		assertEquals(toolsResponse.tools.length, 1);
		assertEquals(toolsResponse.tools[0].name, "add");
		assertEquals(toolsResponse.tools[0].description, "Add two numbers");

		// Test calling the add tool
		const callResult = await client.callTool({
			name: "add",
			arguments: { a: 7, b: 3 },
		});

		// Check result structure
		assertEquals(Array.isArray(callResult.content), true);
		assertEquals(callResult.content.length, 1);
		assertEquals(callResult.content[0].type, "text");
		assertEquals(callResult.content[0].text, "7 + 3 = 10");

		// Test another calculation
		const callResult2 = await client.callTool({
			name: "add",
			arguments: { a: 15, b: 25 },
		});

		assertEquals(Array.isArray(callResult2.content), true);
		assertEquals(callResult2.content.length, 1);
		assertEquals(callResult2.content[0].type, "text");
		assertEquals(callResult2.content[0].text, "15 + 25 = 40");

	} finally {
		// Close client connection (this will terminate the server process)
		try {
			await client.close();
		} catch (error) {
			console.warn("Error closing client:", error);
		}
	}
});
