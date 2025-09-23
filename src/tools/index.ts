/**
 * Tool registry for Echosphere MCP Server
 * Centralizes all tool registrations
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFileReaderTool } from "./file-reader.js";

/**
 * Registers all available tools with the MCP server
 */
export function registerAllTools(server: McpServer): void {
  // Register file reader tool
  registerFileReaderTool(server);
  
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
  }
  // Future tools will be listed here
] as const;
