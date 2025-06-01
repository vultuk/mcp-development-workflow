import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface Env {
	GITHUB_AUTH_TOKEN: string;
}

export interface ToolResponse {
	[x: string]: unknown;
	content: Array<{
		[x: string]: unknown;
		text: string;
		type: "text";
	}>;
	_meta?: { [x: string]: unknown } | undefined;
	structuredContent?: { [x: string]: unknown } | undefined;
	isError?: boolean | undefined;
}

export interface ToolContext {
	server: McpServer;
	env: Env;
}

export type ToolHandler<T = any> = (params: T, context: ToolContext) => Promise<ToolResponse>;
