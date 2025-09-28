/**
 * RAG Memory Service for Echosphere MCP Server
 * Provides vector-based memory storage and retrieval with embeddings
 */

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { aiService, findSimilarEmbeddings, cosineSimilarity } from "./ai-service.js";
import type { MemoryChunk, MemoryStore, MemoryResult, SimilarityResult } from "../shared/types.js";

export class RAGMemoryService {
  private readonly MEMORY_DIR = ".memory";
  private readonly MEMORY_FILE = "memory.json";
  private readonly CHUNK_SIZE = 800; // Maximum characters per chunk (more conservative for better embedding quality)
  private readonly CHUNK_OVERLAP = 120; // Overlap between chunks (15% of chunk size)
  private readonly SIMILARITY_DEDUP_THRESHOLD = 0.95; // Threshold for near-duplicate detection

  /**
   * Generate content hash for deduplication
   */
  private generateContentHash(content: string): string {
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
  private isDuplicate(newChunk: { content: string; contentHash: string; embedding?: number[] }, existingChunks: MemoryChunk[], docId?: string): boolean {
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
        if (similarity >= this.SIMILARITY_DEDUP_THRESHOLD) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Load memory store from disk
   */
  private async loadMemoryStore(workspaceRoot: string): Promise<MemoryStore> {
    const memoryPath = path.resolve(workspaceRoot, this.MEMORY_DIR, this.MEMORY_FILE);
    
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
  private async saveMemoryStore(workspaceRoot: string, store: MemoryStore): Promise<void> {
    const memoryDir = path.resolve(workspaceRoot, this.MEMORY_DIR);
    const memoryPath = path.join(memoryDir, this.MEMORY_FILE);
    
    // Ensure memory directory exists
    await fs.mkdir(memoryDir, { recursive: true });
    
    // Update metadata
    store.lastUpdated = new Date().toISOString();
    store.totalChunks = store.chunks.length;
    
    // Save to disk
    await fs.writeFile(memoryPath, JSON.stringify(store, null, 2), 'utf-8');
  }

  /**
   * Split text into chunks with intelligent boundary detection
   */
  private splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    
    // First try to split by paragraphs (double newlines)
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    let currentChunk = "";
    
    for (const paragraph of paragraphs) {
      const paragraphTrimmed = paragraph.trim();
      
      // If adding this paragraph would exceed chunk size
      if (currentChunk.length + paragraphTrimmed.length + 2 > this.CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        
        // Start new chunk with overlap from previous chunk
        const overlapText = this.getOverlapText(currentChunk);
        currentChunk = overlapText + (overlapText ? "\n\n" : "") + paragraphTrimmed;
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + paragraphTrimmed;
      }
      
      // If current paragraph itself is too large, split it by sentences
      if (currentChunk.length > this.CHUNK_SIZE) {
        const splitChunks = this.splitLargeParagraph(currentChunk);
        chunks.push(...splitChunks.slice(0, -1)); // Add all but the last chunk
        currentChunk = splitChunks[splitChunks.length - 1] || ""; // Keep the last chunk as current
      }
    }
    
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    // Fallback: if no paragraphs found, split by character count
    if (chunks.length === 0 && text.length > 0) {
      for (let i = 0; i < text.length; i += this.CHUNK_SIZE - this.CHUNK_OVERLAP) {
        const end = Math.min(i + this.CHUNK_SIZE, text.length);
        const chunk = text.slice(i, end);
        chunks.push(chunk);
      }
    }
    
    return chunks.filter(chunk => chunk.trim().length > 0);
  }

  /**
   * Get overlap text from the end of a chunk
   */
  private getOverlapText(chunk: string): string {
    if (chunk.length <= this.CHUNK_OVERLAP) {
      return chunk;
    }
    
    const overlapCandidate = chunk.slice(-this.CHUNK_OVERLAP);
    
    // Try to find a good boundary (sentence or line break)
    const sentenceMatch = overlapCandidate.match(/[.!?]\s+(.*)$/);
    if (sentenceMatch && sentenceMatch[1].length > 20) {
      return sentenceMatch[1];
    }
    
    const lineMatch = overlapCandidate.match(/\n(.*)$/);
    if (lineMatch && lineMatch[1].length > 20) {
      return lineMatch[1];
    }
    
    // Fallback to word boundary
    const words = overlapCandidate.split(' ');
    const wordOverlap = words.slice(Math.max(0, words.length - 15)).join(' ');
    return wordOverlap;
  }

  /**
   * Split a large paragraph by sentences
   */
  private splitLargeParagraph(paragraph: string): string[] {
    const chunks: string[] = [];
    const sentences = paragraph.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    
    let currentChunk = "";
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length + 1 > this.CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        
        const overlapText = this.getOverlapText(currentChunk);
        currentChunk = overlapText + (overlapText ? " " : "") + sentence;
      } else {
        currentChunk += (currentChunk ? " " : "") + sentence;
      }
    }
    
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

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
      const store = await this.loadMemoryStore(workspaceRoot);
      
      // If not appending and docId is provided, remove existing chunks for this docId
      if (!append && docId) {
        store.chunks = store.chunks.filter(chunk => chunk.docId !== docId);
      } else if (!append) {
        // Clear all existing memory if not appending and no docId
        store.chunks = [];
      }
      
      // Split content into chunks
      const textChunks = this.splitIntoChunks(content);
      
      if (textChunks.length === 0) {
        return {
          success: false,
          error: "No content to save"
        };
      }
      
      // Generate embeddings for all chunks
      console.error(`Generating embeddings for ${textChunks.length} chunks...`);
      const embeddings = await aiService.generateEmbeddings(textChunks);
      
      // Get current embedding model info
      const embeddingModel = process.env.AI_EMBEDDING_MODEL || "mistral-embed";
      
      // Create memory chunks with deduplication
      const newChunks: MemoryChunk[] = [];
      let duplicatesSkipped = 0;
      
      for (let index = 0; index < textChunks.length; index++) {
        const chunk = textChunks[index];
        const embedding = embeddings[index];
        const contentHash = this.generateContentHash(chunk);
        
        const candidateChunk = {
          content: chunk,
          contentHash,
          embedding
        };
        
        // Check for duplicates
        if (this.isDuplicate(candidateChunk, store.chunks, docId)) {
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
      await this.saveMemoryStore(workspaceRoot, store);
      
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
      console.error("Error saving memory:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error saving memory'
      };
    }
  }

  /**
   * Apply semantic firewall to prevent conflicting evidence
   */
  private applySemanticFirewall(chunks: Array<{ content: MemoryChunk; score: number }>): Array<{ content: MemoryChunk; score: number }> {
    if (chunks.length === 0) return chunks;
    
    // Group chunks by docId
    const chunksByDocId = new Map<string, Array<{ content: MemoryChunk; score: number }>>();
    const orphanChunks: Array<{ content: MemoryChunk; score: number }> = [];
    
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
    
    const filteredChunks: Array<{ content: MemoryChunk; score: number }> = [];
    
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
  private calculateDynamicThreshold(scores: number[], minScore: number): number {
    if (scores.length === 0) return minScore;
    
    const topScore = scores[0];
    
    // Use dynamic threshold: minimum of provided minScore or 80% of top score
    const dynamicThreshold = Math.max(minScore, topScore * 0.8);
    
    // But don't go below 0.2 (too permissive) or above 0.7 (too restrictive)
    return Math.max(0.2, Math.min(0.7, dynamicThreshold));
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
      const store = await this.loadMemoryStore(workspaceRoot);
      
      if (store.chunks.length === 0) {
        return {
          success: true,
          content: "Current memory is empty. No previous context available.",
          size: 0
        };
      }
      
      // If no query, return a summary of recent memory
      if (!query) {
        // Sort by timestamp (most recent first) and take top chunks
        const recentChunks = store.chunks
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, Math.min(10, store.chunks.length));
        
        const totalContent = recentChunks.map(chunk => chunk.content).join('\n\n---\n\n');
        return {
          success: true,
          content: `Recent memory context (${recentChunks.length} chunks):\n\n${totalContent}`,
          size: totalContent.length,
          relevantChunks: recentChunks
        };
      }
      
      // Generate embedding for query
      console.error(`Searching memory with query: "${query}"`);
      const queryEmbedding = await aiService.generateEmbedding(query);
      
      // Find similar chunks with very low threshold to always get results
      const allSimilarChunks = findSimilarEmbeddings(
        queryEmbedding,
        store.chunks.map(chunk => ({ embedding: chunk.embedding, content: chunk })),
        Math.min(maxResults * 4, 20), // Get more candidates for better selection
        0.05 // Very low threshold to capture any potential connections
      );
      
      // If still no results, fall back to recent memory
      if (allSimilarChunks.length === 0) {
        const fallbackChunks = store.chunks
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, Math.min(maxResults, store.chunks.length));
        
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
            console.error("Error generating fallback RAG response:", error);
          }
        }
        
        return {
          success: true,
          content: `No directly relevant memory found for: "${query}". However, here is the most recent available context that might contain related information:\n\n${fallbackContent}`,
          size: fallbackContent.length,
          relevantChunks: fallbackChunks
        };
      }
      
      // Separate results into different relevance tiers
      const scores = allSimilarChunks.map(chunk => chunk.score);
      const maxScore = Math.max(...scores);
      
      // Define flexible relevance tiers
      const highlyRelevant = allSimilarChunks.filter(chunk => chunk.score >= Math.max(minScore, maxScore * 0.7));
      const moderatelyRelevant = allSimilarChunks.filter(chunk => 
        chunk.score >= Math.max(0.15, maxScore * 0.4) && chunk.score < Math.max(minScore, maxScore * 0.7)
      );
      const somewhatRelevant = allSimilarChunks.filter(chunk => 
        chunk.score >= 0.05 && chunk.score < Math.max(0.15, maxScore * 0.4)
      );
      
      // Always provide results, starting with most relevant
      let selectedChunks: Array<{ content: MemoryChunk; score: number }> = [];
      let relevanceLevel = "highly relevant";
      
      if (highlyRelevant.length > 0) {
        selectedChunks = this.applySemanticFirewall(highlyRelevant).slice(0, maxResults);
        relevanceLevel = "highly relevant";
      } else if (moderatelyRelevant.length > 0) {
        selectedChunks = this.applySemanticFirewall(moderatelyRelevant).slice(0, maxResults);
        relevanceLevel = "moderately relevant";
      } else {
        selectedChunks = this.applySemanticFirewall(somewhatRelevant).slice(0, maxResults);
        relevanceLevel = "potentially related";
      }
      
      const relevantChunks = selectedChunks.map(result => result.content);
      const contextContent = relevantChunks.map(chunk => chunk.content).join('\n\n---\n\n');
      
      let response = contextContent;
      let generatedResponse: string | undefined;
      
      // Use RAG to generate a response with relevance awareness
      if (useRAG && relevantChunks.length > 0) {
        try {
          const systemPrompt = `You are an AI assistant with access to memory context from previous conversations and sessions. 

The user asked: "${query}"

The following memory context was found with ${relevanceLevel} similarity (similarity score: ${selectedChunks[0]?.score.toFixed(3) || 'N/A'}):

INSTRUCTIONS:
1. If the context is highly relevant, answer directly from the memory
2. If the context is moderately relevant, explain the connection and provide what information is available
3. If the context is potentially related, acknowledge the indirect connection and explain what related information exists
4. Always be helpful and find meaningful connections where possible
5. Don't claim information that isn't in the context, but do explain relationships and connections

Memory Context:
${contextContent}

User Query: ${query}`;
          
          generatedResponse = await aiService.queryLLM(query, systemPrompt);
          response = generatedResponse;
        } catch (error) {
          console.error("Error generating RAG response:", error);
          // Fall back to context content with relevance indication
          response = `Found ${relevanceLevel} memory context (${relevantChunks.length} chunks, similarity: ${selectedChunks[0]?.score.toFixed(3) || 'N/A'}):\n\n${contextContent}`;
        }
      }
      
      return {
        success: true,
        content: response,
        size: response.length,
        relevantChunks,
        generatedResponse
      };
    } catch (error) {
      console.error("Error loading memory:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error loading memory'
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
      const store = await this.loadMemoryStore(workspaceRoot);
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
      const emptyStore: MemoryStore = {
        chunks: [],
        version: "1.0.0",
        lastUpdated: new Date().toISOString(),
        totalChunks: 0
      };
      
      await this.saveMemoryStore(workspaceRoot, emptyStore);
      
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
