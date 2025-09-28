/**
 * Tool registry for Echosphere MCP Server
 * Centralizes all tool registrations
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFileReaderTool } from "./file-reader.js";
import { registerMoveFileTool } from "./move-file.js";
import { registerRenameFileTool } from "./rename-file.js";
import { registerLoadMemoryTool } from "./load-memory.js";
import { registerSaveMemoryTool } from "./save-memory.js";
import { registerGetTimeTool } from "./get-time.js";

/**
 * Registers all available tools with the MCP server
 */
export function registerAllTools(server: McpServer): void {
  // Register file operation tools
  registerFileReaderTool(server);
  registerMoveFileTool(server);
  registerRenameFileTool(server);
  
  // Register memory management tools
  registerLoadMemoryTool(server);
  registerSaveMemoryTool(server);
  
  // Register utility tools
  registerGetTimeTool(server);
  
  // Future tools can be registered here
  // Example:
  // registerSearchTool(server);
  // registerAnalyticsTool(server);
  // registerWebScrapingTool(server);
}

/**
 * List of all available tools for documentation purposes
 */
export const availableTools = [
  {
    name: "read_files",
    description: "Read files or directories within a workspace",
    category: "file-operations"
  },
  {
    name: "move_file",
    description: "Move a file from one location to another within a workspace",
    category: "file-operations"
  },
  {
    name: "rename_file",
    description: "Rename a file within the same directory",
    category: "file-operations"
  },
  {
    name: "load_memory",
    description: "Load memory from .memory/memory.json with optional query functionality",
    category: "memory-management"
  },
  {
    name: "save_memory",
    description: "Save memory to .memory/memory.json with optional append functionality and embeddings",
    category: "memory-management"
  },
  {
    name: "get_time",
    description: "Get current local time in 12-hour format with AM/PM",
    category: "utilities"
  }
  // Future tools will be listed here
] as const;
