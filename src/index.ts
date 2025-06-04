import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "./types.js";
import {
	createGithubIssueSchema,
	createGithubIssueHandler,
	listGithubIssuesSchema,
	listGithubIssuesHandler,
	getGithubIssueSchema,
	getGithubIssueHandler,
	updateGithubIssueSchema,
	updateGithubIssueHandler,
	getGithubOrganisationsSchema,
	getGithubOrganisationsHandler,
	listGithubRepositoriesSchema,
	listGithubRepositoriesHandler,
} from "./tools/index.js";
import { createTicketPromptSchema, createTicketPromptHandler } from "./prompts/index.js";

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "GitHub Issues MCP Server",
		version: "1.0.0",
	});

	async init() {
		// GitHub issue creation tool
		this.server.tool(
			"create_github_issue",
			createGithubIssueSchema.shape,
			async (params, extra) => {
				const env = (this as any).env as Env;
				return createGithubIssueHandler(params, { server: this.server, env });
			},
		);

		// List GitHub issues tool
		this.server.tool(
			"list_github_issues",
			listGithubIssuesSchema.shape,
			async (params, extra) => {
				const env = (this as any).env as Env;
				return listGithubIssuesHandler(params, { server: this.server, env });
			},
		);

		// Get single GitHub issue tool
		this.server.tool("get_github_issue", getGithubIssueSchema.shape, async (params, extra) => {
			const env = (this as any).env as Env;
			return getGithubIssueHandler(params, { server: this.server, env });
		});

		// Update GitHub issue tool
		this.server.tool(
			"update_github_issue",
			updateGithubIssueSchema.shape,
			async (params, extra) => {
				const env = (this as any).env as Env;
				return updateGithubIssueHandler(params, { server: this.server, env });
			},
		);

		// List organizations for authenticated user tool
		this.server.tool(
			"get_github_organisations",
			getGithubOrganisationsSchema.shape,
			async (params, extra) => {
				const env = (this as any).env as Env;
				return getGithubOrganisationsHandler(params, { server: this.server, env });
			},
		);

		// List organization repositories tool
		this.server.tool(
			"list_github_repositories",
			listGithubRepositoriesSchema.shape,
			async (params, extra) => {
				const env = (this as any).env as Env;
				return listGithubRepositoriesHandler(params, { server: this.server, env });
			},
		);

		// Create ticket prompt
		this.server.prompt(
			"create-ticket",
			"Generate a well-structured GitHub issue for features, bugs, or tasks",
			createTicketPromptSchema.shape,
			async (params) => {
				return createTicketPromptHandler(params);
			},
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
