/**
 * Check Structure Tool for Echosphere MCP Server
 * Displays workspace directory structure in tree format with comprehensive ignore patterns
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { validateWorkspaceRoot } from "../shared/validation.js";
import path from "path";
import { promises as fs } from "fs";
import { logError } from "../utils/logger.js";

/**
 * Schema for the check_structure tool parameters
 */
export const checkStructureSchema = {
  workspaceRoot: z.string().describe("Absolute path to the workspace root directory")
};

/**
 * Registers the check structure tool with the MCP server
 */
export function registerCheckStructureTool(server: McpServer): void {
  server.tool(
    "check_structure",
    checkStructureSchema,
    async ({ workspaceRoot }) => {
      try {
        // Validate workspace root
        await validateWorkspaceRoot(workspaceRoot);

        // Default ignore patterns for common development folders/files
        const defaultIgnorePatterns = [
          // Package managers & dependencies
          'node_modules', 'vendor', 'composer.phar', 'packages',

          // Build outputs
          'dist', 'build', 'out', 'target', 'bin', 'obj', '.output',

          // Version control
          '.git', '.svn', '.hg',

          // IDE & editors
          '.vscode', '.idea', '.vs', '.vscode-test', '.eclipse',
          '.cursorrules', '.cursor', '.cursorignore',

          // Language specific
          '__pycache__', '.pytest_cache', '.venv', 'venv', 'env',
          '.gradle', '.gradletasknamecache', 'gradlew', 'gradlew.bat',
          '.dart_tool', '.packages', '.pub-cache', '.flutter-plugins',
          '.flutter-plugins-dependencies', 'pubspec.lock',

          // Framework specific
          '.next', '.nuxt', '.turbo', '.parcel-cache', '.sass-cache',
          'coverage', '.nyc_output',

          // Temporary & cache
          'tmp', 'temp', '.tmp', '.cache', 'logs', '*.log',

          // OS specific
          '.DS_Store', 'Thumbs.db', 'desktop.ini',

          // Development tools
          '.taskmaster',

          // Project specific files
          'agents.md'
        ];

        // Read .checkignore file if it exists
        let customIgnorePatterns: string[] = [];
        const checkIgnorePath = path.join(workspaceRoot, '.checkignore');

        try {
          const checkIgnoreContent = await fs.readFile(checkIgnorePath, 'utf-8');
          customIgnorePatterns = checkIgnoreContent
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#')); // Remove empty lines and comments

        } catch {
          // .checkignore doesn't exist or can't be read, continue with defaults only
        }

        // Combine default and custom ignore patterns
        const allIgnorePatterns = [...defaultIgnorePatterns, ...customIgnorePatterns];

        // Function to check if a name should be ignored
        function shouldIgnore(name: string): boolean {
          // Normalize to lowercase for case-insensitive comparison
          const normalizedName = name.toLowerCase();
          
          return allIgnorePatterns.some(pattern => {
            const normalizedPattern = pattern.toLowerCase();
            
            // Simple pattern matching - exact match or wildcard
            if (normalizedPattern.includes('*')) {
              const regex = new RegExp('^' + normalizedPattern.replace(/\*/g, '.*') + '$');
              return regex.test(normalizedName);
            }
            return normalizedName === normalizedPattern;
          });
        }

        // Recursive function to build directory tree
        async function buildTree(dirPath: string, relativePath: string = '', indent: string = ''): Promise<string[]> {
          const lines: string[] = [];

          try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });

            // Filter out ignored entries
            const filteredEntries = entries.filter(entry => !shouldIgnore(entry.name));

            // Sort entries: directories first, then files, both alphabetically
            filteredEntries.sort((a, b) => {
              if (a.isDirectory() && !b.isDirectory()) return -1;
              if (!a.isDirectory() && b.isDirectory()) return 1;
              return a.name.localeCompare(b.name);
            });

            for (let i = 0; i < filteredEntries.length; i++) {
              const entry = filteredEntries[i];
              const isLast = i === filteredEntries.length - 1;
              const currentPath = path.join(dirPath, entry.name);
              const currentRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;

              const connector = isLast ? '└── ' : '├── ';
              const nextIndent = indent + (isLast ? '    ' : '│   ');

              if (entry.isDirectory()) {
                try {
                  const subLines = await buildTree(currentPath, currentRelativePath, nextIndent);
                  if (subLines.length === 0) {
                    lines.push(`${indent}${connector}${entry.name}/ [empty]`);
                  } else {
                    lines.push(`${indent}${connector}${entry.name}/`);
                    lines.push(...subLines);
                  }
                } catch (error) {
                  lines.push(`${indent}${connector}${entry.name}/`);
                  lines.push(`${nextIndent}Error: ${error instanceof Error ? error.message : String(error)}`);
                }
              } else {
                lines.push(`${indent}${connector}${entry.name}`);
              }
            }
          } catch (error) {
            lines.push(`${indent}Error reading directory: ${error instanceof Error ? error.message : String(error)}`);
          }

          return lines;
        }

        // Build the complete tree structure
        const projectName = path.basename(workspaceRoot);
        const treeLines = await buildTree(workspaceRoot);

        let responseText = `${projectName}/\n`;
        if (treeLines.length === 0) {
          responseText += `[empty directory]`;
        } else {
          responseText += treeLines.join('\n');
        }

        return {
          content: [{
            type: "text",
            text: responseText
          }],
          isError: false
        };

      } catch (error) {
        logError("CheckStructure.check_structure", error);
        return {
          content: [{
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
          }],
          isError: true
        };
      }
    }
  );
}
