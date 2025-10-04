/**
 * Retrieval Service
 * Handles similarity search, filtering, and semantic firewall
 */

import { findSimilarEmbeddings } from "./ai-service.js";
import type { MemoryChunk } from "../shared/types.js";

export interface ScoredChunk {
  content: MemoryChunk;
  score: number;
}

export class RetrievalService {
  /**
   * Apply semantic firewall to prevent conflicting evidence
   */
  applySemanticFirewall(chunks: ScoredChunk[]): ScoredChunk[] {
    if (chunks.length === 0) return chunks;
    
    // Group chunks by docId
    const chunksByDocId = new Map<string, ScoredChunk[]>();
    const orphanChunks: ScoredChunk[] = [];
    
    for (const chunk of chunks) {
      if (chunk.content.docId) {
        if (!chunksByDocId.has(chunk.content.docId)) {
          chunksByDocId.set(chunk.content.docId, []);
        }
        chunksByDocId.get(chunk.content.docId)!.push(chunk);
      } else {
        orphanChunks.push(chunk);
      }
    }
    
    const filteredChunks: ScoredChunk[] = [];
    
    // For each docId, keep only the highest scoring chunks (single version)
    for (const [docId, docChunks] of chunksByDocId) {
      // Sort by score descending
      docChunks.sort((a, b) => b.score - a.score);
      
      // Take the best chunks from this document
      const bestFromDoc = docChunks.slice(0, Math.min(3, docChunks.length));
      filteredChunks.push(...bestFromDoc);
    }
    
    // Add orphan chunks (no docId)
    filteredChunks.push(...orphanChunks);
    
    // Sort final result by score
    return filteredChunks.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate dynamic similarity threshold
   */
  calculateDynamicThreshold(scores: number[], minScore: number): number {
    if (scores.length === 0) return minScore;
    
    const topScore = scores[0];
    
    // Use dynamic threshold: minimum of provided minScore or 80% of top score
    const dynamicThreshold = Math.max(minScore, topScore * 0.8);
    
    // But don't go below 0.2 (too permissive) or above 0.7 (too restrictive)
    return Math.max(0.2, Math.min(0.7, dynamicThreshold));
  }

  /**
   * Search for similar chunks using embeddings
   */
  searchSimilarChunks(
    queryEmbedding: number[],
    chunks: MemoryChunk[],
    maxResults: number,
    minScore: number
  ): ScoredChunk[] {
    const results = findSimilarEmbeddings(
      queryEmbedding,
      chunks.map(chunk => ({ embedding: chunk.embedding, content: chunk })),
      maxResults,
      minScore
    );

    return results;
  }

  /**
   * Categorize results into relevance tiers
   */
  categorizeByRelevance(
    chunks: ScoredChunk[],
    minScore: number
  ): {
    highlyRelevant: ScoredChunk[];
    moderatelyRelevant: ScoredChunk[];
    somewhatRelevant: ScoredChunk[];
    maxScore: number;
  } {
    if (chunks.length === 0) {
      return {
        highlyRelevant: [],
        moderatelyRelevant: [],
        somewhatRelevant: [],
        maxScore: 0
      };
    }

    const scores = chunks.map(chunk => chunk.score);
    const maxScore = Math.max(...scores);
    
    // Define flexible relevance tiers
    const highlyRelevant = chunks.filter(chunk => chunk.score >= Math.max(minScore, maxScore * 0.7));
    const moderatelyRelevant = chunks.filter(chunk => 
      chunk.score >= Math.max(0.15, maxScore * 0.4) && chunk.score < Math.max(minScore, maxScore * 0.7)
    );
    const somewhatRelevant = chunks.filter(chunk => 
      chunk.score >= 0.05 && chunk.score < Math.max(0.15, maxScore * 0.4)
    );

    return {
      highlyRelevant,
      moderatelyRelevant,
      somewhatRelevant,
      maxScore
    };
  }
}

// Export singleton instance
export const retrievalService = new RetrievalService();

