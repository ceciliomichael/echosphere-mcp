/**
 * Shared validation utilities for the Echosphere MCP server
 */

import path from "path";
import { promises as fs } from "fs";
import type { PathType } from "./types.js";

/**
 * Validates and normalizes file paths to prevent directory traversal attacks
 * Uses realpath resolution to handle symlinks and case-sensitivity issues
 */
export async function validateAndNormalizePath(workspaceRoot: string, relativePath: string): Promise<string> {
  // Normalize path separators for cross-platform compatibility
  const normalizedRelativePath = path.normalize(relativePath);
  
  // Normalize the relative path and resolve it against the workspace root
  const resolvedPath = path.resolve(workspaceRoot, normalizedRelativePath);
  
  try {
    // Resolve real paths to handle symlinks
    const realWorkspaceRoot = await fs.realpath(workspaceRoot);
    
    // Check if the target path exists before realpath resolution
    let realResolvedPath: string;
    try {
      realResolvedPath = await fs.realpath(resolvedPath);
    } catch {
      // If path doesn't exist yet, verify parent directory is within workspace
      const parentDir = path.dirname(resolvedPath);
      try {
        const realParentPath = await fs.realpath(parentDir);
        const relativeToRoot = path.relative(realWorkspaceRoot, realParentPath);
        
        if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
          throw new Error(`Access denied: Path "${relativePath}" is outside the workspace root`);
        }
        
        // Return the resolved path with the original filename
        return path.join(realParentPath, path.basename(resolvedPath));
      } catch {
        // Parent doesn't exist either, fall back to validation without realpath
        const normalizedRoot = path.resolve(workspaceRoot);
        const relativeToRoot = path.relative(normalizedRoot, resolvedPath);
        
        if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
          throw new Error(`Access denied: Path "${relativePath}" is outside the workspace root`);
        }
        
        return resolvedPath;
      }
    }
    
    // Use path.relative to ensure the resolved path is within the workspace
    const relativeToRoot = path.relative(realWorkspaceRoot, realResolvedPath);
    
    // Check if path escapes workspace using .. or is an absolute path
    if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
      throw new Error(`Access denied: Path "${relativePath}" is outside the workspace root`);
    }
    
    // On Windows, perform case-insensitive validation
    if (process.platform === 'win32') {
      const normalizedRealRoot = realWorkspaceRoot.toLowerCase();
      const normalizedRealPath = realResolvedPath.toLowerCase();
      
      if (!normalizedRealPath.startsWith(normalizedRealRoot + path.sep) && 
          normalizedRealPath !== normalizedRealRoot) {
        throw new Error(`Access denied: Path "${relativePath}" is outside the workspace root`);
      }
    }
    
    return realResolvedPath;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Access denied')) {
      throw error;
    }
    // Re-throw filesystem errors
    throw new Error(`Path validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Checks if a path is a file or directory
 */
export async function getPathType(filePath: string): Promise<PathType> {
  try {
    const stats = await fs.stat(filePath);
    return stats.isDirectory() ? 'directory' : 'file';
  } catch (error) {
    return 'not_found';
  }
}

/**
 * Validates that a workspace root exists and is a directory
 */
export async function validateWorkspaceRoot(workspaceRoot: string): Promise<void> {
  const workspaceType = await getPathType(workspaceRoot);
  
  if (workspaceType === 'not_found') {
    throw new Error(`Workspace root "${workspaceRoot}" does not exist`);
  }
  
  if (workspaceType !== 'directory') {
    throw new Error(`Workspace root "${workspaceRoot}" is not a directory`);
  }
}
