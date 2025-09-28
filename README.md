# Echosphere MCP Server

A comprehensive Model Context Protocol (MCP) server providing various tools for AI assistance. This modular server architecture allows easy extension with new tools while maintaining security and performance.

## Features

### File Operations
- **Single File Reading**: Read individual files by specifying their relative path
- **Directory Reading**: Read all files in a directory (non-recursive)
- **File Moving**: Move files from one location to another within the workspace
- **File Renaming**: Rename files within the same directory
- **Security**: Built-in protection against directory traversal attacks
- **Validation**: Input validation for workspace roots and file paths
- **Error Handling**: Comprehensive error handling with clear error messages

### Memory Management (RAG System)
- **RAG-Powered Memory**: Advanced Retrieval Augmented Generation with semantic search using embeddings
- **Load Memory**: Query memory using natural language with vector similarity search
- **Save Memory**: Save memory with automatic embedding generation and intelligent chunking
- **Semantic Search**: Find relevant information using AI embeddings instead of simple text matching
- **Smart Chunking**: Automatically splits large content into optimal chunks with overlap
- **LLM Integration**: Uses configured AI models for embeddings and response generation

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

### Tool: `move_file`

Moves a file from one location to another within the workspace.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspaceRoot` | string | Yes | Absolute path to the workspace root directory |
| `sourceRelativePath` | string | Yes | Relative path of the source file to move |
| `targetRelativePath` | string | Yes | Relative path where the file should be moved to (including new filename) |

#### Example

```json
{
  "workspaceRoot": "/home/user/my-project",
  "sourceRelativePath": "src/old-file.js",
  "targetRelativePath": "src/components/new-file.js"
}
```

### Tool: `rename_file`

Renames a file within the same directory.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspaceRoot` | string | Yes | Absolute path to the workspace root directory |
| `relativePath` | string | Yes | Relative path of the file to rename |
| `newName` | string | Yes | New name for the file (filename only, not a path) |

#### Example

```json
{
  "workspaceRoot": "/home/user/my-project",
  "relativePath": "src/component.js",
  "newName": "new-component.js"
}
```

### Tool: `load_memory`

Loads memory using RAG (Retrieval Augmented Generation) with semantic search capabilities.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspaceRoot` | string | Yes | Absolute path to the workspace root directory |
| `query` | string | No | Natural language query to search within memory using semantic similarity |
| `maxResults` | number | No | Maximum number of similar memory chunks to return (default: 5) |
| `useRAG` | boolean | No | Whether to use RAG to generate a response (default: true) |

#### Examples

**Load all memory:**
```json
{
  "workspaceRoot": "/home/user/my-project"
}
```

**Semantic query with RAG:**
```json
{
  "workspaceRoot": "/home/user/my-project",
  "query": "How do I configure the database connection?",
  "maxResults": 3,
  "useRAG": true
}
```

**Semantic search without RAG generation:**
```json
{
  "workspaceRoot": "/home/user/my-project",
  "query": "API endpoints",
  "useRAG": false
}
```

#### Features

- **Semantic Search**: Uses AI embeddings to find contextually relevant memory chunks
- **RAG Response**: Generates clean, intelligent responses using retrieved memory context
- **Vector Similarity**: Finds similar content even if exact keywords don't match
- **Configurable Results**: Control how many similar chunks to retrieve
- **Clean Output**: Automatically removes markdown formatting from AI responses
- **Auto-creation**: Memory system is automatically initialized if it doesn't exist

### Tool: `save_memory`

Saves memory with automatic embedding generation and intelligent chunking.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspaceRoot` | string | Yes | Absolute path to the workspace root directory |
| `content` | string | Yes | Memory content to save (automatically chunked and embedded) |
| `append` | boolean | No | Whether to append to existing memory or replace it (default: false) |
| `metadata` | object | No | Optional metadata to associate with the memory |
| `tags` | string[] | No | Optional tags to categorize the memory |

#### Examples

**Save new memory with embeddings:**
```json
{
  "workspaceRoot": "/home/user/my-project",
  "content": "The database connection uses PostgreSQL on port 5432. The connection string format is postgresql://user:pass@localhost:5432/dbname. Always use connection pooling for better performance.",
  "metadata": {"source": "documentation", "type": "configuration"},
  "tags": ["database", "postgresql", "configuration"]
}
```

**Append to existing memory:**
```json
{
  "workspaceRoot": "/home/user/my-project",
  "content": "API rate limiting is set to 1000 requests per hour per user. Use exponential backoff for retries.",
  "append": true,
  "tags": ["api", "rate-limiting"]
}
```

#### Features

- **Automatic Embeddings**: Generates vector embeddings for semantic search
- **Smart Chunking**: Splits large content into optimal chunks with sentence boundaries
- **Chunk Overlap**: Maintains context between chunks with intelligent overlap
- **Metadata Support**: Store additional structured information with memory
- **Tagging System**: Categorize memory for better organization
- **Statistics**: Returns detailed information about memory storage

## Configuration

### Environment Variables

Create a `.env` file in your project root with the following configuration:

```env
# AI Configuration
AI_BASE_URL=https://ai.echosphere.cfd/v1
AI_API_KEY=your-api-key-here
AI_MODEL=mistral-small-latest
AI_EMBEDDING_MODEL=mistral-embed

# Search API (optional)
SEARXNG_URL=https://search.echosphere.cfd
```

#### Environment Variable Details

- **AI_BASE_URL**: Base URL for the AI API endpoint
- **AI_API_KEY**: Your API key for the AI service
- **AI_MODEL**: The LLM model to use for RAG response generation
- **AI_EMBEDDING_MODEL**: The embedding model to use for semantic search
- **SEARXNG_URL**: Optional search API endpoint

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
│   │   ├── file-reader.ts # File reading tool
│   │   ├── move-file.ts  # File moving tool
│   │   ├── rename-file.ts # File renaming tool
│   │   ├── load-memory.ts # Memory loading tool with RAG
│   │   └── save-memory.ts # Memory saving tool with embeddings
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
