# Echosphere MCP Server

A comprehensive Model Context Protocol (MCP) server providing various tools for AI assistance. This modular server architecture allows easy extension with new tools while maintaining security and performance.

## Features

### File Operations
- **Single File Reading**: Read individual files by specifying their relative path
- **Directory Reading**: Read all files in a directory (non-recursive)
- **Security**: Built-in protection against directory traversal attacks
- **Validation**: Input validation for workspace roots and file paths
- **Error Handling**: Comprehensive error handling with clear error messages

### Architecture
- **Modular Design**: Tools are organized in separate modules for easy maintenance
- **Scalable Structure**: Easy to add new tools and capabilities
- **Shared Utilities**: Common functionality is centralized for consistency
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Installation

1. **Clone or create the project directory**:
   ```bash
   mkdir echosphere-mcp-server
   cd echosphere-mcp-server
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the server**:
   ```bash
   npm run build
   ```

## Usage

### Tool: `read_files`

Reads one or multiple files from a workspace directory.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspaceRoot` | string | Yes | Absolute path to the workspace root directory |
| `relativePaths` | string[] | Yes | Array of relative file paths from workspace root to file(s) or directory to read |

#### Parameter Details

- **`workspaceRoot`**: Must be an absolute path to an existing directory that serves as the root of your workspace
- **`relativePaths`**: Array of relative file paths from the workspace root
  - **Array of strings**: For reading multiple specific files at once
  - For **files**: Specify the relative path to the specific file(s) you want to read
  - For **directories**: Specify the relative path to the directory to read all files within it (non-recursive)
  - Use `["."]` to read all files in the workspace root directory
  - Minimum 1 file path required, maximum 50 for optimal performance

#### Examples

**Reading a single file:**
```json
{
  "workspaceRoot": "/home/user/my-project",
  "relativePaths": ["src/index.js"]
}
```

**Reading all files in a directory:**
```json
{
  "workspaceRoot": "/home/user/my-project", 
  "relativePaths": ["src"]
}
```

**Reading all files in workspace root:**
```json
{
  "workspaceRoot": "/home/user/my-project",
  "relativePaths": ["."]
}
```

**Reading multiple specific files:**
```json
{
  "workspaceRoot": "/home/user/my-project",
  "relativePaths": ["src/index.js", "package.json", "README.md"]
}
```

**Reading multiple files and directories:**
```json
{
  "workspaceRoot": "/home/user/my-project",
  "relativePaths": ["src/utils.js", "config", "docs/api.md"]
}
```

#### Response Format

**Single File Response:**
- Returns the file content with metadata including file path and size
- Content is returned as plain text

**Multiple Files Response:**
- Returns content of all files in the specified directory
- Each file is clearly separated with headers showing file path and size
- Non-readable files will show error messages instead of content

#### Security Features

- **Path Traversal Protection**: Prevents reading files outside the workspace root using `../` or absolute paths
- **Workspace Validation**: Ensures the workspace root exists and is a directory
- **Path Resolution**: All paths are normalized and validated before access

#### Error Handling

The tool provides clear error messages for common issues:
- Workspace root doesn't exist or isn't a directory
- File or directory not found
- Permission denied
- Path traversal attempts
- File reading errors

## Configuration

### Claude Desktop Configuration

Add the following to your Claude Desktop configuration file:

```json
{
  "mcpServers": {
    "echosphere": {
      "command": "node",
      "args": ["/absolute/path/to/your/dist/index.js"]
    }
  }
}
```

Replace `/absolute/path/to/your` with the actual path to your built server.

### Environment Setup

1. Ensure Node.js v16.0.0 or higher is installed
2. Build the project: `npm run build`
3. Configure your MCP client to use the built server

## Development

### Project Structure

```
echosphere-mcp-server/
├── src/
│   ├── index.ts          # Main server entry point
│   ├── tools/            # Tool implementations
│   │   ├── index.ts      # Tool registry
│   │   └── file-reader.ts # File reading tool
│   └── shared/           # Shared utilities
│       ├── types.ts      # Common type definitions
│       ├── validation.ts # Input validation utilities
│       └── file-operations.ts # File operation utilities
├── dist/                 # Built JavaScript files (after npm run build)
├── package.json          # Project dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── mcp.json             # MCP client configuration
└── README.md             # This file
```

### Available Scripts

- `npm run build`: Build the TypeScript project
- `npm run watch`: Watch for changes and rebuild automatically
- `npm start`: Run the built server (requires building first)

### Adding New Tools

To add a new tool to the Echosphere MCP server:

1. **Create a tool file** in `src/tools/` (e.g., `my-new-tool.ts`)
2. **Implement the tool** following this pattern:
   ```typescript
   import { z } from "zod";
   import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
   
   export const myToolSchema = {
     param1: z.string().describe("Description of param1"),
     param2: z.number().describe("Description of param2")
   };
   
   export async function myToolHandler({ param1, param2 }: z.infer<typeof z.object(myToolSchema)>) {
     // Tool implementation
     return {
       content: [{ type: "text", text: "Tool result" }]
     };
   }
   
   export function registerMyTool(server: McpServer): void {
     server.tool("my_tool", myToolSchema, myToolHandler);
   }
   ```
3. **Register the tool** in `src/tools/index.ts`:
   ```typescript
   import { registerMyTool } from "./my-new-tool.js";
   
   export function registerAllTools(server: McpServer): void {
     registerFileReaderTool(server);
     registerMyTool(server); // Add this line
   }
   ```
4. **Update the availableTools array** for documentation

### Key Functions

- **`validateAndNormalizePath()`**: Validates file paths and prevents directory traversal
- **`readSingleFile()`**: Reads individual files with error handling
- **`readDirectoryFiles()`**: Reads all files in a directory
- **`getPathType()`**: Determines if a path is a file, directory, or doesn't exist

## Security Considerations

1. **Workspace Boundary**: All file access is restricted to within the specified workspace root
2. **Path Validation**: Input paths are validated and normalized to prevent security issues
3. **Error Sanitization**: Error messages don't expose sensitive file system information
4. **No Write Operations**: This server only reads files, never modifies them

## Troubleshooting

### Common Issues

1. **"Workspace root does not exist"**
   - Ensure the `workspace_root` parameter contains a valid, absolute path to an existing directory

2. **"Path is outside the workspace root"**
   - This is a security feature preventing directory traversal
   - Ensure your `relative_path` doesn't use `../` to escape the workspace

3. **"Permission denied"**
   - Ensure the server has read permissions for the files you're trying to access

4. **Build errors**
   - Run `npm install` to ensure all dependencies are installed
   - Check that Node.js version is 16.0.0 or higher

## License

MIT License
