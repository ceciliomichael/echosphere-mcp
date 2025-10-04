/**
 * RAG Memory Service Configuration Constants
 * Centralized configuration for chunking and similarity thresholds
 */

/**
 * Maximum characters per chunk for embedding quality
 * Trade-off: Larger chunks = more context but worse precision
 */
export const CHUNK_SIZE = parseInt(process.env.RAG_CHUNK_SIZE || '800', 10);

/**
 * Overlap between consecutive chunks to preserve context at boundaries
 * Recommended: 10-20% of CHUNK_SIZE
 */
export const CHUNK_OVERLAP = parseInt(process.env.RAG_CHUNK_OVERLAP || '120', 10);

/**
 * Cosine similarity threshold for detecting near-duplicate chunks
 * Range: 0.0-1.0, higher = stricter deduplication
 */
export const SIMILARITY_DEDUP_THRESHOLD = parseFloat(
  process.env.RAG_SIMILARITY_THRESHOLD || '0.95'
);

/**
 * Maximum file size in bytes (256 KB per file)
 */
export const MAX_FILE_SIZE_BYTES = parseInt(
  process.env.MAX_FILE_SIZE_BYTES || '262144',
  10
);

/**
 * Maximum total response size in bytes (2 MB)
 */
export const MAX_RESPONSE_SIZE_BYTES = parseInt(
  process.env.MAX_RESPONSE_SIZE_BYTES || '2097152',
  10
);

