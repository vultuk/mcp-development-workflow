import { z } from "zod";
import type { ToolHandler } from "../types.js";

export const getGithubOrganisationsSchema = z.object({
	per_page: z
		.number()
		.min(1)
		.max(100)
		.optional()
		.describe("Results per page (default: 30, max: 100)"),
	page: z.number().optional().describe("Page number to retrieve"),
});

export type GetGithubOrganisationsParams = z.infer<typeof getGithubOrganisationsSchema>;

export const getGithubOrganisationsHandler: ToolHandler<GetGithubOrganisationsParams> = async (
	{ per_page = 30, page = 1 },
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
			per_page: per_page.toString(),
			page: page.toString(),
		});

		const response = await fetch(`https://api.github.com/user/orgs?${params}`, {
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
						text: `Error listing organizations: ${response.status} - ${errorData.message || JSON.stringify(errorData)}`,
					},
				],
			};
		}

		const organizations = (await response.json()) as any[];

		// Check for pagination info
		const linkHeader = response.headers.get("Link");
		const hasMorePages = linkHeader ? linkHeader.includes('rel="next"') : false;

		// Format the organizations
		const formattedOrgs = organizations.map((org) => ({
			login: org.login,
			id: org.id,
			description: org.description || "(No description)",
			url: org.html_url || `https://github.com/${org.login}`,
			avatar_url: org.avatar_url,
			repos_url: org.repos_url,
			public_repos: org.public_repos,
			public_gists: org.public_gists,
			followers: org.followers,
			following: org.following,
			created_at: org.created_at,
			updated_at: org.updated_at,
		}));

		// Build organization list
		const orgList = formattedOrgs
			.map((org) => `• ${org.login} - ${org.description}`)
			.join("\n");

		// Build pagination info
		let paginationInfo = "";
		if (hasMorePages) {
			paginationInfo = `\n\n📄 More organizations available on page ${page + 1}`;
		}

		const summary = `Found ${organizations.length} organization(s) for authenticated user`;

		return {
			content: [
				{
					type: "text",
					text: `${summary}\n\n${orgList}${paginationInfo}\n\nDetailed results:\n${JSON.stringify(formattedOrgs, null, 2)}`,
				},
			],
		};
	} catch (error) {
		return {
			content: [
				{
					type: "text",
					text: `Error listing organizations: ${error instanceof Error ? error.message : String(error)}`,
				},
			],
		};
	}
};
