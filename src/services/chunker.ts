/**
 * Text Chunking Service
 * Handles intelligent text splitting with boundary detection and overlap
 */

import { CHUNK_SIZE, CHUNK_OVERLAP } from "../constants/rag-config.js";

export class TextChunker {
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;

  constructor(chunkSize: number = CHUNK_SIZE, chunkOverlap: number = CHUNK_OVERLAP) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  /**
   * Split text into chunks with intelligent boundary detection
   */
  splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    
    // First try to split by paragraphs (double newlines)
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    let currentChunk = "";
    
    for (const paragraph of paragraphs) {
      const paragraphTrimmed = paragraph.trim();
      
      // If adding this paragraph would exceed chunk size
      if (currentChunk.length + paragraphTrimmed.length + 2 > this.chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        
        // Start new chunk with overlap from previous chunk
        const overlapText = this.getOverlapText(currentChunk);
        currentChunk = overlapText + (overlapText ? "\n\n" : "") + paragraphTrimmed;
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + paragraphTrimmed;
      }
      
      // If current paragraph itself is too large, split it by sentences
      if (currentChunk.length > this.chunkSize) {
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
      for (let i = 0; i < text.length; i += this.chunkSize - this.chunkOverlap) {
        const end = Math.min(i + this.chunkSize, text.length);
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
    if (chunk.length <= this.chunkOverlap) {
      return chunk;
    }
    
    const overlapCandidate = chunk.slice(-this.chunkOverlap);
    
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
      if (currentChunk.length + sentence.length + 1 > this.chunkSize && currentChunk.length > 0) {
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
}

// Export singleton instance
export const textChunker = new TextChunker();

