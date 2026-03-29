import chalk from 'chalk';
import { Octokit } from '@octokit/rest';
import simpleGit from 'simple-git';
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { loadConfig } from './config.js';

const HISTORY_FILE = join(homedir(), '.adamant', 'history.json');
const isTTY = process.stdout.isTTY;

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

  // 2. Get the last undoable wish (skip already undone)
  let last = null;
  let lastIndex = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].status !== 'undone' && history[i].prUrl) {
      last = history[i];
      lastIndex = i;
      break;
    }
  }

  if (!last) {
    console.log('\n  All your wishes have already been undone. Run `adamant wish` to make a new one.\n');
    return;
  }

  console.log('');
  console.log(chalk.bold('  Undoing last wish:'));
  console.log(chalk.dim(`  "${last.wish}"`));
  console.log(chalk.dim(`  PR: ${last.prUrl}`));
  console.log('');

  // 3. Confirm before undoing
  if (isTTY) {
    const { createInterface } = await import('readline');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(resolve => rl.question('  Undo this wish? [Y/n] ', resolve));
    rl.close();
    if (answer.trim().toLowerCase() === 'n') {
      console.log(chalk.dim('  Cancelled.\n'));
      return;
    }
  }

  // 4. Load config for GitHub token
  let config;
  try {
    config = loadConfig();
  } catch {
    console.log(chalk.red('  No config found. Run `adamant config --reset` to set up.\n'));
    return;
  }
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

    if (pr.merged) {
      console.log(chalk.yellow(`  PR #${prNumber} was already merged into ${pr.base.ref}.`));
      console.log(chalk.yellow('  Undo cannot reverse merged code.'));
      console.log(chalk.dim('  Ask your engineer to run: git revert <merge-commit>'));
      console.log('');
      // Mark as merged, not undone
      history[lastIndex].status = 'merged';
      writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), { mode: 0o600 });
      return;
    } else if (pr.state === 'closed') {
      console.log(chalk.dim(`  PR #${prNumber} is already closed.`));
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
    console.log(chalk.red('  Could not reach GitHub to close the PR.'));
    console.log(chalk.dim(`  Close it manually: ${last.prUrl}`));
    if (process.env.DEBUG) console.log(chalk.dim(`  Error: ${err.message}`));
    return;
  }

  // 8. Mark as undone in history (keep the record, add status)
  history[lastIndex].status = 'undone';
  history[lastIndex].undoneAt = new Date().toISOString();
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), { mode: 0o600 });

  console.log('');
  console.log(chalk.green.bold('  Wish undone.'));
  console.log(chalk.dim('  PR closed and branch deleted.'));
  console.log(chalk.dim('  Run `adamant wish` to try again.'));
  console.log('');
}
