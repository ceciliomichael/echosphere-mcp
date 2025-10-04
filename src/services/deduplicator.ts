/**
 * Deduplication Service
 * Handles content hash generation and duplicate detection
 */

import { createHash } from "crypto";
import { cosineSimilarity } from "../utils/vector-math.js";
import type { MemoryChunk } from "../shared/types.js";
import { SIMILARITY_DEDUP_THRESHOLD } from "../constants/rag-config.js";

export class Deduplicator {
  private readonly similarityThreshold: number;

  constructor(similarityThreshold: number = SIMILARITY_DEDUP_THRESHOLD) {
    this.similarityThreshold = similarityThreshold;
  }

  /**
   * Generate content hash for deduplication
   */
  generateContentHash(content: string): string {
    // Normalize content: trim, collapse whitespace, remove volatile elements
    const normalized = content
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
    
    return createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Check if chunk is duplicate based on content hash or similarity
   */
  isDuplicate(
    newChunk: { content: string; contentHash: string; embedding?: number[] },
    existingChunks: MemoryChunk[],
    docId?: string
  ): boolean {
    for (const existing of existingChunks) {
      // Skip if different docId (allow duplicates across different documents)
      if (docId && existing.docId && docId !== existing.docId) {
        continue;
      }
      
      // Check content hash first (exact duplicates)
      if (existing.contentHash === newChunk.contentHash) {
        return true;
      }
      
      // Check semantic similarity for near-duplicates
      if (newChunk.embedding && existing.embedding) {
        const similarity = cosineSimilarity(newChunk.embedding, existing.embedding);
        if (similarity >= this.similarityThreshold) {
          return true;
        }
      }
    }
    
    return false;
  }
}

// Export singleton instance
export const deduplicator = new Deduplicator();

