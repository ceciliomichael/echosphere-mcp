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
