/**
 * Save Memory Tool for Echosphere MCP Server
 * Provides memory saving capabilities to persistent storage
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { validateWorkspaceRoot } from "../shared/validation.js";
import { ragMemoryService } from "../services/rag-memory-service.js";
import { logError, logWarning } from "../utils/logger.js";

/**
 * Schema for the save_memory tool parameters
 */
export const saveMemorySchema = {
  workspaceRoot: z.string().describe("Absolute path to the workspace root directory"),
  content: z.string().describe("DETAILED memory content to save. For maximum effectiveness, include: 1) Context about what was happening, 2) Specific actions taken, 3) Results/outcomes, 4) Important decisions made, 5) Key insights or learnings, 6) Relevant file paths, commands, or code snippets. The more detailed and comprehensive the memory, the better the AI can understand and recall the context in future sessions."),
  append: z.boolean().optional().default(false).describe("Whether to append to existing memory or replace it. Use 'true' to add new information, 'false' to replace all memory"),
  metadata: z.record(z.any()).optional().describe("Optional metadata to associate with the memory (e.g., {project: 'myapp', priority: 'high', category: 'debugging'})"),
  tags: z.array(z.string()).optional().describe("Optional tags to categorize the memory for easier retrieval (e.g., ['bug-fix', 'database', 'performance'])"),
  docId: z.string().optional().describe("Document ID to group related chunks together. Use same docId for updates to the same topic/document"),
  source: z.string().optional().describe("Source of the content (e.g., 'session-2024-01-15', 'debugging-auth-issue', 'user-feedback')")
};

/**
 * Registers the save memory tool with the MCP server
 */
export function registerSaveMemoryTool(server: McpServer): void {
  server.tool(
    "save_memory",
    saveMemorySchema,
    async ({ workspaceRoot, content, append, metadata, tags, docId, source }) => {
      try {
        // Validate workspace root
        await validateWorkspaceRoot(workspaceRoot);
        
        // Validate content
        if (!content || content.trim().length === 0) {
          return {
            content: [{
              type: "text",
              text: "Content is required and cannot be empty.\n\nFor maximum effectiveness, provide DETAILED memory including:\n• Context about what was happening\n• Specific actions taken\n• Results and outcomes\n• Important decisions made\n• Key insights or learnings\n• Relevant file paths, commands, or code snippets"
            }],
            isError: true
          };
        }
        
        // Provide guidance for short content
        if (content.trim().length < 100) {
          logWarning("SaveMemory", `Short content (${content.trim().length} chars) - consider more detail`);
        }
        
        // Save memory using RAG system
        const result = await ragMemoryService.saveMemory(workspaceRoot, content, append, metadata, tags, docId, source);
        
        if (result.success) {
          const stats = await ragMemoryService.getMemoryStats(workspaceRoot);
          const guidanceText = content.trim().length < 200 ? 
            "\n\n💡 TIP: For better memory retrieval, consider saving more detailed information including specific context, actions taken, outcomes, and relevant technical details." : "";
          
          return {
            content: [{
              type: "text",
              text: `✅ Successfully ${append ? 'appended to' : 'saved'} memory with embeddings.\n\n` +
                    `📊 Memory Stats:\n` +
                    `• Content size: ${result.size} characters\n` +
                    `• Total memory chunks: ${stats.totalChunks}\n` +
                    `• Total memory size: ${stats.totalSize} characters\n` +
                    `• ${result.content || ''}\n` +
                    `${docId ? `• Document ID: ${docId}\n` : ''}` +
                    `${source ? `• Source: ${source}\n` : ''}` +
                    `${tags && tags.length > 0 ? `• Tags: ${tags.join(', ')}\n` : ''}` +
                    guidanceText
            }],
            isError: false
          };
        } else {
          return {
            content: [{
              type: "text",
              text: result.error || "Failed to save memory"
            }],
            isError: true
          };
        }
        
      } catch (error) {
        logError("SaveMemory.save_memory", error);
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
