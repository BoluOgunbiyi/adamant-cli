import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { AuthError, RateLimitError, TimeoutError, EmptyResponseError, RefusalError } from './errors.js';

const TOOLS = [
  {
    name: 'edit_file',
    description: 'Edit an existing file by replacing old_content with new_content. Include at least 3-5 lines of surrounding context in old_content to ensure a unique match. Only works on files that already exist.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to repo root' },
        old_content: { type: 'string', description: 'Exact text to find (include surrounding context for uniqueness)' },
        new_content: { type: 'string', description: 'Text to replace it with' },
      },
      required: ['path', 'old_content', 'new_content'],
    },
  },
  {
    name: 'create_file',
    description: 'Create a new file with the given content. Use this for new files that do not exist yet. Do NOT use edit_file for new files.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to repo root (directories will be created automatically)' },
        content: { type: 'string', description: 'Full content of the new file' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'read_file',
    description: 'Read the full contents of a file. Use this to understand code before editing.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to repo root' },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_files',
    description: 'Search file contents for a pattern. Returns top 10 matches with 3 lines of context.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search pattern (literal string or simple pattern)' },
      },
      required: ['query'],
    },
  },
];

import { resolve } from 'path';

function isInsideRepo(repoRoot, filePath) {
  const resolved = resolve(repoRoot, filePath);
  return resolved.startsWith(resolve(repoRoot) + '/');
}

function handleToolCall(toolName, input, repoRoot) {
  if (toolName === 'read_file') {
    if (!isInsideRepo(repoRoot, input.path)) {
      return `Error: Path "${input.path}" is outside the repository. Cannot read files outside the project.`;
    }
    try {
      const fullPath = join(repoRoot, input.path);
      const content = readFileSync(fullPath, 'utf-8');
      if (content.length > 100_000) return content.slice(0, 100_000) + '\n... (truncated at 100KB)';
      return content;
    } catch {
      return `Error: File not found: ${input.path}`;
    }
  }

  if (toolName === 'search_files') {
    const tmpPattern = join(tmpdir(), `adamant-search-${Date.now()}.tmp`);
    try {
      writeFileSync(tmpPattern, input.query);
      const result = execSync(
        `grep -rn --exclude-dir=node_modules --exclude-dir=.git -l -F -f "${tmpPattern}" . | head -10`,
        { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 }
      );
      if (!result.trim()) return 'No matches found.';

      const files = result.trim().split('\n').slice(0, 10);
      let output = '';
      for (const file of files) {
        try {
          const grepResult = execSync(
            `grep -n -F -C 3 -f "${tmpPattern}" "${file}"`,
            { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 }
          );
          output += `\n### ${file}\n${grepResult}\n`;
        } catch { /* skip */ }
      }
      return output || 'No matches found.';
    } catch {
      return 'No matches found.';
    } finally {
      try { unlinkSync(tmpPattern); } catch { /* already gone */ }
    }
  }

  if (toolName === 'edit_file') {
    return 'Edit recorded. Will be applied after all edits are collected.';
  }

  if (toolName === 'create_file') {
    return 'File creation recorded. Will be created after all changes are collected.';
  }

  return 'Unknown tool.';
}

export async function callClaude(config, systemPrompt, userPrompt, repoRoot, onProgress) {
  const client = new Anthropic({ apiKey: config.anthropic_api_key });
  const model = config.default_model || 'claude-sonnet-4-6';

  const edits = [];
  let prDescription = '';
  let messages = [{ role: 'user', content: userPrompt }];

  for (let i = 0; i < 5; i++) {
    onProgress?.(i === 0 ? 'Understanding the problem...' : i === 1 ? 'Still searching...' : 'Digging deeper...');

    let response;
    try {
      response = await client.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      });
    } catch (err) {
      if (err.status === 401) throw new AuthError(err.message);
      if (err.status === 429) throw new RateLimitError();
      if (err.message?.includes('timeout')) throw new TimeoutError();
      throw err;
    }

    // Check for refusal
    if (response.stop_reason === 'refusal') {
      throw new RefusalError(response.content?.[0]?.text || 'Unknown reason');
    }

    // Collect edits and text
    const toolUses = [];
    for (const block of response.content) {
      if (block.type === 'text') {
        prDescription += block.text;
      }
      if (block.type === 'tool_use') {
        toolUses.push(block);
        if (block.name === 'edit_file') {
          onProgress?.('Writing the fix...');
          edits.push({
            type: 'edit',
            path: block.input.path,
            old_content: block.input.old_content,
            new_content: block.input.new_content,
          });
        }
        if (block.name === 'create_file') {
          onProgress?.('Creating new file...');
          edits.push({
            type: 'create',
            path: block.input.path,
            content: block.input.content,
          });
        }
      }
    }

    // If no tool calls, we're done
    // On end_turn, only break if there are no non-edit tool calls still needing results
    // (edit_file edits are already collected above - they don't need a follow-up round)
    const pendingNonEditTools = toolUses.filter(tu => tu.name !== 'edit_file' && tu.name !== 'create_file');
    if (toolUses.length === 0 || (response.stop_reason === 'end_turn' && pendingNonEditTools.length === 0)) {
      break;
    }

    // If this is the last iteration and there are still pending tool calls, warn the user
    if (i === 4) {
      onProgress?.('Claude reached the maximum number of steps and may not have finished. Try rephrasing your wish or breaking it into smaller steps.');
      break;
    }

    // Process tool calls and continue the conversation
    const toolResults = toolUses.map(tu => ({
      type: 'tool_result',
      tool_use_id: tu.id,
      content: handleToolCall(tu.name, tu.input, repoRoot),
    }));

    messages = [
      ...messages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResults },
    ];
  }

  if (edits.length === 0 && !prDescription) {
    throw new EmptyResponseError();
  }

  return { edits, prDescription: prDescription.trim() };
}
