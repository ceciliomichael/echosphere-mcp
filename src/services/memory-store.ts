/**
 * Memory Store Service
 * Handles persistence and I/O operations for memory storage
 */

import { promises as fs } from "fs";
import path from "path";
import type { MemoryStore } from "../shared/types.js";

export class MemoryStoreService {
  private readonly memoryDir: string;
  private readonly memoryFile: string;

  constructor(memoryDir: string = ".memory", memoryFile: string = "memory.json") {
    this.memoryDir = memoryDir;
    this.memoryFile = memoryFile;
  }

  /**
   * Load memory store from disk
   */
  async loadMemoryStore(workspaceRoot: string): Promise<MemoryStore> {
    const memoryPath = path.resolve(workspaceRoot, this.memoryDir, this.memoryFile);
    
    try {
      const data = await fs.readFile(memoryPath, 'utf-8');
      const store = JSON.parse(data) as MemoryStore;
      
      // Validate store structure
      if (!store.chunks || !Array.isArray(store.chunks)) {
        throw new Error("Invalid memory store format");
      }
      
      return store;
    } catch (error) {
      // Return empty store if file doesn't exist or is invalid
      return {
        chunks: [],
        version: "1.0.0",
        lastUpdated: new Date().toISOString(),
        totalChunks: 0
      };
    }
  }

  /**
   * Save memory store to disk
   */
  async saveMemoryStore(workspaceRoot: string, store: MemoryStore): Promise<void> {
    const memoryDirPath = path.resolve(workspaceRoot, this.memoryDir);
    const memoryPath = path.join(memoryDirPath, this.memoryFile);
    
    // Ensure memory directory exists
    await fs.mkdir(memoryDirPath, { recursive: true });
    
    // Update metadata
    store.lastUpdated = new Date().toISOString();
    store.totalChunks = store.chunks.length;
    
    // Save to disk
    await fs.writeFile(memoryPath, JSON.stringify(store, null, 2), 'utf-8');
  }
}

// Export singleton instance
export const memoryStoreService = new MemoryStoreService();

