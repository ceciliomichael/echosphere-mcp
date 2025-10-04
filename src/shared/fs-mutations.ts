/**
 * File system mutation utilities for moving and renaming files
 */

import { promises as fs } from "fs";
import path from "path";
import type { MoveFileResult, RenameFileResult } from "./types.js";

/**
 * Moves a file from source to target location within the workspace
 */
export async function moveFile(
  workspaceRoot: string,
  sourceRelativePath: string,
  targetRelativePath: string
): Promise<MoveFileResult> {
  const sourcePath = path.resolve(workspaceRoot, sourceRelativePath);
  const targetPath = path.resolve(workspaceRoot, targetRelativePath);
  
  // Store source stats for verification later
  let sourceStats;
  try {
    // Ensure source file exists
    sourceStats = await fs.stat(sourcePath);
    if (!sourceStats.isFile()) {
      return {
        sourceRelativePath,
        targetRelativePath,
        success: false,
        error: `Source "${sourceRelativePath}" is not a file`
      };
    }
  } catch (error) {
    return {
      sourceRelativePath,
      targetRelativePath,
      success: false,
      error: `Source file "${sourceRelativePath}" does not exist or cannot be accessed`
    };
  }
  
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
  
  // Create target directory if it doesn't exist
  const targetDir = path.dirname(targetPath);
  try {
    await fs.mkdir(targetDir, { recursive: true });
  } catch (error) {
    return {
      sourceRelativePath,
      targetRelativePath,
      success: false,
      error: `Failed to create target directory: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
  
  // Move the file using rename (atomic operation on same filesystem)
  // If rename fails (e.g., cross-device), fall back to copy + delete
  try {
    await fs.rename(sourcePath, targetPath);
  } catch (renameError) {
    // Rename failed, try copy + delete as fallback
    try {
      await fs.copyFile(sourcePath, targetPath);
      
      // Verify the copy was successful before deleting the original
      try {
        const targetStats = await fs.stat(targetPath);
        if (targetStats.size !== sourceStats.size) {
          // Copy verification failed, clean up and return error
          await fs.unlink(targetPath).catch(() => {}); // Best effort cleanup
          return {
            sourceRelativePath,
            targetRelativePath,
            success: false,
            error: 'File copy verification failed - size mismatch'
          };
        }
      } catch (verifyError) {
        return {
          sourceRelativePath,
          targetRelativePath,
          success: false,
          error: `Failed to verify copied file: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`
        };
      }
      
      // Copy successful and verified, now delete the original
      await fs.unlink(sourcePath);
    } catch (copyError) {
      return {
        sourceRelativePath,
        targetRelativePath,
        success: false,
        error: `Failed to move file: ${copyError instanceof Error ? copyError.message : 'Unknown error'}`
      };
    }
  }
  
  // Verify source file was removed
  try {
    await fs.stat(sourcePath);
    // If we reach here, the source file still exists - this shouldn't happen
    return {
      sourceRelativePath,
      targetRelativePath,
      success: false,
      error: 'Move operation failed - source file still exists after move'
    };
  } catch {
    // Source file doesn't exist anymore, which is correct
  }
  
  return {
    sourceRelativePath,
    targetRelativePath,
    success: true
  };
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

