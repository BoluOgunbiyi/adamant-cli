import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const HISTORY_FILE = join(homedir(), '.adamant', 'history.json');

export function saveWish({ wish, prUrl, repo, cost, filesChanged, prNumber }) {
  mkdirSync(join(homedir(), '.adamant'), { recursive: true });
  const history = getHistory();
  history.push({
    wish,
    prUrl,
    prNumber,
    repo,
    cost,
    filesChanged,
    timestamp: new Date().toISOString(),
  });
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), { mode: 0o600 });
}

export function getHistory() {
  if (!existsSync(HISTORY_FILE)) return [];
  try { return JSON.parse(readFileSync(HISTORY_FILE, 'utf-8')); } catch { return []; }
}

export function getStats() {
  const history = getHistory();
  const active = history.filter(h => h.status !== 'undone');
  const undone = history.filter(h => h.status === 'undone');
  const repos = new Set(active.map(h => h.repo));
  const totalCost = history.reduce((sum, h) => sum + (h.cost || 0), 0);
  return {
    totalWishes: history.length,
    activeWishes: active.length,
    undoneWishes: undone.length,
    totalRepos: repos.size,
    prsCreated: active.filter(h => h.prUrl).length,
    totalCost,
  };
}

export function formatHistory(isTTY) {
  const history = getHistory();
  if (history.length === 0) {
    return '\n  No wishes yet.\n\n  Try your first wish:\n    adamant wish "make the error messages more helpful"\n';
  }

  let output = '\n';
  for (const entry of history.slice(-20).reverse()) {
    const date = new Date(entry.timestamp).toLocaleDateString();
    const cost = entry.cost ? ` ($${entry.cost.toFixed(2)})` : '';
    const undone = entry.status === 'undone' ? ' [undone]' : '';
    output += `  ${date}  "${entry.wish}"${cost}${undone}\n`;
    if (entry.prUrl) output += `           ${entry.prUrl}\n`;
    output += '\n';
  }
  return output;
}

export function formatStats(isTTY) {
  const stats = getStats();
  if (stats.totalWishes === 0) {
    return '\n  No wishes yet. Make your first wish and\n  your stats will appear here.\n';
  }

  const fixes = stats.prsCreated;
  const undoneNote = stats.undoneWishes > 0 ? `\n  ${stats.undoneWishes} undone.` : '';
  return `
  You've made ${stats.totalWishes} wish${stats.totalWishes === 1 ? '' : 'es'} across ${stats.totalRepos} repo${stats.totalRepos === 1 ? '' : 's'}.
  ${fixes} PR${fixes === 1 ? '' : 's'} shipped.${undoneNote}

  Total cost: $${stats.totalCost.toFixed(2)}
`;
}
