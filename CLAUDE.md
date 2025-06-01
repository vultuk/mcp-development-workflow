# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Cloudflare Workers project that implements a remote MCP (Model Context Protocol) server focused on GitHub issue management. The server exposes tools via Server-Sent Events (SSE) and can be connected to from the Cloudflare AI Playground or Claude Desktop.

### Key Features
- Full GitHub issue CRUD operations (Create, Read, Update)
- Organization management capabilities
- Pagination support for listing operations
- Authentication via GitHub personal access tokens
- No authentication required for MCP server access (authless)

## Common Development Commands

```bash
# Install dependencies
npm install

# Run development server locally (default port 8787)
npm run dev
# or
npm start

# Deploy to Cloudflare Workers
npm run deploy

# Type checking with TypeScript
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

### Core Components

- **MyMCP** (src/index.ts): Main MCP agent class that extends `McpAgent` from the `agents` package
  - Server name: "GitHub Issues MCP Server"
  - Version: "1.0.0"
  - Defines tools using `this.server.tool()` method in the `init()` function
  - Implements 6 GitHub tools for comprehensive repository and issue management

### Request Handling

The default export handles HTTP requests with two main endpoints:
- `/sse` and `/sse/message`: Serves SSE connections for remote MCP clients
- `/mcp`: Alternative MCP endpoint

### Tool Definition Pattern

Tools are defined using:
1. Zod schemas for input validation
2. Async handler functions
3. Structured responses in the format: `{ content: [{ type: "text", text: "result" }] }`

## Available GitHub Tools

### 1. `create_github_issue`
Creates a new issue in a GitHub repository.

**Parameters:**
- `owner` (string, required): Repository owner's username or organization
- `repo` (string, required): Repository name
- `title` (string, required): Issue title
- `body` (string, optional): Issue description
- `assignees` (array of strings, optional): Usernames to assign
- `labels` (array of strings, optional): Label names to apply
- `milestone` (number, optional): Milestone number

**Returns:** Issue number, title, and URL of the created issue

### 2. `list_github_issues`
Lists issues in a repository with pagination support.

**Parameters:**
- `owner` (string, required): Repository owner's username or organization
- `repo` (string, required): Repository name
- `state` (enum: "open", "closed", "all", optional): Filter by state (default: "open")
- `assignee` (string, optional): Filter by assignee username
- `creator` (string, optional): Filter by creator username
- `labels` (array of strings, optional): Filter by label names
- `sort` (enum: "created", "updated", "comments", optional): Sort criteria (default: "created")
- `direction` (enum: "asc", "desc", optional): Sort direction (default: "desc")
- `per_page` (number, optional): Results per page, 1-100 (default: 30)
- `max_results` (number, optional): Maximum total results to return

**Returns:** 
- Issue number, title, state, and body (truncated to 200 chars)
- Pagination information when more results are available
- Automatic pagination handling up to max_results

### 3. `get_github_issue`
Retrieves full details of a specific issue.

**Parameters:**
- `owner` (string, required): Repository owner's username or organization
- `repo` (string, required): Repository name
- `issue_number` (number, required): Issue number to retrieve
- `media_type` (enum: "raw", "text", "html", "full", optional): Response format (default: "raw")

**Returns:** Complete issue data including:
- Basic info (number, title, state, body)
- Timestamps (created, updated, closed)
- Author and assignee information
- Labels and milestone
- Comment count
- Reaction counts (all types)
- Pull request indicator

### 4. `update_github_issue`
Updates an existing issue using PATCH method.

**Parameters (all optional except owner/repo/issue_number):**
- `owner` (string, required): Repository owner's username or organization
- `repo` (string, required): Repository name
- `issue_number` (number, required): Issue number to update
- `title` (string): New title
- `body` (string): New body content
- `state` (enum: "open", "closed"): Issue state
- `state_reason` (enum: "completed", "not_planned", "reopened"): Reason for closing
- `labels` (array of strings): Replace all labels
- `assignees` (array of strings): Replace all assignees
- `milestone` (number or null): Milestone number (null to remove)

**Returns:** Updated issue details and summary of changed fields

### 5. `get_github_organisations`
Lists organizations for the authenticated user.

**Parameters:**
- `per_page` (number, optional): Results per page, 1-100 (default: 30)
- `page` (number, optional): Page number to retrieve (default: 1)

**Returns:** 
- Organization login names and descriptions
- Detailed organization data including URLs, repository counts, and timestamps
- Pagination information for multiple pages

### 6. `list_github_repositories`
Lists repositories for a specified organization.

**Parameters:**
- `org` (string, required): Organization name
- `type` (enum: "all", "public", "private", "forks", "sources", "member", optional): Type of repositories (default: "all")
- `sort` (enum: "created", "updated", "pushed", "full_name", optional): Sort field (default: "created")
- `direction` (enum: "asc", "desc", optional): Sort direction
- `per_page` (number, optional): Results per page, 1-100 (default: 30)
- `page` (number, optional): Page number to retrieve (default: 1)

**Returns:**
- Repository names with visibility indicators (🔒 private, 📂 public)
- Repository descriptions, language, and archived status
- Statistics: stars, forks, and open issues count
- Detailed repository data including URLs, topics, and metadata
- Pagination information for multiple pages

## Environment Variables

### GitHub Authentication
All GitHub tools require authentication via a personal access token:

```bash
# Set the GitHub auth token as a secret (for production)
wrangler secret put GITHUB_AUTH_TOKEN

# For local development, create a .dev.vars file
echo "GITHUB_AUTH_TOKEN=your_github_token_here" > .dev.vars
```

**Required Token Permissions:**
- `repo` scope for full repository access
- `read:org` scope for organization access

### Local Development Setup
1. Create a `.dev.vars` file in the project root (automatically ignored by git)
2. Add your GitHub personal access token
3. Run `npm run dev` to start the development server

## Tool Implementation Guidelines

When adding new tools to the MCP server:

1. **Define the tool in the `init()` method:**
   ```typescript
   this.server.tool(
     "tool_name",
     {
       // Zod schema for parameters
       param1: z.string().describe("Parameter description"),
       param2: z.number().optional().describe("Optional parameter")
     },
     async ({ param1, param2 }) => {
       // Tool implementation
     }
   );
   ```

2. **Access environment variables:**
   ```typescript
   const env = (this as any).env as Env;
   ```

3. **Handle errors gracefully:**
   - Check for missing environment variables
   - Validate API responses
   - Return descriptive error messages

4. **Return structured responses:**
   ```typescript
   return {
     content: [{
       type: "text",
       text: "Your response text here"
     }]
   };
   ```

## Deployment Configuration

The project uses `wrangler.jsonc` for Cloudflare Workers configuration:

- **Durable Objects binding:** Named `MCP_OBJECT` for the `MyMCP` class
- **Compatibility flags:** `nodejs_compat` enabled
- **Main entry:** `src/index.ts`
- **TypeScript support:** Built-in compilation

### Deployment Process
1. Ensure all environment variables are set
2. Run `npm run deploy`
3. Note the deployed URL (format: `mcp-development-workflow.<account>.workers.dev`)
4. Use the `/sse` endpoint for MCP connections

## Error Handling

All tools implement consistent error handling:
- Missing authentication returns clear error message
- API failures include status code and error details
- Invalid parameters are validated by Zod schemas
- Network errors are caught and reported

## Testing Tools Locally

1. Start the development server: `npm run dev`
2. The server runs on `http://localhost:8787`
3. Connect using MCP clients to `http://localhost:8787/sse`
4. Test individual tools through the MCP protocol

## Code Style and Formatting

- **Formatter:** Biome (configured in `biome.json`)
- **TypeScript:** Strict mode enabled
- **Indentation:** Tabs
- **Import style:** ES modules

Run `npm run format` before committing to ensure consistent code style.