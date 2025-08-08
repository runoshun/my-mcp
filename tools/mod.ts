import { geminiSearchTool } from "./gemini-search.ts";
import { terminalCloseTool, terminalTool } from "./terminal.ts";
import {
  addObservationsTool,
  createEntitiesTool,
  createRelationsTool,
  deleteEntitiesTool,
  deleteObservationsTool,
  deleteRelationsTool,
  openNodesTool,
  readGraphTool,
  searchNodesTool,
} from "./memory.ts";
import { ToolModule } from "./tool-interface.ts";
import {
  documentAvailablePackagesTool,
  documentReadTool,
} from "./documentation.ts";

export const AVAILABLE_TOOLS = new Map<string, ToolModule[]>([
  ["gemini-search", [geminiSearchTool]],
  ["terminal", [terminalTool, terminalCloseTool]],
  [
    "documentation",
    [documentAvailablePackagesTool, documentReadTool],
  ],
  [
    "memory",
    [
      createEntitiesTool,
      createRelationsTool,
      addObservationsTool,
      deleteEntitiesTool,
      deleteObservationsTool,
      deleteRelationsTool,
      readGraphTool,
      searchNodesTool,
      openNodesTool,
    ],
  ],
]);
