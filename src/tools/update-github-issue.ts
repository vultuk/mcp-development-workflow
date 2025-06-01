import { z } from "zod";
import type { ToolHandler } from "../types.js";

export const updateGithubIssueSchema = z.object({
	owner: z.string().describe("Repository owner's username or organization"),
	repo: z.string().describe("Repository name"),
	issue_number: z.number().describe("Issue number to update"),
	title: z.string().optional().describe("New title for the issue"),
	body: z.string().optional().describe("New body content for the issue"),
	state: z.enum(["open", "closed"]).optional().describe("Issue state"),
	state_reason: z
		.enum(["completed", "not_planned", "reopened"])
		.optional()
		.describe("Reason for closing (only when state is 'closed')"),
	labels: z.array(z.string()).optional().describe("Array of label names to set"),
	assignees: z.array(z.string()).optional().describe("Array of usernames to assign"),
	milestone: z.number().nullable().optional().describe("Milestone number (null to remove)"),
});

export type UpdateGithubIssueParams = z.infer<typeof updateGithubIssueSchema>;

export const updateGithubIssueHandler: ToolHandler<UpdateGithubIssueParams> = async (
	{ owner, repo, issue_number, title, body, state, state_reason, labels, assignees, milestone },
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

	// Build the update payload
	const updatePayload: any = {};
	if (title !== undefined) updatePayload.title = title;
	if (body !== undefined) updatePayload.body = body;
	if (state !== undefined) updatePayload.state = state;
	if (state_reason !== undefined && state === "closed") {
		updatePayload.state_reason = state_reason;
	}
	if (labels !== undefined) updatePayload.labels = labels;
	if (assignees !== undefined) updatePayload.assignees = assignees;
	if (milestone !== undefined) updatePayload.milestone = milestone;

	// Check if there's anything to update
	if (Object.keys(updatePayload).length === 0) {
		return {
			content: [
				{
					type: "text",
					text: "Error: No fields provided to update",
				},
			],
		};
	}

	try {
		const response = await fetch(
			`https://api.github.com/repos/${owner}/${repo}/issues/${issue_number}`,
			{
				method: "PATCH",
				headers: {
					Accept: "application/vnd.github.v3+json",
					Authorization: `Bearer ${env.GITHUB_AUTH_TOKEN}`,
					"User-Agent": "MCP-GitHub-Issue-Creator",
					"Content-Type": "application/json",
				},
				body: JSON.stringify(updatePayload),
			},
		);

		if (!response.ok) {
			const errorData = (await response.json()) as any;
			return {
				content: [
					{
						type: "text",
						text: `Error updating issue: ${response.status} - ${errorData.message || JSON.stringify(errorData)}`,
					},
				],
			};
		}

		const updatedIssue = (await response.json()) as any;

		// Build a summary of what was updated
		const updates: string[] = [];
		if (title !== undefined) updates.push(`title: "${title}"`);
		if (body !== undefined)
			updates.push(`body: ${body.length > 50 ? body.substring(0, 50) + "..." : `"${body}"`}`);
		if (state !== undefined) updates.push(`state: ${state}`);
		if (state_reason !== undefined && state === "closed")
			updates.push(`state_reason: ${state_reason}`);
		if (labels !== undefined) updates.push(`labels: [${labels.join(", ")}]`);
		if (assignees !== undefined) updates.push(`assignees: [${assignees.join(", ")}]`);
		if (milestone !== undefined)
			updates.push(`milestone: ${milestone === null ? "removed" : `#${milestone}`}`);

		return {
			content: [
				{
					type: "text",
					text: `Successfully updated issue #${issue_number}: ${updatedIssue.title}\n\nUpdated fields:\n${updates.map((u) => `- ${u}`).join("\n")}\n\nURL: ${updatedIssue.html_url}`,
				},
			],
		};
	} catch (error) {
		return {
			content: [
				{
					type: "text",
					text: `Error updating issue: ${error instanceof Error ? error.message : String(error)}`,
				},
			],
		};
	}
};
