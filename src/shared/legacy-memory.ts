/**
 * @deprecated This entire module is deprecated.
 * Use ragMemoryService from src/services/rag-memory-service.ts instead.
 * 
 * Legacy memory operations - loads/saves plain JSON memory without embeddings or semantic search.
 * Kept only for backward compatibility.
 */

import { promises as fs } from "fs";
import path from "path";
import type { MemoryResult } from "./types.js";
import { logWarning } from "../utils/logger.js";

/**
 * @deprecated Use ragMemoryService.loadMemory() from src/services/rag-memory-service.ts instead.
 * This function is kept for backward compatibility only.
 * 
 * Legacy memory loading function - loads plain JSON memory.
 * New code should use the RAG-based memory service for semantic search and better retrieval.
 */
export async function loadMemory(workspaceRoot: string, query?: string): Promise<MemoryResult> {
  logWarning('legacy-memory.loadMemory', 'loadMemory() is deprecated. Use ragMemoryService.loadMemory() for RAG-based memory with semantic search.');
  
  try {
    const memoryDir = path.resolve(workspaceRoot, '.memory');
    const memoryPath = path.join(memoryDir, 'memory.json');
    
    // Check if memory file exists
    try {
      await fs.stat(memoryPath);
    } catch {
      // Memory file doesn't exist, create empty one
      await fs.mkdir(memoryDir, { recursive: true });
      await fs.writeFile(memoryPath, JSON.stringify({}), 'utf-8');
      
      return {
        success: true,
        content: "Current memory is empty",
        size: 0
      };
    }
    
    // Read the memory file
    const memoryContent = await fs.readFile(memoryPath, 'utf-8');
    
    if (!memoryContent.trim()) {
      return {
        success: true,
        content: "Current memory is empty",
        size: 0
      };
    }
    
    // If no query provided, return entire memory
    if (!query) {
      return {
        success: true,
        content: memoryContent,
        size: memoryContent.length
      };
    }
    
    // Try to parse as JSON and search within it
    try {
      const memoryData = JSON.parse(memoryContent);
      
      // Search for query in the JSON data
      const searchResults = searchInObject(memoryData, query.toLowerCase());
      
      if (searchResults.length === 0) {
        return {
          success: true,
          content: `No results found for query: "${query}"`,
          size: 0
        };
      }
      
      return {
        success: true,
        content: JSON.stringify(searchResults, null, 2),
        size: JSON.stringify(searchResults).length
      };
    } catch {
      // If not valid JSON, search as plain text
      const lines = memoryContent.split('\n');
      const matchingLines = lines.filter(line => 
        line.toLowerCase().includes(query.toLowerCase())
      );
      
      if (matchingLines.length === 0) {
        return {
          success: true,
          content: `No results found for query: "${query}"`,
          size: 0
        };
      }
      
      const result = matchingLines.join('\n');
      return {
        success: true,
        content: result,
        size: result.length
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error loading memory'
    };
  }
}

/**
 * @deprecated Use ragMemoryService.saveMemory() from src/services/rag-memory-service.ts instead.
 * This function is kept for backward compatibility only.
 * 
 * Legacy memory saving function - saves plain JSON memory.
 * New code should use the RAG-based memory service for chunking, embeddings, and semantic search.
 */
export async function saveMemory(
  workspaceRoot: string, 
  content: string, 
  append: boolean = false
): Promise<MemoryResult> {
  logWarning('legacy-memory.saveMemory', 'saveMemory() is deprecated. Use ragMemoryService.saveMemory() for RAG-based memory with embeddings.');
  
  try {
    const memoryDir = path.resolve(workspaceRoot, '.memory');
    const memoryPath = path.join(memoryDir, 'memory.json');
    
    // Create memory directory if it doesn't exist
    await fs.mkdir(memoryDir, { recursive: true });
    
    let finalContent = content;
    
    if (append) {
      // Try to read existing memory
      try {
        const existingContent = await fs.readFile(memoryPath, 'utf-8');
        
        // Try to parse existing content as JSON
        try {
          const existingData = JSON.parse(existingContent);
          
          // Try to parse new content as JSON
          try {
            const newData = JSON.parse(content);
            
            // Merge JSON objects
            const mergedData = { ...existingData, ...newData };
            finalContent = JSON.stringify(mergedData, null, 2);
          } catch {
            // New content is not JSON, treat as text append
            finalContent = existingContent + '\n' + content;
          }
        } catch {
          // Existing content is not JSON, treat as text append
          finalContent = existingContent + '\n' + content;
        }
      } catch {
        // No existing file, use new content as-is
        finalContent = content;
      }
    }
    
    // Write the memory file
    await fs.writeFile(memoryPath, finalContent, 'utf-8');
    
    return {
      success: true,
      size: finalContent.length
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error saving memory'
    };
  }
}

/**
 * Helper function to search within a JSON object recursively
 */
function searchInObject(obj: any, query: string): any[] {
  const results: any[] = [];
  
  function search(current: any, path: string = ''): void {
    if (typeof current === 'string' && current.toLowerCase().includes(query)) {
      results.push({ path, value: current });
    } else if (typeof current === 'object' && current !== null) {
      if (Array.isArray(current)) {
        current.forEach((item, index) => {
          search(item, `${path}[${index}]`);
        });
      } else {
        Object.keys(current).forEach(key => {
          const keyMatches = key.toLowerCase().includes(query);
          const newPath = path ? `${path}.${key}` : key;
          
          if (keyMatches) {
            results.push({ path: newPath, key, value: current[key] });
          }
          
          search(current[key], newPath);
        });
      }
    }
  }
  
  search(obj);
  return results;
}

