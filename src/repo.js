import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const STOP_WORDS = new Set([
  'the', 'is', 'are', 'a', 'an', 'to', 'in', 'on', 'at', 'for', 'of', 'with',
  'and', 'or', 'but', 'not', 'my', 'our', 'their', 'this', 'that', 'it', 'fix',
  'make', 'change', 'update', 'improve', 'add', 'remove', 'when', 'too', 'very',
  'keep', 'can', 'do', 'does', 'have', 'has', 'be', 'been', 'being', 'was', 'were',
  'should', 'could', 'would', 'will', 'get', 'got', 'more', 'less', 'just',
]);

const ALWAYS_INCLUDE = ['package.json', 'README.md', 'readme.md'];
const MAX_CHARS = 200_000; // ~50K tokens

export function extractKeywords(wish) {
  return wish
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

export function readRepo(wish, repoRoot) {
  let rawFiles;
  try {
    rawFiles = execSync('git ls-files', { cwd: repoRoot, encoding: 'utf-8' });
  } catch {
    rawFiles = '';
  }
  const files = rawFiles.trim().split('\n').filter(Boolean);
  if (files.length === 0) {
    throw new Error('This repo has no tracked files. Make at least one commit first.');
  }
  const fileTree = files.join('\n');

  const keywords = extractKeywords(wish);
  const matchedPaths = [];

  for (const name of ALWAYS_INCLUDE) {
    const match = files.find(f => f.endsWith(name) && f.split('/').length <= 2);
    if (match && !matchedPaths.includes(match)) matchedPaths.push(match);
  }

  for (const file of files) {
    const lower = file.toLowerCase();
    for (const kw of keywords) {
      if (lower.includes(kw) && !matchedPaths.includes(file)) {
        matchedPaths.push(file);
        break;
      }
    }
  }

  const cappedPaths = matchedPaths.slice(0, 20);
  let totalChars = fileTree.length;
  const fileContents = [];

  for (const path of cappedPaths) {
    try {
      const fullPath = join(repoRoot, path);
      const content = readFileSync(fullPath, 'utf-8');
      if (totalChars + content.length > MAX_CHARS) break;
      totalChars += content.length;
      fileContents.push({ path, content });
    } catch { /* skip unreadable */ }
  }

  return { fileTree, fileContents, tokenEstimate: Math.ceil(totalChars / 4), fileCount: files.length };
}

export function loadContext(repoRoot) {
  const contextPath = join(repoRoot, '.adamant', 'context.json');
  if (!existsSync(contextPath)) return null;
  try { return JSON.parse(readFileSync(contextPath, 'utf-8')); } catch { return null; }
}

export function saveContext(repoRoot, wish, edits) {
  const contextDir = join(repoRoot, '.adamant');
  const contextPath = join(contextDir, 'context.json');
  let context = loadContext(repoRoot) || { fileMap: {}, wishes: [] };

  const keywords = extractKeywords(wish);
  const featureKey = keywords.slice(0, 3).join('-') || 'general';
  const editedFiles = edits.map(e => e.path);

  context.fileMap[featureKey] = [...new Set([...(context.fileMap[featureKey] || []), ...editedFiles])];
  context.wishes.push({ wish, files: editedFiles, timestamp: new Date().toISOString() });
  if (context.wishes.length > 50) context.wishes = context.wishes.slice(-50);

  mkdirSync(contextDir, { recursive: true });
  writeFileSync(contextPath, JSON.stringify(context, null, 2));
}
