/**
 * Shared validation utilities for the Echosphere MCP server
 */

import path from "path";
import { promises as fs } from "fs";
import type { PathType } from "./types.js";

/**
 * Validates and normalizes file paths to prevent directory traversal attacks
 */
export function validateAndNormalizePath(workspaceRoot: string, relativePath: string): string {
  // Normalize the workspace root
  const normalizedRoot = path.resolve(workspaceRoot);
  
  // Normalize path separators for cross-platform compatibility
  const normalizedRelativePath = path.normalize(relativePath);
  
  // Normalize the relative path and resolve it against the workspace root
  const resolvedPath = path.resolve(normalizedRoot, normalizedRelativePath);
  
  // Ensure the resolved path is within the workspace root
  if (!resolvedPath.startsWith(normalizedRoot + path.sep) && resolvedPath !== normalizedRoot) {
    throw new Error(`Access denied: Path "${relativePath}" is outside the workspace root`);
  }
  
  return resolvedPath;
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
