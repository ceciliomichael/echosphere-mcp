/**
 * Move File Tool for Echosphere MCP Server
 * Provides secure file moving capabilities within a workspace
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { validateAndNormalizePath, validateWorkspaceRoot } from "../shared/validation.js";
import { moveFile } from "../shared/file-operations.js";

/**
 * Schema for the move_file tool parameters
 */
export const moveFileSchema = {
  workspaceRoot: z.string().describe("Absolute path to the workspace root directory"),
  sourceRelativePath: z.string().describe("Relative path of the source file to move"),
  targetRelativePath: z.string().describe("Relative path where the file should be moved to (including new filename)")
};

/**
 * Registers the move file tool with the MCP server
 */
export function registerMoveFileTool(server: McpServer): void {
  server.tool(
    "move_file",
    moveFileSchema,
    async ({ workspaceRoot, sourceRelativePath, targetRelativePath }) => {
      try {
        // Validate workspace root
        await validateWorkspaceRoot(workspaceRoot);
        
        // Validate parameters
        if (!sourceRelativePath || !targetRelativePath) {
          return {
            content: [{
              type: "text",
              text: "Both sourceRelativePath and targetRelativePath are required.\n\nUsage: {\"workspaceRoot\": \"C:/project\", \"sourceRelativePath\": \"src/old-file.js\", \"targetRelativePath\": \"src/new-location/new-file.js\"}"
            }],
            isError: true
          };
        }
        
        // Validate that both paths are within the workspace
        try {
          await validateAndNormalizePath(workspaceRoot, sourceRelativePath);
          await validateAndNormalizePath(workspaceRoot, targetRelativePath);
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Path validation error: ${error instanceof Error ? error.message : 'Invalid path'}`
            }],
            isError: true
          };
        }
        
        // Perform the move operation
        const result = await moveFile(workspaceRoot, sourceRelativePath, targetRelativePath);
        
        if (result.success) {
          return {
            content: [{
              type: "text",
              text: `Successfully moved file from "${result.sourceRelativePath}" to "${result.targetRelativePath}"`
            }],
            isError: false
          };
        } else {
          return {
            content: [{
              type: "text",
              text: `Failed to move file from "${result.sourceRelativePath}" to "${result.targetRelativePath}": ${result.error}`
            }],
            isError: true
          };
        }
        
      } catch (error) {
        console.error("Move file error:", error);
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
