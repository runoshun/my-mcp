import { ToolModule } from "./tool-interface.ts";
import { CallToolResult } from "../deps/mcp-sdk.ts";

interface TerminalSession {
  name: string;
  socketPath: string;
  lastUsed: number;
}

class TerminalManager {
  private static instance: TerminalManager | null = null;
  private socketDir: string | null = null;
  private socketPath: string | null = null;
  private lastSessionName: string | null = null;
  private sessions: Map<string, TerminalSession> = new Map();

  static getInstance(): TerminalManager {
    if (!TerminalManager.instance) {
      TerminalManager.instance = new TerminalManager();
    }
    return TerminalManager.instance;
  }

  private async initializeSocketDir(): Promise<void> {
    if (this.socketDir) return;

    try {
      this.socketDir = await Deno.makeTempDir({ prefix: "ai-tmux-sockets" });
      this.socketPath = `${this.socketDir}/ai-tmux.sock`;
    } catch (error) {
      throw new Error(`Failed to create temporary directory: ${error}`);
    }
  }

  private generateSessionName(): string {
    return `ai-terminal-${crypto.randomUUID().slice(0, 8)}`;
  }

  private parseKeySequences(keys: string): string[] {
    const sequences: string[] = [];
    let i = 0;

    while (i < keys.length) {
      // Check for control sequences (C-x, M-x)
      if (
        i < keys.length - 2 &&
        keys[i + 1] === "-" &&
        (keys[i] === "C" || keys[i] === "M")
      ) {
        sequences.push(keys.substring(i, i + 3));
        i += 3;
        continue;
      }

      // Check for function keys (F1-F12)
      if (keys[i] === "F" && i < keys.length - 1) {
        let j = i + 1;
        while (j < keys.length && /\d/.test(keys[j])) {
          j++;
        }
        if (j > i + 1) {
          const fKey = keys.substring(i, j);
          if (
            [
              "F1",
              "F2",
              "F3",
              "F4",
              "F5",
              "F6",
              "F7",
              "F8",
              "F9",
              "F10",
              "F11",
              "F12",
            ].includes(fKey)
          ) {
            sequences.push(fKey);
            i = j;
            continue;
          }
        }
      }

      // Check for other special keys
      const specialKeys = [
        "Up",
        "Down",
        "Left",
        "Right",
        "Home",
        "End",
        "PageUp",
        "PageDown",
        "Escape",
        "Tab",
        "BSpace",
        "DC",
        "IC",
        "Enter",
      ];
      let foundSpecial = false;

      for (const special of specialKeys) {
        if (keys.substring(i).startsWith(special)) {
          sequences.push(special);
          i += special.length;
          foundSpecial = true;
          break;
        }
      }

      if (!foundSpecial) {
        // Regular character
        sequences.push(keys[i]);
        i++;
      }
    }

    return sequences;
  }

  private async sessionExists(sessionName: string): Promise<boolean> {
    if (!this.socketPath) return false;

    try {
      const process = new Deno.Command("tmux", {
        args: ["-S", this.socketPath, "has-session", "-t", sessionName],
        stdout: "piped",
        stderr: "piped",
        env: Deno.env.toObject(),
      });
      const { code } = await process.output();
      return code === 0;
    } catch {
      return false;
    }
  }

  private async createSession(
    sessionName: string,
    terminalSize?: { width: number; height: number },
  ): Promise<void> {
    if (!this.socketPath) {
      throw new Error("Socket path not initialized");
    }

    const args = [
      "-S",
      this.socketPath,
      "new-session",
      "-d",
      "-s",
      sessionName,
    ];

    // Add terminal size if specified
    if (terminalSize) {
      args.push(
        "-x",
        terminalSize.width.toString(),
        "-y",
        terminalSize.height.toString(),
      );
    }

    const process = new Deno.Command("tmux", {
      args,
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stderr } = await process.output();
    if (code !== 0) {
      const error = new TextDecoder().decode(stderr);
      throw new Error(`Failed to create tmux session ${sessionName}: ${error}`);
    }

    // Wait a bit for session to be ready
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private async getOrCreateSession(
    sessionName?: string,
    terminalSize?: { width: number; height: number },
  ): Promise<string> {
    await this.initializeSocketDir();

    if (!sessionName) {
      if (this.lastSessionName) {
        sessionName = this.lastSessionName;
      } else {
        sessionName = this.generateSessionName();
      }
    }

    if (!(await this.sessionExists(sessionName))) {
      await this.createSession(sessionName, terminalSize);
    }

    this.lastSessionName = sessionName;
    this.sessions.set(sessionName, {
      name: sessionName,
      socketPath: this.socketPath!,
      lastUsed: Date.now(),
    });

    return sessionName;
  }

  private async sendKeysToSession(
    sessionName: string,
    keys: string,
    keyDelay?: number,
  ): Promise<void> {
    if (!this.socketPath) {
      throw new Error("Socket path not initialized");
    }
    if (!keys) {
      return;
    }

    const keySequences = this.parseKeySequences(keys);
    if (keySequences.length === 0) {
      return;
    }

    // If keyDelay is specified and greater than 0, send keys individually with delay
    if (keyDelay && keyDelay > 0) {
      for (const keySeq of keySequences) {
        const process = new Deno.Command("tmux", {
          args: ["-S", this.socketPath, "send-keys", "-t", sessionName, keySeq],
          stdout: "piped",
          stderr: "piped",
        });

        const { code, stderr } = await process.output();
        if (code !== 0) {
          const error = new TextDecoder().decode(stderr);
          throw new Error(
            `Failed to send key '${keySeq}' to session ${sessionName}: ${error}`,
          );
        }

        // Add delay between keys
        await new Promise((resolve) => setTimeout(resolve, keyDelay));
      }
      return;
    }

    const process = new Deno.Command("tmux", {
      args: [
        "-S",
        this.socketPath,
        "send-keys",
        "-t",
        sessionName,
        ...keySequences,
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stderr } = await process.output();
    if (code !== 0) {
      const error = new TextDecoder().decode(stderr);
      throw new Error(
        `Failed to send keys to session ${sessionName}: ${error}`,
      );
    }
  }

  private async captureOutput(sessionName: string): Promise<string> {
    if (!this.socketPath) {
      throw new Error("Socket path not initialized");
    }

    const process = new Deno.Command("tmux", {
      args: ["-S", this.socketPath, "capture-pane", "-p", "-t", sessionName],
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await process.output();
    if (code !== 0) {
      const error = new TextDecoder().decode(stderr);
      throw new Error(
        `Failed to capture screen for session ${sessionName}: ${error}`,
      );
    }

    const output = new TextDecoder().decode(stdout);
    return output.trimEnd();
  }

  async sendKeysAndCapture(
    sessionName: string | undefined,
    keys: string,
    readWait: number,
    sendEnter: boolean,
    keyDelay?: number,
    terminalSize?: { width: number; height: number },
  ): Promise<{ sessionName: string; output: string }> {
    const actualSessionName = await this.getOrCreateSession(
      sessionName,
      terminalSize,
    );

    if (keys || sendEnter) {
      if (keys) {
        await this.sendKeysToSession(actualSessionName, keys, keyDelay);
      }

      if (sendEnter) {
        await this.sendKeysToSession(actualSessionName, "Enter");
      }

      // Wait for command to execute
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(readWait, 30000))
      );
    }

    const output = await this.captureOutput(actualSessionName);
    return { sessionName: actualSessionName, output };
  }

  async closeSession(sessionName: string): Promise<void> {
    if (!this.socketPath) {
      throw new Error("Socket path not initialized");
    }

    const process = new Deno.Command("tmux", {
      args: ["-S", this.socketPath, "kill-session", "-t", sessionName],
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stderr } = await process.output();
    if (code !== 0) {
      const error = new TextDecoder().decode(stderr);
      throw new Error(`Failed to terminate session ${sessionName}: ${error}`);
    }

    this.sessions.delete(sessionName);
    if (this.lastSessionName === sessionName) {
      this.lastSessionName = null;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.socketPath || !this.socketDir) return;

    try {
      // Kill tmux server
      const process = new Deno.Command("tmux", {
        args: ["-S", this.socketPath, "kill-server"],
        stdout: "piped",
        stderr: "piped",
      });
      await process.output();
    } catch {
      // Ignore errors - server might not be running
    }

    try {
      // Remove socket directory
      await Deno.remove(this.socketDir, { recursive: true });
    } catch {
      // Ignore errors - directory might not exist
    }

    this.socketDir = null;
    this.socketPath = null;
    this.sessions.clear();
    this.lastSessionName = null;
  }
}

export const terminalTool: ToolModule = {
  getToolDefinition: () => ({
    tool: {
      name: "terminal_execute",
      description:
        `Provides an interactive terminal session for executing commands or capturing output.

Key features:
  - Send keys to a tmux session and capture the resulting output.
  - If 'keys' is empty or not provided, captures the current terminal output without sending anything.
  - Creates a new session if 'sessionName' is empty or the specified session doesn't exist.
  - Multiple sessions can be managed independently using different session IDs. Each session maintains its own state (environment variables, working directory).

When sending keys:
  - Special keys and regular characters can be combined. For example, 'vi my_file.txtEscape' opens a file in vi and then sends the Escape key.
  - Special keys are automatically detected and sent as tmux key names:
    * Control keys: C-c, C-d, C-u, C-z, etc.
    * Function keys: F1-F12
    * Navigation: Up, Down, Left, Right, Home, End, PageUp, PageDown
    * Other: Escape, Tab, BSpace (backspace), DC (delete), IC (insert), Enter
  - To execute a command, use the 'sendEnter' parameter (recommended) or include an 'Enter' key in the 'keys' string.

Best practices:
  - Use an empty 'keys' parameter to check the current state of the terminal.
  - Use 'sendEnter=true' to execute a command; it's more reliable than adding a newline to 'keys'.
  - Handle errors gracefully, especially for potentially terminated sessions.`,
      inputSchema: {
        type: "object",
        properties: {
          sessionName: {
            type: "string",
            description: `Terminal session name to use
- Creates a new session if it doesn't exist
- Reuses session if session already exists.
- If you omit sessionName, reuse the last session name`,
          },
          readWait: {
            type: "number",
            description:
              "Time to wait for output before capturing in milliseconds. Default is 1000 (ms). Max is 30000 (ms).",
            default: 1000,
          },
          keys: {
            type: "string",
            description:
              "The key-strokes to send to the terminal. If empty, only captures the current output.",
          },
          sendEnter: {
            type: "boolean",
            description:
              "Whether to send an Enter key (newline) after the keys. Useful when Claude Code trims trailing newlines.",
            default: false,
          },
          keyDelay: {
            type: "number",
            description:
              "Delay in milliseconds between individual key presses. Useful for slow applications or when precise timing is needed.",
          },
          terminalSize: {
            type: "object",
            description: "Terminal size configuration for new sessions",
            properties: {
              width: {
                type: "number",
                description: "Terminal width in columns",
              },
              height: {
                type: "number",
                description: "Terminal height in rows",
              },
            },
          },
        },
        required: [],
      },
    },

    execute: async (args) => {
      try {
        const {
          sessionName,
          readWait = 1000,
          keys = "",
          sendEnter = false,
          keyDelay,
          terminalSize,
        } = args as {
          sessionName?: string;
          readWait?: number;
          keys?: string;
          sendEnter?: boolean;
          keyDelay?: number;
          terminalSize?: { width: number; height: number };
        };

        const manager = TerminalManager.getInstance();
        const result = await manager.sendKeysAndCapture(
          sessionName,
          keys,
          readWait,
          sendEnter,
          keyDelay,
          terminalSize,
        );

        const resultMsg = keys === ""
          ? "Terminal output captured successfully\n"
          : "Keys sent successfully\n";

        return {
          content: [
            {
              type: "text",
              text:
                `${resultMsg}Session Name: ${result.sessionName}\nTerminal Output:\n\`\`\`\n${result.output}\n\`\`\``,
            },
          ],
        } as CallToolResult;
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error executing terminal command: ${
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
  },

  cleanup: async () => {
    const manager = TerminalManager.getInstance();
    await manager.cleanup();
  },
};

export const terminalCloseTool: ToolModule = {
  getToolDefinition: () => ({
    tool: {
      name: "terminal_close",
      description: "Close a terminal session and free up associated resources.",
      inputSchema: {
        type: "object",
        properties: {
          sessionName: {
            type: "string",
            description: "Terminal session name to terminate",
          },
        },
        required: ["sessionName"],
      },
    },

    execute: async (args) => {
      try {
        const { sessionName } = args as { sessionName: string };

        if (!sessionName) {
          return {
            content: [
              {
                type: "text",
                text: "Error: sessionName is required",
              },
            ],
          } as CallToolResult;
        }

        const manager = TerminalManager.getInstance();
        await manager.closeSession(sessionName);

        return {
          content: [
            {
              type: "text",
              text: `Terminal session ${sessionName} closed successfully`,
            },
          ],
        } as CallToolResult;
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error closing terminal session: ${
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
  },

  cleanup: async () => {
    const manager = TerminalManager.getInstance();
    await manager.cleanup();
  },
};
