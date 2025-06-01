import { z } from "zod";
import type { ToolHandler } from "../types.js";

export const getGithubIssueSchema = z.object({
	owner: z.string().describe("Repository owner's username or organization"),
	repo: z.string().describe("Repository name"),
	issue_number: z.number().describe("Issue number to retrieve"),
	media_type: z
		.enum(["raw", "text", "html", "full"])
		.optional()
		.describe("Media type for the response (default: raw)"),
});

export type GetGithubIssueParams = z.infer<typeof getGithubIssueSchema>;

export const getGithubIssueHandler: ToolHandler<GetGithubIssueParams> = async (
	{ owner, repo, issue_number, media_type },
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

	// Determine the Accept header based on media type
	let acceptHeader = "application/vnd.github.v3+json";
	if (media_type) {
		acceptHeader = `application/vnd.github.${media_type}+json`;
	}

	try {
		const response = await fetch(
			`https://api.github.com/repos/${owner}/${repo}/issues/${issue_number}`,
			{
				method: "GET",
				headers: {
					Accept: acceptHeader,
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
						text: `Error getting issue: ${response.status} - ${errorData.message || JSON.stringify(errorData)}`,
					},
				],
			};
		}

		const issue = (await response.json()) as any;

		// Format the issue data
		const formattedIssue = {
			number: issue.number,
			title: issue.title,
			state: issue.state,
			body: issue.body,
			body_text: issue.body_text,
			body_html: issue.body_html,
			created_at: issue.created_at,
			updated_at: issue.updated_at,
			closed_at: issue.closed_at,
			author: issue.user?.login,
			author_association: issue.author_association,
			assignees: issue.assignees?.map((a: any) => a.login) || [],
			labels: issue.labels?.map((l: any) => l.name) || [],
			milestone: issue.milestone?.title || null,
			comments: issue.comments,
			is_pull_request: !!issue.pull_request,
			html_url: issue.html_url,
			reactions: {
				total: issue.reactions?.total_count || 0,
				"+1": issue.reactions?.["+1"] || 0,
				"-1": issue.reactions?.["-1"] || 0,
				laugh: issue.reactions?.laugh || 0,
				hooray: issue.reactions?.hooray || 0,
				confused: issue.reactions?.confused || 0,
				heart: issue.reactions?.heart || 0,
				rocket: issue.reactions?.rocket || 0,
				eyes: issue.reactions?.eyes || 0,
			},
		};

		// Create a summary header
		const header = `Issue #${issue.number}: ${issue.title}\nState: ${issue.state}${issue.is_pull_request ? " (Pull Request)" : ""}\nAuthor: @${issue.user?.login}\nCreated: ${new Date(issue.created_at).toLocaleString()}\n`;

		return {
			content: [
				{
					type: "text",
					text: `${header}\n${JSON.stringify(formattedIssue, null, 2)}`,
				},
			],
		};
	} catch (error) {
		return {
			content: [
				{
					type: "text",
					text: `Error getting issue: ${error instanceof Error ? error.message : String(error)}`,
				},
			],
		};
	}
};
