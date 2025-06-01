import { z } from "zod";
import type { ToolHandler } from "../types.js";

export const listGithubRepositoriesSchema = z.object({
	org: z.string().describe("Organization name"),
	type: z
		.enum(["all", "public", "private", "forks", "sources", "member"])
		.optional()
		.describe("Type of repositories to list (default: all)"),
	sort: z
		.enum(["created", "updated", "pushed", "full_name"])
		.optional()
		.describe("Sort field (default: created)"),
	direction: z
		.enum(["asc", "desc"])
		.optional()
		.describe("Sort direction (default: desc when using full_name, asc otherwise)"),
	per_page: z
		.number()
		.min(1)
		.max(100)
		.optional()
		.describe("Results per page (default: 30, max: 100)"),
	page: z.number().optional().describe("Page number to retrieve"),
});

export type ListGithubRepositoriesParams = z.infer<typeof listGithubRepositoriesSchema>;

export const listGithubRepositoriesHandler: ToolHandler<ListGithubRepositoriesParams> = async (
	{ org, type = "all", sort, direction, per_page = 30, page = 1 },
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

	try {
		// Build query parameters
		const params = new URLSearchParams({
			type: type,
			per_page: per_page.toString(),
			page: page.toString(),
		});

		if (sort) params.append("sort", sort);
		if (direction) params.append("direction", direction);

		const response = await fetch(`https://api.github.com/orgs/${org}/repos?${params}`, {
			method: "GET",
			headers: {
				Accept: "application/vnd.github.v3+json",
				Authorization: `Bearer ${env.GITHUB_AUTH_TOKEN}`,
				"User-Agent": "MCP-GitHub-Issue-Creator",
			},
		});

		if (!response.ok) {
			const errorData = (await response.json()) as any;
			return {
				content: [
					{
						type: "text",
						text: `Error listing organization repositories: ${response.status} - ${errorData.message || JSON.stringify(errorData)}`,
					},
				],
			};
		}

		const repos = (await response.json()) as any[];

		// Check for pagination info
		const linkHeader = response.headers.get("Link");
		const hasMorePages = linkHeader ? linkHeader.includes('rel="next"') : false;

		// Format the repositories
		const formattedRepos = repos.map((repo) => ({
			name: repo.name,
			full_name: repo.full_name,
			description: repo.description || "(No description)",
			private: repo.private,
			fork: repo.fork,
			created_at: repo.created_at,
			updated_at: repo.updated_at,
			pushed_at: repo.pushed_at,
			size: repo.size,
			stargazers_count: repo.stargazers_count,
			watchers_count: repo.watchers_count,
			language: repo.language,
			forks_count: repo.forks_count,
			open_issues_count: repo.open_issues_count,
			default_branch: repo.default_branch,
			archived: repo.archived,
			disabled: repo.disabled,
			url: repo.html_url,
			clone_url: repo.clone_url,
			topics: repo.topics || [],
		}));

		// Build repository list
		const repoList = formattedRepos
			.map((repo) => {
				const visibility = repo.private ? "🔒 private" : "📂 public";
				const status = repo.archived ? " [ARCHIVED]" : "";
				const lang = repo.language ? ` (${repo.language})` : "";
				return `• ${repo.name} ${visibility}${lang}${status}\n  ${repo.description}\n  ⭐ ${repo.stargazers_count} | 🍴 ${repo.forks_count} | 🐛 ${repo.open_issues_count}`;
			})
			.join("\n\n");

		// Build pagination info
		let paginationInfo = "";
		if (hasMorePages) {
			paginationInfo = `\n\n📄 More repositories available on page ${page + 1}`;
		}

		const summary = `Found ${repos.length} repositories in ${org}`;
		const typeInfo = type !== "all" ? ` (type: ${type})` : "";

		return {
			content: [
				{
					type: "text",
					text: `${summary}${typeInfo}\n\n${repoList}${paginationInfo}\n\nDetailed results:\n${JSON.stringify(formattedRepos, null, 2)}`,
				},
			],
		};
	} catch (error) {
		return {
			content: [
				{
					type: "text",
					text: `Error listing organization repositories: ${error instanceof Error ? error.message : String(error)}`,
				},
			],
		};
	}
};
