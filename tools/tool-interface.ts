import { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export interface ToolDefinition {
  tool: Tool;
  execute: (args: Record<string, unknown>) => Promise<CallToolResult>;
}

export interface ToolModule {
  id: string;
  description: string;
  getToolDefinition: () => ToolDefinition;
  validate?: () => Promise<boolean>;
  cleanup?: () => Promise<void>;
}

export type ToolRegistry = Map<string, ToolModule>;