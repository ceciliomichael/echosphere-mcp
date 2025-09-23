/**
 * File Reader Tool for Echosphere MCP Server
 * Provides secure file reading capabilities within a workspace
 */

import { z } from "zod";
import path from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { validateAndNormalizePath, getPathType, validateWorkspaceRoot } from "../shared/validation.js";
import { readSingleFile, readDirectoryFiles } from "../shared/file-operations.js";
/**
 * Schema for the read_files tool parameters
 */
export const readFilesSchema = {
  workspaceRoot: z.string().describe("Absolute path to the workspace root directory"),
  relativePaths: z.array(z.string()).min(1, "Must provide at least one file path").max(50, "Maximum 50 files per batch to ensure optimal performance").describe("Array of relative file paths from the workspace root directory. For files: reads the specific file(s). For directories: reads all files in the directory and subdirectories (recursive). Use '.' to read all files in workspace root.")
};

/**
 * Handles reading a single path (file or directory)
 */
async function handleSinglePath(workspace_root: string, relative_path: string): Promise<{ files: any[], errors: string[] }> {
  const errors: string[] = [];
  const files: any[] = [];
  
  try {
    // Validate and normalize the file path
    const resolvedPath = validateAndNormalizePath(workspace_root, relative_path);
    
    // Check what type of path we're dealing with
    const pathType = await getPathType(resolvedPath);
    
    if (pathType === 'not_found') {
      errors.push(`Path "${relative_path}" not found in workspace`);
      return { files, errors };
    }
    
    if (pathType === 'file') {
      // Read single file
      const fileResult = await readSingleFile(resolvedPath);
      // Use the original relative_path to preserve the user's path format
      files.push({
        path: relative_path,
        content: fileResult.content,
        size: fileResult.size,
        type: 'file'
      });
    } else {
      // Read directory files
      const dirFiles = await readDirectoryFiles(resolvedPath, workspace_root);
      
      if (dirFiles.length === 0) {
        errors.push(`Directory "${relative_path}" contains no files`);
      } else {
        for (const file of dirFiles) {
          files.push({
            path: file.path,
            content: file.content,
            size: file.size,
            type: 'file',
            error: file.error
          });
        }
      }
    }
  } catch (error) {
    errors.push(`Error reading "${relative_path}": ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return { files, errors };
}


/**
 * Registers the file reader tool with the MCP server
 */
export function registerFileReaderTool(server: McpServer): void {
  server.tool(
    "read_files",
    readFilesSchema,
    async ({ workspaceRoot, relativePaths }) => {
      try {
        // Validate workspace root
        await validateWorkspaceRoot(workspaceRoot);
        
        // Validate relativePaths parameter
        if (!relativePaths || relativePaths.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No relative file paths provided to read.\n\nUsage: {\"workspaceRoot\": \"C:/project\", \"relativePaths\": [\"src/file1.js\", \"README.md\"]}"
            }],
            isError: true
          };
        }
        
        const allFiles: any[] = [];
        const allErrors: string[] = [];
        
        // Process each path
        for (const singlePath of relativePaths) {
          const { files, errors } = await handleSinglePath(workspaceRoot, singlePath);
          allFiles.push(...files);
          allErrors.push(...errors);
        }
        
        // Check if we have any results
        if (allFiles.length === 0 && allErrors.length > 0) {
          return {
            content: [{
              type: "text",
              text: `Errors encountered:\n${allErrors.join('\n')}`
            }],
            isError: true
          };
        }
        
        // Format response
        const successCount = allFiles.length;
        const errorCount = allErrors.length;
        const pathCount = relativePaths.length;
        
        // Create a more descriptive summary
        let responseText = `Processed ${pathCount} path(s), found ${successCount} file(s)`;
        if (errorCount > 0) {
          responseText += `, ${errorCount} error(s)`;
        }
        responseText += `\n\n`;
        
        // Add file contents
        for (let i = 0; i < relativePaths.length; i++) {
          const relativePath = relativePaths[i];
          responseText += `${relativePath}:\n`;
          
          // Find all files that belong to this path (for directories, multiple files)
          const pathFiles = allFiles.filter(f => f.path === relativePath || f.path.startsWith(relativePath + path.sep));
          const errorResult = allErrors.find(e => e.includes(relativePath));
          
          if (pathFiles.length > 0) {
            // Check if this is a single file or directory with multiple files
            const exactMatch = pathFiles.find(f => f.path === relativePath);
            if (exactMatch) {
              // Single file
              responseText += `${exactMatch.content}\n\n`;
            } else {
              // Directory with multiple files
              for (const file of pathFiles) {
                responseText += `\n=== ${file.path} ===\n`;
                if (file.error) {
                  responseText += `Error: ${file.error}\n`;
                } else {
                  responseText += `${file.content}\n`;
                }
              }
              responseText += `\n`;
            }
          } else if (errorResult) {
            responseText += `Error: ${errorResult}\n\n`;
          } else {
            responseText += `Error: File not found or could not be read\n\n`;
          }
        }
        
        return {
          content: [{
            type: "text",
            text: responseText
          }],
          isError: errorCount === relativePaths.length // Only mark as error if ALL files failed
        };
        
      } catch (error) {
        console.error("File reading error:", error);
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
