import { assertEquals, assertStringIncludes } from "@std/assert";
import { terminalCloseTool, terminalTool } from "./terminal.ts";

type TextContent = { type: string; text: string };

// Helper function to check if tmux is available
async function isTmuxAvailable(): Promise<boolean> {
  try {
    const process = new Deno.Command("tmux", {
      args: ["-V"],
      stdout: "piped",
      stderr: "piped",
    });
    const { code } = await process.output();
    return code === 0;
  } catch {
    return false;
  }
}

Deno.test("terminal tool validation", () => {
  const terminalToolDef = terminalTool.getToolDefinition();
  assertEquals(terminalToolDef.tool.name, "terminal_execute");
  assertEquals(typeof terminalToolDef.execute, "function");

  const closeToolDef = terminalCloseTool.getToolDefinition();
  assertEquals(closeToolDef.tool.name, "terminal_close");
  assertEquals(typeof closeToolDef.execute, "function");
});

Deno.test("terminal tool validation function", async () => {
  const isValid = await terminalTool.validate?.();
  const tmuxAvailable = await isTmuxAvailable();
  assertEquals(isValid, tmuxAvailable);
});

Deno.test("terminal close tool validation function", async () => {
  const isValid = await terminalCloseTool.validate?.();
  const tmuxAvailable = await isTmuxAvailable();
  assertEquals(isValid, tmuxAvailable);
});

Deno.test("terminal execute - capture without sending keys", async () => {
  const tmuxAvailable = await isTmuxAvailable();
  if (!tmuxAvailable) {
    console.log("Skipping terminal execute test - tmux not available");
    return;
  }

  const terminalToolDef = terminalTool.getToolDefinition();

  // Test capturing output without sending keys
  const result = await terminalToolDef.execute({
    sessionName: "test-session-capture",
    keys: "",
    readWait: 500,
  });

  assertEquals(result.content?.length, 1);
  assertEquals(result.content?.[0].type, "text");
  assertStringIncludes(
    (result.content as TextContent[])?.[0]?.text || "",
    "Terminal output captured successfully",
  );
  assertStringIncludes(
    (result.content as TextContent[])?.[0]?.text || "",
    "Session Name: test-session-capture",
  );

  // Clean up session
  const closeToolDef = terminalCloseTool.getToolDefinition();
  await closeToolDef.execute({ sessionName: "test-session-capture" });
});

Deno.test("terminal execute - send command and capture", async () => {
  const tmuxAvailable = await isTmuxAvailable();
  if (!tmuxAvailable) {
    console.log("Skipping terminal execute test - tmux not available");
    return;
  }

  const terminalToolDef = terminalTool.getToolDefinition();

  // Test sending a command
  const result = await terminalToolDef.execute({
    sessionName: "test-session-command",
    keys: "echo 'Hello World'",
    sendEnter: true,
    readWait: 1000,
  });

  assertEquals(result.content?.length, 1);
  assertEquals(result.content?.[0].type, "text");
  assertStringIncludes(
    (result.content as TextContent[])?.[0]?.text || "",
    "Keys sent successfully",
  );
  assertStringIncludes(
    (result.content as TextContent[])?.[0]?.text || "",
    "Session Name: test-session-command",
  );
  assertStringIncludes(
    (result.content as TextContent[])?.[0]?.text || "",
    "Hello World",
  );

  // Clean up session
  const closeToolDef = terminalCloseTool.getToolDefinition();
  await closeToolDef.execute({ sessionName: "test-session-command" });
});

Deno.test("terminal execute - auto-generated session name", async () => {
  const tmuxAvailable = await isTmuxAvailable();
  if (!tmuxAvailable) {
    console.log("Skipping terminal execute test - tmux not available");
    return;
  }

  const terminalToolDef = terminalTool.getToolDefinition();

  // Test without providing session name
  const result = await terminalToolDef.execute({
    keys: "pwd",
    sendEnter: true,
    readWait: 500,
  });

  assertEquals(result.content?.length, 1);
  assertEquals(result.content?.[0].type, "text");
  assertStringIncludes(
    (result.content as TextContent[])?.[0]?.text || "",
    "Keys sent successfully",
  );
  assertStringIncludes(
    (result.content as TextContent[])?.[0]?.text || "",
    "Session Name: ai-terminal-",
  );

  // Extract session name for cleanup
  const text = (result.content as TextContent[])?.[0]?.text || "";
  const sessionNameMatch = (text as string).match(/Session Name: ([\w-]+)/);
  if (sessionNameMatch) {
    const closeToolDef = terminalCloseTool.getToolDefinition();
    await closeToolDef.execute({ sessionName: sessionNameMatch[1] });
  }
});

Deno.test("terminal execute - session persistence", async () => {
  const tmuxAvailable = await isTmuxAvailable();
  if (!tmuxAvailable) {
    console.log("Skipping terminal execute test - tmux not available");
    return;
  }

  const terminalToolDef = terminalTool.getToolDefinition();
  const sessionName = "test-session-persist";

  // First command - change directory to /tmp
  await terminalToolDef.execute({
    sessionName,
    keys: "cd /tmp",
    sendEnter: true,
    readWait: 500,
  });

  // Second command - check current directory (should still be /tmp)
  const result = await terminalToolDef.execute({
    sessionName,
    keys: "pwd",
    sendEnter: true,
    readWait: 500,
  });

  assertEquals(result.content?.length, 1);
  assertStringIncludes(
    (result.content as TextContent[])?.[0]?.text || "",
    "/tmp",
  );

  // Clean up session
  const closeToolDef = terminalCloseTool.getToolDefinition();
  await closeToolDef.execute({ sessionName });
});

Deno.test("terminal execute - special keys", async () => {
  const tmuxAvailable = await isTmuxAvailable();
  if (!tmuxAvailable) {
    console.log("Skipping terminal execute test - tmux not available");
    return;
  }

  const terminalToolDef = terminalTool.getToolDefinition();
  const sessionName = "test-session-special";

  // Test sending Ctrl+C (should interrupt any running command)
  const result = await terminalToolDef.execute({
    sessionName,
    keys: "C-c",
    readWait: 500,
  });

  assertEquals(result.content?.length, 1);
  assertStringIncludes(
    (result.content as TextContent[])?.[0]?.text || "",
    "Keys sent successfully",
  );

  // Clean up session
  const closeToolDef = terminalCloseTool.getToolDefinition();
  await closeToolDef.execute({ sessionName });
});

Deno.test("terminal close - valid session", async () => {
  const tmuxAvailable = await isTmuxAvailable();
  if (!tmuxAvailable) {
    console.log("Skipping terminal close test - tmux not available");
    return;
  }

  const terminalToolDef = terminalTool.getToolDefinition();
  const closeToolDef = terminalCloseTool.getToolDefinition();
  const sessionName = "test-session-close";

  // Create a session first
  await terminalToolDef.execute({
    sessionName,
    keys: "",
    readWait: 100,
  });

  // Close the session
  const result = await closeToolDef.execute({ sessionName });

  assertEquals(result.content?.length, 1);
  assertEquals(result.content?.[0].type, "text");
  assertStringIncludes(
    (result.content as TextContent[])?.[0]?.text || "",
    `Terminal session ${sessionName} closed successfully`,
  );
});

Deno.test("terminal close - missing session name", async () => {
  const closeToolDef = terminalCloseTool.getToolDefinition();

  // Try to close without session name
  const result = await closeToolDef.execute({});

  assertEquals(result.content?.length, 1);
  assertEquals(result.content?.[0].type, "text");
  assertStringIncludes(
    (result.content as TextContent[])?.[0]?.text || "",
    "Error: sessionName is required",
  );
});

Deno.test("terminal close - non-existent session", async () => {
  const tmuxAvailable = await isTmuxAvailable();
  if (!tmuxAvailable) {
    console.log("Skipping terminal close test - tmux not available");
    return;
  }

  const closeToolDef = terminalCloseTool.getToolDefinition();

  // Try to close a non-existent session
  const result = await closeToolDef.execute({
    sessionName: "non-existent-session",
  });

  assertEquals(result.content?.length, 1);
  assertEquals(result.content?.[0].type, "text");
  assertStringIncludes(
    (result.content as TextContent[])?.[0]?.text || "",
    "Error closing terminal session",
  );
});

Deno.test("terminal execute - default parameters", async () => {
  const tmuxAvailable = await isTmuxAvailable();
  if (!tmuxAvailable) {
    console.log("Skipping terminal execute test - tmux not available");
    return;
  }

  const terminalToolDef = terminalTool.getToolDefinition();

  // Test with minimal parameters
  const result = await terminalToolDef.execute({});

  assertEquals(result.content?.length, 1);
  assertEquals(result.content?.[0].type, "text");
  assertStringIncludes(
    (result.content as TextContent[])?.[0]?.text || "",
    "Terminal output captured successfully",
  );

  // Extract session name for cleanup
  const text = (result.content as TextContent[])?.[0]?.text || "";
  const sessionNameMatch = (text as string).match(/Session Name: ([\w-]+)/);
  if (sessionNameMatch) {
    const closeToolDef = terminalCloseTool.getToolDefinition();
    await closeToolDef.execute({ sessionName: sessionNameMatch[1] });
  }
});

Deno.test("terminal execute - readWait parameter bounds", async () => {
  if (!Deno.env.get("WITH_SLOW_TESTS")) {
    console.log("Skipping terminal execute test - WITH_SLOW_TESTS not set");
    return;
  }
  const tmuxAvailable = await isTmuxAvailable();
  if (!tmuxAvailable) {
    console.log("Skipping terminal execute test - tmux not available");
    return;
  }

  const terminalToolDef = terminalTool.getToolDefinition();
  const sessionName = "test-session-readwait";

  // Test with large readWait value (should be capped at 30000ms)
  const start = Date.now();
  await terminalToolDef.execute({
    sessionName,
    keys: "echo 'test'",
    sendEnter: true,
    readWait: 50000, // Should be capped at 30000
  });
  const elapsed = Date.now() - start;

  // Should not take more than 35 seconds (allowing some buffer)
  assertEquals(elapsed < 35000, true);

  // Clean up session
  const closeToolDef = terminalCloseTool.getToolDefinition();
  await closeToolDef.execute({ sessionName });
});

Deno.test("terminal cleanup", async () => {
  // Test cleanup function exists and can be called
  if (terminalTool.cleanup) {
    await terminalTool.cleanup();
  }
  if (terminalCloseTool.cleanup) {
    await terminalCloseTool.cleanup();
  }

  // No assertion needed - just verify it doesn't throw
  assertEquals(true, true);
});
