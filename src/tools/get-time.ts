/**
 * Get Time Tool for Echosphere MCP Server
 * Provides exact, clean time information
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Schema for the get_time tool parameters (no parameters needed)
 */
export const getTimeSchema = {};

/**
 * Formats the current time in 12-hour local format with AM/PM
 */
function formatTime(): string {
  const now = new Date();
  
  return now.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

/**
 * Registers the get time tool with the MCP server
 */
export function registerGetTimeTool(server: McpServer): void {
  server.tool(
    "get_time",
    getTimeSchema,
    async () => {
      try {
        const timeString = formatTime();
        
        return {
          content: [{
            type: "text",
            text: timeString
          }],
          isError: false
        };
        
      } catch (error) {
        console.error("Get time error:", error);
        return {
          content: [{ 
            type: "text", 
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}` 
          }],
          isError: true
        };
      }
    }
  );
}
