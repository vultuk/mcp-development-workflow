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

		// List GitHub issues tool
		this.server.tool(
			"list_github_issues",
			{
				owner: z.string().describe("Repository owner's username or organization"),
				repo: z.string().describe("Repository name"),
				state: z
					.enum(["open", "closed", "all"])
					.optional()
					.describe("Filter by state (default: open)"),
				assignee: z.string().optional().describe("Filter by assignee username"),
				creator: z.string().optional().describe("Filter by creator username"),
				labels: z
					.array(z.string())
					.optional()
					.describe("Array of label names to filter by"),
				sort: z
					.enum(["created", "updated", "comments"])
					.optional()
					.describe("Sort criteria (default: created)"),
				direction: z
					.enum(["asc", "desc"])
					.optional()
					.describe("Sort direction (default: desc)"),
				per_page: z
					.number()
					.min(1)
					.max(100)
					.optional()
					.describe("Results per page (default: 30, max: 100)"),
				max_results: z
					.number()
					.optional()
					.describe("Maximum total results to return (handles pagination automatically)"),
			},
			async ({
				owner,
				repo,
				state,
				assignee,
				creator,
				labels,
				sort,
				direction,
				per_page = 30,
				max_results,
			}) => {
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

				const allIssues: any[] = [];
				let page = 1;
				const resultsPerPage = Math.min(per_page, 100);

				try {
					while (true) {
						// Build query parameters
						const params = new URLSearchParams({
							page: page.toString(),
							per_page: resultsPerPage.toString(),
						});

						if (state) params.append("state", state);
						if (assignee) params.append("assignee", assignee);
						if (creator) params.append("creator", creator);
						if (labels && labels.length > 0) params.append("labels", labels.join(","));
						if (sort) params.append("sort", sort);
						if (direction) params.append("direction", direction);

						const response = await fetch(
							`https://api.github.com/repos/${owner}/${repo}/issues?${params}`,
							{
								method: "GET",
								headers: {
									Accept: "application/vnd.github.v3+json",
									Authorization: `Bearer ${env.GITHUB_AUTH_TOKEN}`,
									"User-Agent": "MCP-GitHub-Issue-Creator",
								},
							},
						);

						if (!response.ok) {
							const errorData = (await response.json()) as any;
							return {
								content: [
									{
										type: "text",
										text: `Error listing issues: ${response.status} - ${errorData.message || JSON.stringify(errorData)}`,
									},
								],
							};
						}

						const issues = (await response.json()) as any[];
						allIssues.push(...issues);

						// Check if we've reached the desired number of results
						if (max_results && allIssues.length >= max_results) {
							allIssues.splice(max_results);
							break;
						}

						// Check if there are more pages
						const linkHeader = response.headers.get("Link");
						if (
							!linkHeader ||
							!linkHeader.includes('rel="next"') ||
							issues.length < resultsPerPage
						) {
							break;
						}

						page++;
					}

					// Format the results
					const formattedIssues = allIssues.map((issue) => ({
						number: issue.number,
						title: issue.title,
						state: issue.state,
						url: issue.html_url,
						created_at: issue.created_at,
						updated_at: issue.updated_at,
						assignees: issue.assignees?.map((a: any) => a.login) || [],
						labels: issue.labels?.map((l: any) => l.name) || [],
						is_pull_request: !!issue.pull_request,
					}));

					const summary = `Found ${formattedIssues.length} issue(s) in ${owner}/${repo}`;
					const issueList = formattedIssues
						.map(
							(issue) =>
								`#${issue.number}: ${issue.title} [${issue.state}]${issue.is_pull_request ? " (PR)" : ""}`,
						)
						.join("\n");

					return {
						content: [
							{
								type: "text",
								text: `${summary}\n\n${issueList}\n\nDetailed results:\n${JSON.stringify(formattedIssues, null, 2)}`,
							},
						],
					};
				} catch (error) {
					return {
						content: [
							{
								type: "text",
								text: `Error listing issues: ${error instanceof Error ? error.message : String(error)}`,
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
