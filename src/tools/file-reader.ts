/**
 * File Reader Tool for Echosphere MCP Server
 * Provides secure file reading capabilities within a workspace
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { validateAndNormalizePath, getPathType, validateWorkspaceRoot } from "../shared/validation.js";
import { readSingleFile } from "../shared/file-operations.js";
import { MAX_FILE_SIZE_BYTES, MAX_RESPONSE_SIZE_BYTES, TRUNCATION_MESSAGE } from "../constants/file-reader-config.js";
import { logError } from "../utils/logger.js";
/**
 * Schema for the read_files tool parameters
 */
export const readFilesSchema = {
  workspaceRoot: z.string().describe("Absolute path to the workspace root directory"),
  relativePaths: z.array(z.string()).min(1, "Must provide at least one file path").max(50, "Maximum 50 files per batch to ensure optimal performance").describe("Array of relative file paths from the workspace root directory. Only individual files are supported - directories are not allowed.")
};

/**
 * Handles reading a single file path
 */
async function handleSinglePath(workspace_root: string, relative_path: string): Promise<{ files: any[], errors: string[] }> {
  const errors: string[] = [];
  const files: any[] = [];
  
  try {
    // Validate and normalize the file path
    const resolvedPath = await validateAndNormalizePath(workspace_root, relative_path);
    
    // Check what type of path we're dealing with
    const pathType = await getPathType(resolvedPath);
    
    if (pathType === 'not_found') {
      errors.push(`File "${relative_path}" not found in workspace`);
      return { files, errors };
    }
    
    if (pathType === 'directory') {
      errors.push(`Path "${relative_path}" is a directory. Only individual files are supported.`);
      return { files, errors };
    }
    
    // Read single file
    const fileResult = await readSingleFile(resolvedPath);
    
    // Check if file exceeds max size and truncate if necessary
    let content = fileResult.content;
    let truncated = false;
    if (fileResult.size > MAX_FILE_SIZE_BYTES) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const encoded = encoder.encode(fileResult.content);
      const maxBytes = MAX_FILE_SIZE_BYTES - encoder.encode(TRUNCATION_MESSAGE).length;
      content = decoder.decode(encoded.slice(0, maxBytes)) + TRUNCATION_MESSAGE;
      truncated = true;
    }
    
    // Use the original relative_path to preserve the user's path format
    files.push({
      path: relative_path,
      content,
      size: fileResult.size,
      type: 'file',
      truncated
    });
  } catch (error) {
    errors.push(`Error reading file "${relative_path}": ${error instanceof Error ? error.message : 'Unknown error'}`);
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
              text: "No file paths provided to read.\n\nUsage Example:\n{\n  \"workspaceRoot\": \"C:/project\",\n  \"relativePaths\": [\"src/file1.js\", \"README.md\"]\n}\n\nImportant:\n- Provide at least one file path in the relativePaths array\n- Paths should be relative to workspaceRoot\n- Only individual files are supported, not directories\n- Maximum 50 files per batch for optimal performance\n\nFor more information, see the tool documentation."
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
        const totalCount = relativePaths.length;
        
        // Create a more descriptive summary
        let responseText = `Read ${totalCount} file(s): ${successCount} successful, ${errorCount} failed\n\n`;
        
        let totalResponseSize = 0;
        const encoder = new TextEncoder();
        
        // Add file contents with size limits
        for (let i = 0; i < relativePaths.length; i++) {
          const relativePath = relativePaths[i];
          const header = `${relativePath}:\n`;
          responseText += header;
          totalResponseSize += encoder.encode(header).length;
          
          // Find the file with this exact path
          const file = allFiles.find(f => f.path === relativePath);
          const errorResult = allErrors.find(e => e.includes(relativePath));
          
          if (file) {
            const contentWithNewlines = `${file.content}\n\n`;
            const contentSize = encoder.encode(contentWithNewlines).length;
            
            // Check if adding this content would exceed max response size
            if (totalResponseSize + contentSize > MAX_RESPONSE_SIZE_BYTES) {
              const remainingBytes = MAX_RESPONSE_SIZE_BYTES - totalResponseSize - encoder.encode(TRUNCATION_MESSAGE).length - 10;
              if (remainingBytes > 0) {
                const encoded = encoder.encode(file.content);
                const decoder = new TextDecoder();
                const truncatedContent = decoder.decode(encoded.slice(0, remainingBytes));
                responseText += `${truncatedContent}${TRUNCATION_MESSAGE}\n\n`;
              } else {
                responseText += `[Content omitted - response size limit reached]\n\n`;
              }
              break; // Stop adding more files
            }
            
            responseText += contentWithNewlines;
            totalResponseSize += contentSize;
            
            // Add truncation notice if file was truncated
            if (file.truncated) {
              const notice = `[Note: File was truncated at ${MAX_FILE_SIZE_BYTES} bytes]\n\n`;
              responseText += notice;
              totalResponseSize += encoder.encode(notice).length;
            }
          } else if (errorResult) {
            const errorText = `Error: ${errorResult}\n\n`;
            responseText += errorText;
            totalResponseSize += encoder.encode(errorText).length;
          } else {
            const errorText = `Error: File not found or could not be read\n\n`;
            responseText += errorText;
            totalResponseSize += encoder.encode(errorText).length;
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
        logError("FileReader.read_files", error);
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
