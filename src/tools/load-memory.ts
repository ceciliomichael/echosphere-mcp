/**
 * Load Memory Tool for Echosphere MCP Server
 * Provides memory loading capabilities with RAG query functionality
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { validateWorkspaceRoot } from "../shared/validation.js";
import { ragMemoryService } from "../services/rag-memory-service.js";

/**
 * Clean markdown formatting from text
 */
function cleanMarkdown(text: string): string {
  return text
    // Remove headers (# ## ###)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic asterisks
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // Remove bold/italic underscores
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Remove links [text](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove strikethrough
    .replace(/~~([^~]+)~~/g, '$1')
    // Clean up extra whitespace
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

/**
 * Schema for the load_memory tool parameters
 */
export const loadMemorySchema = {
  workspaceRoot: z.string().describe("Absolute path to the workspace root directory"),
  query: z.string().optional().describe("Optional query to search within the memory content using semantic similarity"),
  maxResults: z.number().optional().default(5).describe("Maximum number of similar memory chunks to return"),
  useRAG: z.boolean().optional().default(true).describe("Whether to use RAG (Retrieval Augmented Generation) to generate a response"),
  minScore: z.number().optional().default(0.3).describe("Minimum similarity score for relevant chunks (0.0-1.0)")
};

/**
 * Registers the load memory tool with the MCP server
 */
export function registerLoadMemoryTool(server: McpServer): void {
  server.tool(
    "load_memory",
    loadMemorySchema,
    async ({ workspaceRoot, query, maxResults, useRAG, minScore }) => {
      try {
        // Validate workspace root
        await validateWorkspaceRoot(workspaceRoot);
        
        // Load memory using RAG system
        const result = await ragMemoryService.loadMemory(workspaceRoot, query, maxResults, useRAG, minScore);
        
        if (result.success) {
          let responseText = result.content || "Current memory is empty";
          
          // If we have a generated RAG response, use that and clean it
          if (result.generatedResponse && query) {
            responseText = cleanMarkdown(result.generatedResponse);
          } else if (query && result.relevantChunks && result.relevantChunks.length > 0) {
            // If no RAG response but we have relevant chunks, return the raw content
            responseText = result.relevantChunks.map(chunk => chunk.content).join('\n\n');
          }
          
          return {
            content: [{
              type: "text",
              text: responseText
            }],
            isError: false
          };
        } else {
          return {
            content: [{
              type: "text",
              text: result.error || "Failed to load memory"
            }],
            isError: true
          };
        }
        
      } catch (error) {
        console.error("Load memory error:", error);
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