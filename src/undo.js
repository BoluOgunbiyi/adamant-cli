import chalk from 'chalk';
import { Octokit } from '@octokit/rest';
import simpleGit from 'simple-git';
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { loadConfig } from './config.js';

const HISTORY_FILE = join(homedir(), '.adamant', 'history.json');
const isTTY = process.stdout.isTTY;

function parseRemoteUrl(url) {
  let match = url.match(/github[^/]*[:/](.+?)\/(.+?)(?:\.git)?$/);
  if (match) return { owner: match[1], repo: match[2] };
  return null;
}

export async function runUndo() {
  // 1. Load history
  let history;
  try {
    history = JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'));
  } catch {
    console.log('\n  No wish history found. Nothing to undo.\n');
    return;
  }

  if (history.length === 0) {
    console.log('\n  No wishes to undo. Make a wish first.\n');
    return;
  }

  // 2. Get the last wish
  const last = history[history.length - 1];

  if (!last.prUrl) {
    console.log('\n  Last wish has no PR (may have been --local or --dry-run). Nothing to undo.\n');
    return;
  }

  console.log('');
  console.log(chalk.bold('  Undoing last wish:'));
  console.log(chalk.dim(`  "${last.wish}"`));
  console.log(chalk.dim(`  PR: ${last.prUrl}`));
  console.log('');

  // 3. Load config for GitHub token
  const config = loadConfig();
  const octokit = new Octokit({ auth: config.github_token });

  // 4. Extract owner/repo/number from PR URL
  const prMatch = last.prUrl.match(/github\.com\/(.+?)\/(.+?)\/pull\/(\d+)/);
  if (!prMatch) {
    console.log(chalk.red('  Could not parse PR URL. Close it manually on GitHub.\n'));
    return;
  }

  const [, owner, repo, prNumberStr] = prMatch;
  const prNumber = parseInt(prNumberStr);

  // 5. Close the PR
  try {
    const { data: pr } = await octokit.pulls.get({ owner, repo, pull_number: prNumber });

    if (pr.state === 'closed' || pr.merged) {
      console.log(chalk.dim(`  PR #${prNumber} is already ${pr.merged ? 'merged' : 'closed'}.`));
    } else {
      await octokit.pulls.update({ owner, repo, pull_number: prNumber, state: 'closed' });
      console.log(chalk.green(`  Closed PR #${prNumber}.`));
    }

    // 6. Delete the remote branch
    const branchName = pr.head.ref;
    try {
      await octokit.git.deleteRef({ owner, repo, ref: `heads/${branchName}` });
      console.log(chalk.green(`  Deleted remote branch: ${branchName}`));
    } catch {
      console.log(chalk.dim(`  Remote branch already deleted or not found.`));
    }

    // 7. Delete the local branch if it exists
    try {
      const git = simpleGit();
      const branches = await git.branchLocal();
      if (branches.all.includes(branchName)) {
        await git.deleteLocalBranch(branchName, true);
        console.log(chalk.green(`  Deleted local branch: ${branchName}`));
      }
    } catch { /* not in a git repo or branch doesn't exist locally */ }

  } catch (err) {
    console.log(chalk.red(`  Could not close PR: ${err.message}`));
    console.log(chalk.dim('  You may need to close it manually on GitHub.\n'));
    return;
  }

  // 8. Remove from history
  history.pop();
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), { mode: 0o600 });

  console.log('');
  console.log(chalk.green.bold('  Wish undone.'));
  console.log(chalk.dim(`  PR closed. Branch deleted. History updated.`));
  console.log('');
}
