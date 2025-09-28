#!/usr/bin/env node

import { config } from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./tools/index.js";

// Load environment variables
config();

/**
 * Echosphere MCP Server
 * A comprehensive Model Context Protocol server providing various tools for AI assistance
 */

// Create the Echosphere MCP server
const server = new McpServer({
  name: "Echosphere",
  version: "1.0.0"
});

// Register all available tools
registerAllTools(server);

// Start the server using stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Echosphere MCP server running on stdio");
