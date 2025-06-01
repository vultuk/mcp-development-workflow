# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Cloudflare Workers project that implements a remote MCP (Model Context Protocol) server without authentication. The server exposes tools via Server-Sent Events (SSE) and can be connected to from the Cloudflare AI Playground or Claude Desktop.

## Common Development Commands

```bash
# Install dependencies
npm install

# Run development server locally
npm run dev
# or
npm start

# Deploy to Cloudflare Workers
npm run deploy

# Type checking
npm run type-check

# Format code using Biome
npm run format

# Fix linting issues using Biome
npm run lint:fix

# Generate Cloudflare types
npm run cf-typegen
```

## Architecture

The project uses a Durable Object pattern with the following structure:

- **MyMCP** (src/index.ts): Main MCP agent class that extends `McpAgent` from the `agents` package
  - Defines tools using `this.server.tool()` method in the `init()` function
  - Currently implements GitHub issue management tools:
    - `create_github_issue`: Create new issues
    - `list_github_issues`: List repository issues with pagination
    - `get_github_issue`: Get full details of a specific issue
    - `update_github_issue`: Update existing issues
  
- **Request Handling**: The default export handles HTTP requests with two main endpoints:
  - `/sse` and `/sse/message`: Serves SSE connections for remote MCP clients
  - `/mcp`: Alternative MCP endpoint
  
- **Tool Definition Pattern**: Tools are defined using Zod schemas for input validation and return structured responses with content arrays

## Adding New Tools

To add new tools to the MCP server:
1. Add tool definitions inside the `init()` method of the MyMCP class
2. Use `this.server.tool(name, zodSchema, handler)` pattern
3. Return responses in the format: `{ content: [{ type: "text", text: "result" }] }`

## Environment Variables

### GitHub Authentication
The project includes a `create_github_issue` tool that requires a GitHub authentication token:

```bash
# Set the GitHub auth token as a secret (for production)
wrangler secret put GITHUB_AUTH_TOKEN

# For local development, create a .dev.vars file
echo "GITHUB_AUTH_TOKEN=your_github_token_here" > .dev.vars
```

## Deployment Configuration

The project uses `wrangler.jsonc` for Cloudflare Workers configuration with:
- Durable Objects binding named `MCP_OBJECT` for the `MyMCP` class
- Node.js compatibility enabled
- TypeScript as the main source language