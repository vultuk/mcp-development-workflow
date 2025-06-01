import { z } from "zod";
import type { ToolHandler } from "../types.js";

export const listGithubIssuesSchema = z.object({
	owner: z.string().describe("Repository owner's username or organization"),
	repo: z.string().describe("Repository name"),
	state: z.enum(["open", "closed", "all"]).optional().describe("Filter by state (default: open)"),
	assignee: z.string().optional().describe("Filter by assignee username"),
	creator: z.string().optional().describe("Filter by creator username"),
	labels: z.array(z.string()).optional().describe("Array of label names to filter by"),
	sort: z
		.enum(["created", "updated", "comments"])
		.optional()
		.describe("Sort criteria (default: created)"),
	direction: z.enum(["asc", "desc"]).optional().describe("Sort direction (default: desc)"),
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
});

export type ListGithubIssuesParams = z.infer<typeof listGithubIssuesSchema>;

export const listGithubIssuesHandler: ToolHandler<ListGithubIssuesParams> = async (
	{ owner, repo, state, assignee, creator, labels, sort, direction, per_page = 30, max_results },
	{ env },
) => {
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
	let hasMorePages = false;
	let totalAvailable: number | null = null;
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

			// Parse Link header to check for more pages
			const linkHeader = response.headers.get("Link");
			hasMorePages = linkHeader ? linkHeader.includes('rel="next"') : false;

			// Try to extract total count from last page link
			if (linkHeader && totalAvailable === null) {
				const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
				if (lastMatch) {
					totalAvailable = parseInt(lastMatch[1]) * resultsPerPage;
				}
			}

			// Check if we've reached the desired number of results
			if (max_results && allIssues.length >= max_results) {
				allIssues.splice(max_results);
				hasMorePages = true; // There might be more beyond our limit
				break;
			}

			// Check if there are more pages
			if (!hasMorePages || issues.length < resultsPerPage) {
				break;
			}

			page++;
		}

		// Format the results - include ID, title, state, and body
		const formattedIssues = allIssues
			.map((issue) => {
				const body = issue.body ? issue.body.trim() : "(No description)";
				const truncatedBody = body.length > 200 ? body.substring(0, 200) + "..." : body;
				return `#${issue.number}: ${issue.title} [${issue.state}]\n   ${truncatedBody.replace(/\n/g, " ")}`;
			})
			.join("\n\n");

		// Build pagination info
		let paginationInfo = "";
		if (hasMorePages) {
			paginationInfo = "\n\n📄 More results available. ";
			if (max_results) {
				paginationInfo += `Showing first ${allIssues.length} results (limited by max_results).`;
			} else {
				paginationInfo += `Use max_results parameter to limit results or increase per_page.`;
			}
		}

		if (totalAvailable && !max_results) {
			paginationInfo += ` Estimated total: ~${totalAvailable} issues.`;
		}

		const summary = `Found ${allIssues.length} issue(s) in ${owner}/${repo}`;

		return {
			content: [
				{
					type: "text",
					text: `${summary}\n\n${formattedIssues}${paginationInfo}`,
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
};
