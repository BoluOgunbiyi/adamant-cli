import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { EditMatchError, AmbiguousEditError } from './errors.js';

export function applyEdits(edits, repoRoot) {
  const applied = [];
  const failed = [];

  for (const edit of edits) {
    const fullPath = join(repoRoot, edit.path);

    // Handle create_file operations
    if (edit.type === 'create') {
      try {
        mkdirSync(dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, edit.content);
        applied.push(edit);
      } catch (err) {
        failed.push({ path: edit.path, error: new EditMatchError(edit.path, `Could not create file: ${err.message}`) });
      }
      continue;
    }

    // Handle edit_file operations
    try {
      if (!edit.old_content || edit.old_content.trim() === '') {
        failed.push({ path: edit.path, error: new EditMatchError(edit.path, '(empty old_content — would match entire file)') });
        continue;
      }
      let content = readFileSync(fullPath, 'utf-8');
      const occurrences = content.split(edit.old_content).length - 1;

      if (occurrences === 0) {
        failed.push({ path: edit.path, error: new EditMatchError(edit.path, edit.old_content.slice(0, 80)) });
        continue;
      }
      if (occurrences > 1) {
        failed.push({ path: edit.path, error: new AmbiguousEditError(edit.path, occurrences) });
        continue;
      }

      content = content.replace(edit.old_content, edit.new_content);
      writeFileSync(fullPath, content);
      applied.push(edit);
    } catch (err) {
      if (err instanceof EditMatchError || err instanceof AmbiguousEditError) {
        failed.push({ path: edit.path, error: err });
      } else {
        failed.push({ path: edit.path, error: new EditMatchError(edit.path, err.message) });
      }
    }
  }

  return { applied, failed };
}

export async function formatDiff(edits, isTTY) {
  const chalk = (await import('chalk')).default;
  let output = '';
  for (const edit of edits) {
    if (edit.type === 'create') {
      output += isTTY ? `\n  ${chalk.green('+ (new file)')} ${edit.path}\n` : `\n  + (new file) ${edit.path}\n`;
      const lines = edit.content.split('\n').slice(0, 15);
      for (const line of lines) {
        output += isTTY ? `  ${chalk.green('+ ' + line)}\n` : `  + ${line}\n`;
      }
      if (edit.content.split('\n').length > 15) {
        output += isTTY ? `  ${chalk.dim(`... (${edit.content.split('\n').length - 15} more lines)`)}\n` : `  ... (more lines)\n`;
      }
    } else {
      output += `\n  ${edit.path}\n`;
      const oldLines = edit.old_content.split('\n');
      const newLines = edit.new_content.split('\n');
      for (const line of oldLines) {
        output += isTTY ? `  ${chalk.red('- ' + line)}\n` : `  - ${line}\n`;
      }
      for (const line of newLines) {
        output += isTTY ? `  ${chalk.green('+ ' + line)}\n` : `  + ${line}\n`;
      }
    }
  }
  return output;
}
