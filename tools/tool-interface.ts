import { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";

export interface TextContent {
  type: "text";
  text: string;
}

export interface ToolDefinition {
  tool: Tool;
  execute: (args: Record<string, unknown>) => Promise<CallToolResult>;
}

export interface ToolModule {
  getToolDefinition: () => ToolDefinition;
  validate?: () => Promise<boolean>;
  cleanup?: () => Promise<void>;
}

export type ToolRegistry = Map<string, ToolModule>;
