/**
 * Rename File Tool for Echosphere MCP Server
 * Provides secure file renaming capabilities within a workspace
 */

import { z } from "zod";
import path from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { validateAndNormalizePath, validateWorkspaceRoot } from "../shared/validation.js";
import { renameFile } from "../shared/file-operations.js";

/**
 * Schema for the rename_file tool parameters
 */
export const renameFileSchema = {
  workspaceRoot: z.string().describe("Absolute path to the workspace root directory"),
  relativePath: z.string().describe("Relative path of the file to rename"),
  newName: z.string().describe("New name for the file (filename only, not a path)")
};

/**
 * Registers the rename file tool with the MCP server
 */
export function registerRenameFileTool(server: McpServer): void {
  server.tool(
    "rename_file",
    renameFileSchema,
    async ({ workspaceRoot, relativePath, newName }) => {
      try {
        // Validate workspace root
        await validateWorkspaceRoot(workspaceRoot);
        
        // Validate parameters
        if (!relativePath || !newName) {
          return {
            content: [{
              type: "text",
              text: "Both relativePath and newName are required.\n\nUsage: {\"workspaceRoot\": \"C:/project\", \"relativePath\": \"src/old-file.js\", \"newName\": \"new-file.js\"}"
            }],
            isError: true
          };
        }
        
        // Validate that newName is just a filename, not a path
        if (newName.includes(path.sep) || newName.includes('/') || newName.includes('\\')) {
          return {
            content: [{
              type: "text",
              text: "newName must be a filename only, not a path. Use move_file tool to move files to different directories."
            }],
            isError: true
          };
        }
        
        // Validate that the file path is within the workspace
        try {
          await validateAndNormalizePath(workspaceRoot, relativePath);
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Path validation error: ${error instanceof Error ? error.message : 'Invalid path'}`
            }],
            isError: true
          };
        }
        
        // Perform the rename operation
        const result = await renameFile(workspaceRoot, relativePath, newName);
        
        if (result.success) {
          return {
            content: [{
              type: "text",
              text: `Successfully renamed file from "${result.originalRelativePath}" to "${result.newRelativePath}"`
            }],
            isError: false
          };
        } else {
          return {
            content: [{
              type: "text",
              text: `Failed to rename file "${result.originalRelativePath}" to "${result.newRelativePath}": ${result.error}`
            }],
            isError: true
          };
        }
        
      } catch (error) {
        console.error("Rename file error:", error);
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
