import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { AuthError, RateLimitError, TimeoutError, EmptyResponseError, RefusalError } from './errors.js';

const TOOLS = [
  {
    name: 'edit_file',
    description: 'Edit a file by replacing old_content with new_content. Include at least 3-5 lines of surrounding context in old_content to ensure a unique match.',
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

function handleToolCall(toolName, input, repoRoot) {
  if (toolName === 'read_file') {
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
    try {
      const result = execSync(
        `grep -rn --include='*' -l "${input.query.replace(/"/g, '\\"')}" . | head -10`,
        { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 }
      );
      if (!result.trim()) return 'No matches found.';

      const files = result.trim().split('\n').slice(0, 10);
      let output = '';
      for (const file of files) {
        try {
          const grepResult = execSync(
            `grep -n -C 3 "${input.query.replace(/"/g, '\\"')}" "${file}"`,
            { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 }
          );
          output += `\n### ${file}\n${grepResult}\n`;
        } catch { /* skip */ }
      }
      return output || 'No matches found.';
    } catch {
      return 'No matches found.';
    }
  }

  if (toolName === 'edit_file') {
    // edit_file is collected, not executed during the API call
    return 'Edit recorded. Will be applied after all edits are collected.';
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
    onProgress?.(i === 0 ? 'Understanding the problem...' : `Finding the right files... (round ${i + 1})`);

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
            path: block.input.path,
            old_content: block.input.old_content,
            new_content: block.input.new_content,
          });
        }
      }
    }

    // If no tool calls, we're done
    if (toolUses.length === 0 || response.stop_reason === 'end_turn') {
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
