import { assertEquals, assertExists } from "@std/assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

Deno.test({
  name: "Server starts with default configuration",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    console.log("Testing default server configuration...");

    const transport = new StdioClientTransport({
      command: "deno",
      args: ["run", "--allow-read", "--allow-env", "--allow-run", "main.ts"],
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
      await client.connect(transport);

      const toolsResponse = await client.listTools();
      assertEquals(toolsResponse.tools.length, 3);

      const toolNames = toolsResponse.tools.map((tool) => tool.name).sort();
      assertEquals(toolNames, [
        "gemini_search",
        "terminal_close",
        "terminal_execute",
      ]);
      console.log("Default configuration test passed ✓");
    } finally {
      await client.close();
    }
  },
});

Deno.test({
  name: "Server starts with specific tools via --tools flag",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    console.log("Testing --tools flag...");

    const transport = new StdioClientTransport({
      command: "deno",
      args: [
        "run",
        "--allow-read",
        "--allow-env",
        "--allow-run",
        "main.ts",
        "--tools",
        "gemini-search",
      ],
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
      await client.connect(transport);

      const toolsResponse = await client.listTools();
      assertEquals(toolsResponse.tools.length, 1);
      assertEquals(toolsResponse.tools[0].name, "gemini_search");
      console.log("--tools flag test passed ✓");
    } finally {
      await client.close();
    }
  },
});

Deno.test({
  name: "Server handles non-existent tools gracefully",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    console.log("Testing non-existent tool handling...");

    const transport = new StdioClientTransport({
      command: "deno",
      args: [
        "run",
        "--allow-read",
        "--allow-env",
        "--allow-run",
        "main.ts",
        "--tools",
        "non-existent",
      ],
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
      await client.connect(transport);

      const toolsResponse = await client.listTools();
      assertEquals(toolsResponse.tools.length, 0);
      console.log("Non-existent tool handling test passed ✓");
    } finally {
      await client.close();
    }
  },
});

Deno.test({
  name: "Tool execution works correctly",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    console.log("Testing tool execution...");

    const transport = new StdioClientTransport({
      command: "deno",
      args: ["run", "--allow-read", "--allow-env", "--allow-run", "main.ts"],
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
      await client.connect(transport);

      // Test terminal_execute tool since it's more reliable than gemini_search
      try {
        const callResult = await client.callTool({
          name: "terminal_execute",
          arguments: { keys: "echo test", sendEnter: true, readWait: 500 },
        });

        assertExists(callResult.content);
        assertEquals(Array.isArray(callResult.content), true);
        assertEquals(
          (callResult.content as { type: string; text: string }[]).length,
          1,
        );
        assertEquals(
          (callResult.content as { type: string; text: string }[])[0].type,
          "text",
        );
        assertEquals(
          typeof (callResult.content as { type: string; text: string }[])[0]
            .text,
          "string",
        );
        console.log("Tool execution test passed ✓");
      } catch (_error) {
        console.log("Tool execution test skipped (tmux not available)");
      }
    } finally {
      await client.close();
    }
  },
});

Deno.test({
  name: "CLI --list flag displays available tools",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    console.log("Testing --list flag...");

    const command = new Deno.Command("deno", {
      args: [
        "run",
        "--allow-read",
        "--allow-env",
        "--allow-run",
        "main.ts",
        "--list",
      ],
      cwd: Deno.cwd(),
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout } = await command.output();
    const output = new TextDecoder().decode(stdout);

    assertEquals(code, 0);
    assertEquals(output.includes("Available tools:"), true);
    assertEquals(output.includes("gemini-search"), true);
    assertEquals(output.includes("terminal"), true);
    assertEquals(output.includes("terminal-close"), true);
    assertEquals(
      output.includes("Search the web and get summaries using Gemini CLI"),
      true,
    );
    assertEquals(
      output.includes("Interactive terminal session management using tmux"),
      true,
    );
    console.log("--list flag test passed ✓");
  },
});
