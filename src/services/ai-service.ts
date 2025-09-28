/**
 * AI Service for Echosphere MCP Server
 * Provides embedding generation and LLM query capabilities
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

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
    this.apiKey = process.env.AI_API_KEY || "";
    this.model = process.env.AI_MODEL || "mistral-small-latest";
    this.embeddingModel = process.env.AI_EMBEDDING_MODEL || "mistral-embed";

    if (!this.apiKey) {
      throw new Error("AI_API_KEY is required in environment variables");
    }
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
      console.error("Error generating embedding:", error);
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
      console.error("Error generating embeddings:", error);
      throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Query the LLM with a prompt
   */
  async queryLLM(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      const messages = [];
      
      if (systemPrompt) {
        messages.push({
          role: "system" as const,
          content: systemPrompt
        });
      }
      
      messages.push({
        role: "user" as const,
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
      console.error("Error querying LLM:", error);
      throw new Error(`Failed to query LLM: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Find the most similar embeddings to a query embedding
 */
export function findSimilarEmbeddings(
  queryEmbedding: number[],
  embeddings: Array<{ embedding: number[]; content: any; score?: number }>,
  topK: number = 5,
  threshold: number = 0.1
): Array<{ embedding: number[]; content: any; score: number }> {
  // Calculate similarities
  const withScores = embeddings.map(item => ({
    ...item,
    score: cosineSimilarity(queryEmbedding, item.embedding)
  }));

  // Filter by threshold and sort by similarity
  return withScores
    .filter(item => item.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// Export singleton instance
export const aiService = new AIService();
