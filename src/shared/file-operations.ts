/**
 * @deprecated This module combines multiple concerns and is being split for better maintainability.
 * 
 * - For file I/O operations, use: src/shared/file-io.ts
 * - For file mutations (move/rename), use: src/shared/fs-mutations.ts
 * - For memory operations, use: src/services/rag-memory-service.ts
 * 
 * This file is kept temporarily for backward compatibility.
 * All functions now re-export from their new locations.
 */

// Re-export file I/O functions
export { readSingleFile, readDirectoryFiles } from './file-io.js';

// Re-export file mutation functions
export { moveFile, renameFile } from './fs-mutations.js';

// Re-export legacy memory functions (also deprecated)
export { loadMemory, saveMemory } from './legacy-memory.js';
