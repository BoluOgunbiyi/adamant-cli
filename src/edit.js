import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { EditMatchError, AmbiguousEditError } from './errors.js';

export function applyEdits(edits, repoRoot) {
  const applied = [];
  const failed = [];

  for (const edit of edits) {
    const fullPath = join(repoRoot, edit.path);
    try {
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

export function formatDiff(edits, isTTY) {
  let output = '';
  for (const edit of edits) {
    output += `\n  ${edit.path}\n`;
    const oldLines = edit.old_content.split('\n');
    const newLines = edit.new_content.split('\n');

    for (const line of oldLines) {
      const prefix = isTTY ? '\x1b[31m- ' : '- ';
      const suffix = isTTY ? '\x1b[0m' : '';
      output += `  ${prefix}${line}${suffix}\n`;
    }
    for (const line of newLines) {
      const prefix = isTTY ? '\x1b[32m+ ' : '+ ';
      const suffix = isTTY ? '\x1b[0m' : '';
      output += `  ${prefix}${line}${suffix}\n`;
    }
  }
  return output;
}
