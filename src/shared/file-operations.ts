/**
 * Shared file operation utilities for the Echosphere MCP server
 */

import { promises as fs } from "fs";
import path from "path";
import type { FileResult, MoveFileResult, RenameFileResult } from "./types.js";

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

/**
 * Moves a file from source to target location within the workspace
 */
export async function moveFile(
  workspaceRoot: string,
  sourceRelativePath: string,
  targetRelativePath: string
): Promise<MoveFileResult> {
  try {
    const sourcePath = path.resolve(workspaceRoot, sourceRelativePath);
    const targetPath = path.resolve(workspaceRoot, targetRelativePath);
    
    // Ensure source file exists
    const sourceStats = await fs.stat(sourcePath);
    if (!sourceStats.isFile()) {
      return {
        sourceRelativePath,
        targetRelativePath,
        success: false,
        error: `Source "${sourceRelativePath}" is not a file`
      };
    }
    
    // Create target directory if it doesn't exist
    const targetDir = path.dirname(targetPath);
    await fs.mkdir(targetDir, { recursive: true });
    
    // Check if target already exists
    try {
      await fs.stat(targetPath);
      return {
        sourceRelativePath,
        targetRelativePath,
        success: false,
        error: `Target file "${targetRelativePath}" already exists`
      };
    } catch {
      // Target doesn't exist, which is what we want
    }
    
    // Move the file
    await fs.rename(sourcePath, targetPath);
    
    return {
      sourceRelativePath,
      targetRelativePath,
      success: true
    };
  } catch (error) {
    return {
      sourceRelativePath,
      targetRelativePath,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Renames a file within the same directory
 */
export async function renameFile(
  workspaceRoot: string,
  originalRelativePath: string,
  newName: string
): Promise<RenameFileResult> {
  try {
    const originalPath = path.resolve(workspaceRoot, originalRelativePath);
    const originalDir = path.dirname(originalPath);
    const newPath = path.join(originalDir, newName);
    const newRelativePath = path.relative(workspaceRoot, newPath);
    
    // Ensure source file exists
    const sourceStats = await fs.stat(originalPath);
    if (!sourceStats.isFile()) {
      return {
        originalRelativePath,
        newRelativePath,
        success: false,
        error: `File "${originalRelativePath}" does not exist or is not a file`
      };
    }
    
    // Check if target already exists
    try {
      await fs.stat(newPath);
      return {
        originalRelativePath,
        newRelativePath,
        success: false,
        error: `File "${newRelativePath}" already exists`
      };
    } catch {
      // Target doesn't exist, which is what we want
    }
    
    // Rename the file
    await fs.rename(originalPath, newPath);
    
    return {
      originalRelativePath,
      newRelativePath,
      success: true
    };
  } catch (error) {
    return {
      originalRelativePath,
      newRelativePath: path.join(path.dirname(originalRelativePath), newName),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
