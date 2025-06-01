import { z } from "zod";
import type { ToolHandler } from "../types.js";

export const createGithubIssueSchema = z.object({
	owner: z.string().describe("Repository owner's username or organization"),
	repo: z.string().describe("Repository name"),
	title: z.string().describe("Issue title"),
	body: z.string().optional().describe("Issue description"),
	assignees: z.array(z.string()).optional().describe("Array of usernames to assign"),
	labels: z.array(z.string()).optional().describe("Array of label names"),
	milestone: z.number().optional().describe("Milestone number"),
});

export type CreateGithubIssueParams = z.infer<typeof createGithubIssueSchema>;

export const createGithubIssueHandler: ToolHandler<CreateGithubIssueParams> = async (
	{ owner, repo, title, body, assignees, labels, milestone },
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

	const requestBody: any = { title };
	if (body) requestBody.body = body;
	if (assignees) requestBody.assignees = assignees;
	if (labels) requestBody.labels = labels;
	if (milestone) requestBody.milestone = milestone;

	try {
		const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
			method: "POST",
			headers: {
				Accept: "application/vnd.github.v3+json",
				Authorization: `Bearer ${env.GITHUB_AUTH_TOKEN}`,
				"User-Agent": "MCP-GitHub-Issue-Creator",
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
		});

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
};
