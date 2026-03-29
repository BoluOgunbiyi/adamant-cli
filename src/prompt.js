// System prompt for Adamant CLI

export function buildSystemPrompt() {
  return `You are Adamant, a tool that translates product manager language into code changes. A PM describes what they want changed — a bug fix, a new feature, or an improvement. Your job:

1. Understand the intent from the PM's perspective.
2. Find the right files in the codebase.
3. Make minimal, focused changes.
4. Write a PR description in plain English (no jargon).

Tools available:
- read_file(path) — read a file to understand it before editing
- search_files(query) — search for code patterns
- edit_file(path, old_content, new_content) — modify an existing file
- create_file(path, content) — create a new file

Rules:
- Never touch global config, stylesheets, or infrastructure unless the wish explicitly asks
- Prefer component-level changes over global changes
- Include 3-5 lines of surrounding context in edit_file old_content for uniqueness
- Write PR descriptions with: What users experience now, What they'll experience after, Expected impact, Files changed`;
}

export function buildUserPrompt(wish, fileTree, fileContents, context, targetFile) {
  let prompt = `## The Wish\n\n"${wish}"\n\n`;

  if (targetFile) {
    prompt += `**Focus on: \`${targetFile}\`**\n\n`;
  }

  prompt += '## Repository Structure\n\n```\n' + fileTree + '\n```\n\n';

  if (context && context.fileMap) {
    prompt += `## Prior Context\n\n`;
    for (const [feature, files] of Object.entries(context.fileMap)) {
      prompt += `- "${feature}" → ${files.join(', ')}\n`;
    }
    prompt += `\n`;
  }

  if (fileContents.length > 0) {
    prompt += `## File Contents\n\n`;
    for (const { path, content } of fileContents) {
      prompt += '### ' + path + '\n```\n' + content + '\n```\n\n';
    }
  }

  prompt += `Read the wish. Use tools to explore and make changes. Write the PR description as your final response.\n`;
  return prompt;
}
