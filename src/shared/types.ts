/**
 * Common types used across the Echosphere MCP server
 */

export interface FileResult {
  path: string;
  content: string;
  size: number;
  error?: string;
}

export interface SingleFileResponse {
  type: 'single_file';
  file: {
    path: string;
    size: number;
    content: string;
  };
}

export interface MultipleFilesResponse {
  type: 'multiple_files';
  files: FileResult[];
  directory: string;
  totalFiles: number;
}

export type PathType = 'file' | 'directory' | 'not_found';

export interface ToolResponse {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface MoveFileResult {
  sourceRelativePath: string;
  targetRelativePath: string;
  success: boolean;
  error?: string;
}

export interface RenameFileResult {
  originalRelativePath: string;
  newRelativePath: string;
  success: boolean;
  error?: string;
}

export interface MemoryResult {
  success: boolean;
  content?: string;
  size?: number;
  error?: string;
  relevantChunks?: MemoryChunk[];
  generatedResponse?: string;
}

export interface MemoryChunk {
  id: string;
  content: string;
  embedding: number[];
  timestamp: string;
  metadata?: Record<string, any>;
  tags?: string[];
  docId?: string;
  source?: string;
  contentHash: string;
  chunkIndex: number;
  chunkCount: number;
  embeddingModel: string;
}

export interface MemoryStore {
  chunks: MemoryChunk[];
  version: string;
  lastUpdated: string;
  totalChunks: number;
}

export interface SimilarityResult {
  chunk: MemoryChunk;
  score: number;
}