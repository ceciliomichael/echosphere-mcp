/**
 * Shared file operation utilities for the Echosphere MCP server
 */

import { promises as fs } from "fs";
import path from "path";
import type { FileResult, MoveFileResult, RenameFileResult, MemoryResult } from "./types.js";

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

/**
 * Loads memory from .memory/memory.json file with optional query functionality
 */
export async function loadMemory(workspaceRoot: string, query?: string): Promise<MemoryResult> {
  try {
    const memoryDir = path.resolve(workspaceRoot, '.memory');
    const memoryPath = path.join(memoryDir, 'memory.json');
    
    // Check if memory file exists
    try {
      await fs.stat(memoryPath);
    } catch {
      // Memory file doesn't exist, create empty one
      await fs.mkdir(memoryDir, { recursive: true });
      await fs.writeFile(memoryPath, JSON.stringify({}), 'utf-8');
      
      return {
        success: true,
        content: "Current memory is empty",
        size: 0
      };
    }
    
    // Read the memory file
    const memoryContent = await fs.readFile(memoryPath, 'utf-8');
    
    if (!memoryContent.trim()) {
      return {
        success: true,
        content: "Current memory is empty",
        size: 0
      };
    }
    
    // If no query provided, return entire memory
    if (!query) {
      return {
        success: true,
        content: memoryContent,
        size: memoryContent.length
      };
    }
    
    // Try to parse as JSON and search within it
    try {
      const memoryData = JSON.parse(memoryContent);
      
      // Search for query in the JSON data
      const searchResults = searchInObject(memoryData, query.toLowerCase());
      
      if (searchResults.length === 0) {
        return {
          success: true,
          content: `No results found for query: "${query}"`,
          size: 0
        };
      }
      
      return {
        success: true,
        content: JSON.stringify(searchResults, null, 2),
        size: JSON.stringify(searchResults).length
      };
    } catch {
      // If not valid JSON, search as plain text
      const lines = memoryContent.split('\n');
      const matchingLines = lines.filter(line => 
        line.toLowerCase().includes(query.toLowerCase())
      );
      
      if (matchingLines.length === 0) {
        return {
          success: true,
          content: `No results found for query: "${query}"`,
          size: 0
        };
      }
      
      const result = matchingLines.join('\n');
      return {
        success: true,
        content: result,
        size: result.length
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error loading memory'
    };
  }
}

/**
 * Saves memory to .memory/memory.json file
 */
export async function saveMemory(
  workspaceRoot: string, 
  content: string, 
  append: boolean = false
): Promise<MemoryResult> {
  try {
    const memoryDir = path.resolve(workspaceRoot, '.memory');
    const memoryPath = path.join(memoryDir, 'memory.json');
    
    // Create memory directory if it doesn't exist
    await fs.mkdir(memoryDir, { recursive: true });
    
    let finalContent = content;
    
    if (append) {
      // Try to read existing memory
      try {
        const existingContent = await fs.readFile(memoryPath, 'utf-8');
        
        // Try to parse existing content as JSON
        try {
          const existingData = JSON.parse(existingContent);
          
          // Try to parse new content as JSON
          try {
            const newData = JSON.parse(content);
            
            // Merge JSON objects
            const mergedData = { ...existingData, ...newData };
            finalContent = JSON.stringify(mergedData, null, 2);
          } catch {
            // New content is not JSON, treat as text append
            finalContent = existingContent + '\n' + content;
          }
        } catch {
          // Existing content is not JSON, treat as text append
          finalContent = existingContent + '\n' + content;
        }
      } catch {
        // No existing file, use new content as-is
        finalContent = content;
      }
    }
    
    // Write the memory file
    await fs.writeFile(memoryPath, finalContent, 'utf-8');
    
    return {
      success: true,
      size: finalContent.length
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error saving memory'
    };
  }
}

/**
 * Helper function to search within a JSON object recursively
 */
function searchInObject(obj: any, query: string): any[] {
  const results: any[] = [];
  
  function search(current: any, path: string = ''): void {
    if (typeof current === 'string' && current.toLowerCase().includes(query)) {
      results.push({ path, value: current });
    } else if (typeof current === 'object' && current !== null) {
      if (Array.isArray(current)) {
        current.forEach((item, index) => {
          search(item, `${path}[${index}]`);
        });
      } else {
        Object.keys(current).forEach(key => {
          const keyMatches = key.toLowerCase().includes(query);
          const newPath = path ? `${path}.${key}` : key;
          
          if (keyMatches) {
            results.push({ path: newPath, key, value: current[key] });
          }
          
          search(current[key], newPath);
        });
      }
    }
  }
  
  search(obj);
  return results;
}
