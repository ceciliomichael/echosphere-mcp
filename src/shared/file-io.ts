/**
 * Core file I/O utilities for reading files and directories
 */

import { promises as fs } from "fs";
import path from "path";
import type { FileResult } from "./types.js";

/**
 * Reads a single file and returns its content with metadata
 */
export async function readSingleFile(filePath: string): Promise<FileResult> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const stats = await fs.stat(filePath);
    
    return {
      path: filePath,
      content,
      size: stats.size
    };
  } catch (error) {
    throw new Error(`Failed to read file "${filePath}": ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Reads all files in a directory (recursive)
 */
export async function readDirectoryFiles(dirPath: string, workspaceRoot: string): Promise<FileResult[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const results: FileResult[] = [];
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isFile()) {
        try {
          const fileResult = await readSingleFile(fullPath);
          // Convert absolute path to relative path for display
          const relativePath = path.relative(workspaceRoot, fileResult.path);
          results.push({
            ...fileResult,
            path: relativePath
          });
        } catch (error) {
          const relativePath = path.relative(workspaceRoot, fullPath);
          results.push({
            path: relativePath,
            content: '',
            size: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      } else if (entry.isDirectory()) {
        // Recursively read subdirectories
        try {
          const subDirResults = await readDirectoryFiles(fullPath, workspaceRoot);
          results.push(...subDirResults);
        } catch (error) {
          // If we can't read a subdirectory, add an error entry
          const relativePath = path.relative(workspaceRoot, fullPath);
          results.push({
            path: relativePath,
            content: '',
            size: 0,
            error: `Cannot read directory: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }
    }
    
    return results;
  } catch (error) {
    throw new Error(`Failed to read directory "${dirPath}": ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

