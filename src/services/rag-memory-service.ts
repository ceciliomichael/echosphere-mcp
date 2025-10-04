/**
 * RAG Memory Service for Echosphere MCP Server
 * Provides vector-based memory storage and retrieval with embeddings
 * 
 * This is a thin facade that orchestrates:
 * - TextChunker: intelligent text splitting
 * - Deduplicator: content hash and similarity-based deduplication
 * - MemoryStoreService: persistence and I/O
 * - RetrievalService: similarity search and filtering
 */

import { randomUUID } from "crypto";
import { aiService } from "./ai-service.js";
import { textChunker } from "./chunker.js";
import { deduplicator } from "./deduplicator.js";
import { memoryStoreService } from "./memory-store.js";
import { retrievalService } from "./retrieval.js";
import type { MemoryChunk, MemoryResult } from "../shared/types.js";
import { logError, logInfo } from "../utils/logger.js";

export class RAGMemoryService {
  /**
   * Save memory with embeddings
   */
  async saveMemory(
    workspaceRoot: string,
    content: string,
    append: boolean = false,
    metadata?: Record<string, any>,
    tags?: string[],
    docId?: string,
    source?: string
  ): Promise<MemoryResult> {
    try {
      const store = await memoryStoreService.loadMemoryStore(workspaceRoot);
      
      // If not appending and docId is provided, remove existing chunks for this docId
      if (!append && docId) {
        store.chunks = store.chunks.filter(chunk => chunk.docId !== docId);
      } else if (!append) {
        // Clear all existing memory if not appending and no docId
        store.chunks = [];
      }
      
      // Split content into chunks
      const textChunks = textChunker.splitIntoChunks(content);
      
      if (textChunks.length === 0) {
        return {
          success: false,
          error: "No content to save"
        };
      }
      
      // Generate embeddings for all chunks
      logInfo("RAGMemoryService.saveMemory", `Generating embeddings for ${textChunks.length} chunks`);
      const embeddings = await aiService.generateEmbeddings(textChunks);
      
      // Get current embedding model info
      const embeddingModel = process.env.AI_EMBEDDING_MODEL || "mistral-embed";
      
      // Create memory chunks with deduplication
      const newChunks: MemoryChunk[] = [];
      let duplicatesSkipped = 0;
      
      for (let index = 0; index < textChunks.length; index++) {
        const chunk = textChunks[index];
        const embedding = embeddings[index];
        const contentHash = deduplicator.generateContentHash(chunk);
        
        const candidateChunk = {
          content: chunk,
          contentHash,
          embedding
        };
        
        // Check for duplicates
        if (deduplicator.isDuplicate(candidateChunk, store.chunks, docId)) {
          duplicatesSkipped++;
          continue;
        }
        
        const memoryChunk: MemoryChunk = {
          id: randomUUID(),
          content: chunk,
          embedding,
          timestamp: new Date().toISOString(),
          metadata: metadata || {},
          tags: tags || [],
          docId,
          source,
          contentHash,
          chunkIndex: index,
          chunkCount: textChunks.length,
          embeddingModel
        };
        
        newChunks.push(memoryChunk);
      }
      
      // Add to store
      store.chunks.push(...newChunks);
      
      // Save to disk
      await memoryStoreService.saveMemoryStore(workspaceRoot, store);
      
      let resultMessage = `Successfully saved ${newChunks.length} memory chunks`;
      if (duplicatesSkipped > 0) {
        resultMessage += ` (${duplicatesSkipped} duplicates skipped)`;
      }
      
      return {
        success: true,
        size: content.length,
        content: resultMessage
      };
    } catch (error) {
      logError("RAGMemoryService.saveMemory", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error saving memory'
      };
    }
  }

  /**
   * Load memory with optional RAG query - Always provides meaningful responses
   */
  async loadMemory(
    workspaceRoot: string,
    query?: string,
    maxResults: number = 5,
    useRAG: boolean = true,
    minScore: number = 0.3
  ): Promise<MemoryResult> {
    try {
      const store = await memoryStoreService.loadMemoryStore(workspaceRoot);
      
      if (store.chunks.length === 0) {
        return {
          success: true,
          content: "Current memory is empty. No previous context available.",
          size: 0
        };
      }
      
      // If no query, return a summary of recent memory
      if (!query) {
        const recentChunks = this.getRecentChunks(store.chunks, maxResults);
        const totalContent = recentChunks.map(chunk => chunk.content).join('\n\n---\n\n');
        
        return {
          success: true,
          content: `Recent memory context (${recentChunks.length} chunks):\n\n${totalContent}`,
          size: totalContent.length,
          relevantChunks: recentChunks
        };
      }
      
      // Generate embedding for query
      logInfo("RAGMemoryService.loadMemory", "Searching memory with semantic query");
      const queryEmbedding = await aiService.generateEmbedding(query);
      
      // Find similar chunks with very low threshold to always get results
      const allSimilarChunks = retrievalService.searchSimilarChunks(
        queryEmbedding,
        store.chunks,
        Math.min(maxResults * 4, 20), // Get more candidates for better selection
        0.05 // Very low threshold to capture any potential connections
      );
      
      // If still no results, fall back to recent memory
      if (allSimilarChunks.length === 0) {
        return this.handleNoResults(query, store.chunks, maxResults, useRAG);
      }
      
      // Categorize results by relevance
      const { highlyRelevant, moderatelyRelevant, somewhatRelevant } = 
        retrievalService.categorizeByRelevance(allSimilarChunks, minScore);
      
      // Select best chunks based on relevance tiers
      const { selectedChunks, relevanceLevel } = this.selectBestChunks(
        highlyRelevant,
        moderatelyRelevant,
        somewhatRelevant,
        maxResults
      );
      
      const relevantChunks = selectedChunks.map(result => result.content);
      const contextContent = relevantChunks.map(chunk => chunk.content).join('\n\n---\n\n');
      
      // Generate RAG response if requested
      if (useRAG && relevantChunks.length > 0) {
        return this.generateRAGResponse(
          query,
          contextContent,
          relevantChunks,
          relevanceLevel,
          selectedChunks[0]?.score || 0
        );
      }
      
      // Return context without RAG
      return {
        success: true,
        content: `Found ${relevanceLevel} memory context (${relevantChunks.length} chunks, similarity: ${selectedChunks[0]?.score.toFixed(3) || 'N/A'}):\n\n${contextContent}`,
        size: contextContent.length,
        relevantChunks
      };
    } catch (error) {
      logError("RAGMemoryService.loadMemory", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error loading memory'
      };
    }
  }

  /**
   * Get recent chunks sorted by timestamp
   */
  private getRecentChunks(chunks: MemoryChunk[], limit: number): MemoryChunk[] {
    return chunks
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, Math.min(limit * 2, chunks.length));
  }

  /**
   * Handle case when no similar chunks are found
   */
  private async handleNoResults(
    query: string,
    chunks: MemoryChunk[],
    maxResults: number,
    useRAG: boolean
  ): Promise<MemoryResult> {
    const fallbackChunks = this.getRecentChunks(chunks, maxResults);
    const fallbackContent = fallbackChunks.map(chunk => chunk.content).join('\n\n---\n\n');
    
    if (useRAG && fallbackChunks.length > 0) {
      try {
        const systemPrompt = `You are an AI assistant with access to memory context. The user asked: "${query}"

While no directly relevant memory was found, here is the most recent context available. Try to find any possible connections or provide helpful context based on what's available, even if indirect.

INSTRUCTIONS:
1. Look for any potential connections to the user's query, even indirect ones
2. If no connections exist, explain what information IS available in memory
3. Be helpful by suggesting what might be related or useful from the available context
4. Always acknowledge that this is the best available context, not a direct match

Available Memory Context:
${fallbackContent}

User Query: ${query}`;
        
        const generatedResponse = await aiService.queryLLM(query, systemPrompt);
        return {
          success: true,
          content: generatedResponse,
          size: generatedResponse.length,
          relevantChunks: fallbackChunks,
          generatedResponse
        };
      } catch (error) {
        logError("RAGMemoryService.loadMemory.fallback", error);
      }
    }
    
    return {
      success: true,
      content: `No directly relevant memory found for: "${query}". However, here is the most recent available context that might contain related information:\n\n${fallbackContent}`,
      size: fallbackContent.length,
      relevantChunks: fallbackChunks
    };
  }

  /**
   * Select best chunks from relevance tiers
   */
  private selectBestChunks(
    highlyRelevant: Array<{ content: MemoryChunk; score: number }>,
    moderatelyRelevant: Array<{ content: MemoryChunk; score: number }>,
    somewhatRelevant: Array<{ content: MemoryChunk; score: number }>,
    maxResults: number
  ): { selectedChunks: Array<{ content: MemoryChunk; score: number }>; relevanceLevel: string } {
    let selectedChunks: Array<{ content: MemoryChunk; score: number }> = [];
    let relevanceLevel = "highly relevant";
    
    if (highlyRelevant.length > 0) {
      selectedChunks = retrievalService.applySemanticFirewall(highlyRelevant).slice(0, maxResults);
      relevanceLevel = "highly relevant";
    } else if (moderatelyRelevant.length > 0) {
      selectedChunks = retrievalService.applySemanticFirewall(moderatelyRelevant).slice(0, maxResults);
      relevanceLevel = "moderately relevant";
    } else {
      selectedChunks = retrievalService.applySemanticFirewall(somewhatRelevant).slice(0, maxResults);
      relevanceLevel = "potentially related";
    }

    return { selectedChunks, relevanceLevel };
  }

  /**
   * Generate RAG response with context
   */
  private async generateRAGResponse(
    query: string,
    contextContent: string,
    relevantChunks: MemoryChunk[],
    relevanceLevel: string,
    topScore: number
  ): Promise<MemoryResult> {
    try {
      const systemPrompt = `You are an AI assistant with access to memory context from previous conversations and sessions. 

The user asked: "${query}"

The following memory context was found with ${relevanceLevel} similarity (similarity score: ${topScore.toFixed(3)}):

INSTRUCTIONS:
1. If the context is highly relevant, answer directly from the memory
2. If the context is moderately relevant, explain the connection and provide what information is available
3. If the context is potentially related, acknowledge the indirect connection and explain what related information exists
4. Always be helpful and find meaningful connections where possible
5. Don't claim information that isn't in the context, but do explain relationships and connections

Memory Context:
${contextContent}

User Query: ${query}`;
      
      const generatedResponse = await aiService.queryLLM(query, systemPrompt);
      
      return {
        success: true,
        content: generatedResponse,
        size: generatedResponse.length,
        relevantChunks,
        generatedResponse
      };
    } catch (error) {
      logError("RAGMemoryService.loadMemory.generateResponse", error);
      
      // Fall back to context content with relevance indication
      const fallbackResponse = `Found ${relevanceLevel} memory context (${relevantChunks.length} chunks, similarity: ${topScore.toFixed(3)}):\n\n${contextContent}`;
      
      return {
        success: true,
        content: fallbackResponse,
        size: fallbackResponse.length,
        relevantChunks
      };
    }
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(workspaceRoot: string): Promise<{
    totalChunks: number;
    totalSize: number;
    lastUpdated: string;
    version: string;
  }> {
    try {
      const store = await memoryStoreService.loadMemoryStore(workspaceRoot);
      const totalSize = store.chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
      
      return {
        totalChunks: store.totalChunks,
        totalSize,
        lastUpdated: store.lastUpdated,
        version: store.version
      };
    } catch (error) {
      return {
        totalChunks: 0,
        totalSize: 0,
        lastUpdated: new Date().toISOString(),
        version: "1.0.0"
      };
    }
  }

  /**
   * Clear all memory
   */
  async clearMemory(workspaceRoot: string): Promise<MemoryResult> {
    try {
      const emptyStore = {
        chunks: [],
        version: "1.0.0",
        lastUpdated: new Date().toISOString(),
        totalChunks: 0
      };
      
      await memoryStoreService.saveMemoryStore(workspaceRoot, emptyStore);
      
      return {
        success: true,
        content: "Memory cleared successfully",
        size: 0
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error clearing memory'
      };
    }
  }
}

// Export singleton instance
export const ragMemoryService = new RAGMemoryService();
