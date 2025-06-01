import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

interface Env {
	GITHUB_AUTH_TOKEN: string;
}

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "MCP Tools Server",
		version: "1.0.0",
	});

	async init() {
		// Simple addition tool
		this.server.tool("add", { a: z.number(), b: z.number() }, async ({ a, b }) => ({
			content: [{ type: "text", text: String(a + b) }],
		}));

		// Calculator tool with multiple operations
		this.server.tool(
			"calculate",
			{
				operation: z.enum(["add", "subtract", "multiply", "divide"]),
				a: z.number(),
				b: z.number(),
			},
			async ({ operation, a, b }) => {
				let result: number;
				switch (operation) {
					case "add":
						result = a + b;
						break;
					case "subtract":
						result = a - b;
						break;
					case "multiply":
						result = a * b;
						break;
					case "divide":
						if (b === 0)
							return {
								content: [
									{
										type: "text",
										text: "Error: Cannot divide by zero",
									},
								],
							};
						result = a / b;
						break;
				}
				return { content: [{ type: "text", text: String(result) }] };
			},
		);

		// GitHub issue creation tool
		this.server.tool(
			"create_github_issue",
			{
				owner: z.string().describe("Repository owner's username or organization"),
				repo: z.string().describe("Repository name"),
				title: z.string().describe("Issue title"),
				body: z.string().optional().describe("Issue description"),
				assignees: z.array(z.string()).optional().describe("Array of usernames to assign"),
				labels: z.array(z.string()).optional().describe("Array of label names"),
				milestone: z.number().optional().describe("Milestone number"),
			},
			async ({ owner, repo, title, body, assignees, labels, milestone }) => {
				// Access the environment through the handler context
				const env = (this as any).env as Env;

				if (!env.GITHUB_AUTH_TOKEN) {
					return {
						content: [
							{
								type: "text",
								text: "Error: GITHUB_AUTH_TOKEN environment variable is not set",
							},
						],
					};
				}

				const requestBody: any = { title };
				if (body) requestBody.body = body;
				if (assignees) requestBody.assignees = assignees;
				if (labels) requestBody.labels = labels;
				if (milestone) requestBody.milestone = milestone;

				try {
					const response = await fetch(
						`https://api.github.com/repos/${owner}/${repo}/issues`,
						{
							method: "POST",
							headers: {
								Accept: "application/vnd.github.v3+json",
								Authorization: `Bearer ${env.GITHUB_AUTH_TOKEN}`,
								"User-Agent": "MCP-GitHub-Issue-Creator",
								"Content-Type": "application/json",
							},
							body: JSON.stringify(requestBody),
						},
					);

					if (!response.ok) {
						const errorData = (await response.json()) as any;
						return {
							content: [
								{
									type: "text",
									text: `Error creating issue: ${response.status} - ${errorData.message || JSON.stringify(errorData)}`,
								},
							],
						};
					}

					const issue = (await response.json()) as any;
					return {
						content: [
							{
								type: "text",
								text: `Successfully created issue #${issue.number}: ${issue.title}\nURL: ${issue.html_url}`,
							},
						],
					};
				} catch (error) {
					return {
						content: [
							{
								type: "text",
								text: `Error creating issue: ${error instanceof Error ? error.message : String(error)}`,
							},
						],
					};
				}
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
