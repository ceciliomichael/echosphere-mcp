/**
 * AI Service for Echosphere MCP Server
 * Provides embedding generation and LLM query capabilities
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import type { ChatMessage } from "../shared/chat-types.js";
import { logError } from "../utils/logger.js";
import { cosineSimilarity } from "../utils/vector-math.js";
import { MinHeap } from "../utils/min-heap.js";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, "../../.env") });

export interface EmbeddingResponse {
  data: Array<{
    object: "embedding";
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface ChatResponse {
  choices: Array<{
    message: {
      role: "assistant";
      content: string;
    };
    finish_reason: string;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class AIService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly embeddingModel: string;

  constructor() {
    this.baseUrl = process.env.AI_BASE_URL || "https://ai.echosphere.cfd/v1";
    this.model = process.env.AI_MODEL || "mistral-small-latest";
    this.embeddingModel = process.env.AI_EMBEDDING_MODEL || "mistral-embed";

    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      throw new Error("AI_API_KEY is required in environment variables. Please set AI_API_KEY in your .env file.");
    }
    this.apiKey = apiKey;
  }

  /**
   * Generate embeddings for text content
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: text,
          encoding_format: "float"
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Embedding API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data: EmbeddingResponse = await response.json();
      
      if (!data.data || data.data.length === 0) {
        throw new Error("No embedding data received from API");
      }

      return data.data[0].embedding;
    } catch (error) {
      logError("AIService.generateEmbedding", error, { status: error instanceof Error && 'status' in error ? (error as any).status : undefined });
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: texts,
          encoding_format: "float"
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Embedding API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data: EmbeddingResponse = await response.json();
      
      if (!data.data || data.data.length === 0) {
        throw new Error("No embedding data received from API");
      }

      // Sort by index to maintain order
      return data.data
        .sort((a, b) => a.index - b.index)
        .map(item => item.embedding);
    } catch (error) {
      logError("AIService.generateEmbeddings", error, { batchSize: texts.length });
      throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Query the LLM with a prompt
   */
  async queryLLM(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      const messages: ChatMessage[] = [];
      
      if (systemPrompt) {
        messages.push({
          role: "system",
          content: systemPrompt
        });
      }
      
      messages.push({
        role: "user",
        content: prompt
      });

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.1, // Lower temperature for more consistent, factual responses
          max_tokens: 4000 // Increased token limit for much longer context responses
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Chat API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data: ChatResponse = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error("No response received from LLM");
      }

      return data.choices[0].message.content;
    } catch (error) {
      logError("AIService.queryLLM", error);
      throw new Error(`Failed to query LLM: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Find the most similar embeddings to a query embedding using efficient top-K selection
 */
export function findSimilarEmbeddings(
  queryEmbedding: number[],
  embeddings: Array<{ embedding: number[]; content: any; score?: number }>,
  topK: number = 5,
  threshold: number = 0.1
): Array<{ embedding: number[]; content: any; score: number }> {
  // Use min-heap for efficient top-K selection (O(n log k) instead of O(n log n))
  const heap = new MinHeap<{ embedding: number[]; content: any; score: number }>(
    (a, b) => a.score - b.score
  );

  // Process each embedding and maintain top-K in heap
  for (const item of embeddings) {
    const score = cosineSimilarity(queryEmbedding, item.embedding);
    if (score >= threshold) {
      heap.push({ ...item, score }, topK);
    }
  }

  // Return sorted results (highest score first)
  return heap.toSortedArray();
}

// Export singleton instance
export const aiService = new AIService();
