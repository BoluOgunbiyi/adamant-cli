import chalk from 'chalk';
import ora from 'ora';
import { join } from 'path';
import { createInterface } from 'readline';
import { loadConfig, runSetup, configExists } from './config.js';
import { buildSystemPrompt, buildUserPrompt } from './prompt.js';
import { readRepo, loadContext, saveContext } from './repo.js';
import { callClaude } from './claude.js';
import { applyEdits, formatDiff } from './edit.js';
import { checkGitState, getRepoRoot, getRemoteUrl, checkRemote, createBranch, commitAndPush, cleanup, popStash } from './git.js';
import { createPR, getDefaultBranch } from './github.js';
import { saveWish } from './history.js';
import { ConfigNotFound } from './errors.js';

const isTTY = process.stdout.isTTY;

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer); }));
}

export async function runWish(wishText, options = {}) {
  const startTime = Date.now();

  // 1. Load config
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigNotFound) {
      console.log('');
      config = await runSetup();
    } else throw err;
  }

  if (options.model) config.default_model = options.model;

  // 2. Check git state (auto-stashes dirty tracked files)
  const repoRoot = await getRepoRoot();

  // Check remote exists before doing any work (skip in local mode)
  if (!options.local) {
    await checkRemote(repoRoot);
  }

  const { branch: originalBranch, wasStashed } = await checkGitState(repoRoot, true);

  // Safety: restore stash if user hits Ctrl+C
  const sigintHandler = async () => {
    if (wasStashed) {
      try { await popStash(repoRoot); } catch {}
    }
    process.exit(130);
  };
  process.on('SIGINT', sigintHandler);

  if (isTTY) {
    console.log('');
    console.log(chalk.dim(`  Repo: ${repoRoot.split('/').pop()}`));
    console.log(chalk.dim(`  Branch: ${originalBranch}`));
    if (wasStashed) console.log(chalk.dim('  Auto-stashed your uncommitted changes (will restore after).'));
    console.log(chalk.dim(`  Wish: "${wishText}"`));
    console.log('');
  }

  // 3. Read repo
  const context = loadContext(repoRoot);
  const { fileTree, fileContents, tokenEstimate, fileCount } = readRepo(wishText, repoRoot, options.file);

  // 4. Cost estimate (per-model pricing)
  const MODEL_PRICING = {
    'claude-sonnet-4-6': { input: 3, output: 15 },
    'claude-opus-4-6': { input: 15, output: 75 },
    'claude-haiku-4-5-20251001': { input: 0.8, output: 4 },
  };
  const model = config.default_model || 'claude-sonnet-4-6';
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['claude-sonnet-4-6'];
  const estimatedCost = (tokenEstimate / 1_000_000) * pricing.input + (3000 / 1_000_000) * pricing.output;
  if (!options.yes && isTTY) {
    const costStr = `$${estimatedCost.toFixed(2)}`;
    const answer = await ask(`  This wish will cost ~${chalk.bold(costStr)}. Proceed? [Y/n] `);
    if (answer.toLowerCase() === 'n') {
      console.log(chalk.dim('  Cancelled.'));
      return;
    }
  }

  // 5. Call Claude with progress
  const spinner = isTTY ? ora({ indent: 2 }).start('Reading your codebase...') : null;
  const onProgress = (stage) => { if (spinner) spinner.text = stage; };

  onProgress('Reading your codebase...');
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(wishText, fileTree, fileContents, context, options.file);

  const { edits, prDescription } = await callClaude(config, systemPrompt, userPrompt, repoRoot, onProgress);

  if (edits.length === 0) {
    spinner?.fail("Adamant analyzed your repo but couldn't find code to change.");
    if (isTTY) {
      console.log('');
      console.log(chalk.dim('  Tips to get better results:'));
      console.log(chalk.dim(' - Name the specific page or screen: "on the settings page, ..."'));
      console.log(chalk.dim(' - Describe what the user sees: "users see a blank screen when ..."'));
      console.log(chalk.dim(' - For new features, say what to add: "add a toast notification that ..."'));
      console.log('');
      console.log(chalk.dim(`  Your wish was: "${wishText}"`));
      console.log(chalk.dim('  Try something like:'));
      console.log(chalk.cyan(`    adamant wish "on the ${wishText.split(' ').slice(-2).join(' ')} page, add a visible indicator so users know it worked"`));
    }
    if (wasStashed) await popStash(repoRoot);
    return;
  }

  spinner?.succeed(`Found ${edits.length} change${edits.length === 1 ? '' : 's'}`);

  // 6. Apply edits
  const { applied, failed } = applyEdits(edits, repoRoot);

  if (applied.length === 0) {
    console.log(chalk.red("  Couldn't apply any changes. The code may have changed since Adamant read it."));
    for (const f of failed) console.log(chalk.dim(`  ${f.error.userMessage}`));
    if (wasStashed) await popStash(repoRoot);
    return;
  }

  if (failed.length > 0) {
    console.log(chalk.yellow(`  ${failed.length} edit${failed.length === 1 ? '' : 's'} couldn't be applied:`));
    for (const f of failed) console.log(chalk.dim(`    ${f.error.userMessage}`));
  }

  // 7. Preview gate
  const showPreview = options.preview || options.dryRun || config.preview_preference === null;

  if (options.dryRun) {
    if (isTTY) {
      console.log('');
      console.log(chalk.bold('  Changes:'));
      console.log(await formatDiff(applied, isTTY));
      console.log('');
      console.log(chalk.bold('  PR Description:'));
      console.log('  ' + prDescription.split('\n').join('\n  '));
    } else {
      console.log(await formatDiff(applied, false));
      console.log(prDescription);
    }
    console.log(isTTY ? chalk.dim('  --dry-run: No branch or PR created.') : '--dry-run: No branch or PR created.');
    // Revert changes
    const { execFileSync } = await import('child_process');
    const { unlinkSync } = await import('fs');
    for (const edit of applied) {
      if (edit.type === 'create') {
        try { unlinkSync(join(repoRoot, edit.path)); } catch { /* already gone */ }
      } else {
        execFileSync('git', ['checkout', '--', edit.path], { cwd: repoRoot });
      }
    }
    if (wasStashed) await popStash(repoRoot);
    return;
  }

  if (showPreview && isTTY) {
    console.log('');
    console.log(chalk.bold('  Changes:'));
    console.log(await formatDiff(applied, isTTY));
    console.log('');
    console.log(chalk.bold('  PR Description:'));
    console.log('  ' + prDescription.split('\n').join('\n  '));
    console.log('');

    if (config.preview_preference === null) {
      let choice = '';
      while (!['s', 'e', 'c'].includes(choice)) {
        const answer = await ask('  [s]ubmit / [e]dit wish / [c]ancel: ');
        choice = answer.trim().toLowerCase().charAt(0) || '';
        if (!['s', 'e', 'c'].includes(choice)) {
          console.log(chalk.dim("  Type 's' to submit, 'e' to edit, or 'c' to cancel."));
        }
      }

      if (choice === 'c') {
        const { execFileSync } = await import('child_process');
        const { unlinkSync } = await import('fs');
        for (const edit of applied) {
          if (edit.type === 'create') {
            try { unlinkSync(join(repoRoot, edit.path)); } catch {}
          } else {
            execFileSync('git', ['checkout', '--', edit.path], { cwd: repoRoot });
          }
        }
        console.log(chalk.dim('  Cancelled. No changes made.'));
        if (wasStashed) await popStash(repoRoot);
        return;
      }

      if (choice === 'e') {
        const { execFileSync } = await import('child_process');
        const { unlinkSync } = await import('fs');
        for (const edit of applied) {
          if (edit.type === 'create') {
            try { unlinkSync(join(repoRoot, edit.path)); } catch {}
          } else {
            execFileSync('git', ['checkout', '--', edit.path], { cwd: repoRoot });
          }
        }
        if (wasStashed) await popStash(repoRoot);
        const newWish = await ask('  New wish: ');
        if (newWish.trim()) {
          return runWish(newWish.trim(), { ...options, preview: true });
        }
        console.log(chalk.dim('  Cancelled.'));
        return;
      }

      // 's' = submit - save preference (skip preview next time)
      const { saveConfig } = await import('./config.js');
      config.preview_preference = 'skip';
      saveConfig(config);
    }
  }

  // 8. Local mode - keep changes on disk, skip branch/commit/push/PR
  if (options.local) {
    if (isTTY) {
      console.log('');
      console.log(chalk.bold('  Changes:'));
      console.log(await formatDiff(applied, isTTY));
      console.log('');
    }

    // Save context (codebase learning)
    try { saveContext(repoRoot, wishText, applied); } catch { /* non-blocking */ }

    // Restore stashed changes
    if (wasStashed) {
      await popStash(repoRoot);
      if (isTTY) console.log(chalk.dim('  Restored your uncommitted changes.'));
    }

    if (isTTY) {
      console.log(chalk.green.bold('  Changes applied locally. No branch or PR created.'));
      console.log(chalk.dim(`  Files changed: ${applied.length}`));
      console.log('');
    } else {
      console.log('Changes applied locally. No branch or PR created.');
      console.log(`Files: ${applied.map(e => e.path).join(', ')}`);
    }
    return;
  }

  // 9. Create branch, commit, push
  const wishBranch = await createBranch(repoRoot, wishText);
  onProgress?.('Creating pull request...');

  const featPrefixPattern = /^(add|create|build)\b/i;
  const commitPrefix = featPrefixPattern.test(wishText.trim()) ? 'feat' : 'fix';
  const commitMsg = `${commitPrefix}: ${wishText}\n\nGenerated by Adamant CLI\nCo-Authored-By: Adamant CLI <wish@adamant.dev>`;
  try {
    await commitAndPush(repoRoot, commitMsg, applied.map(e => e.path));
  } catch (err) {
    await cleanup(repoRoot, originalBranch, wishBranch);
    if (wasStashed) await popStash(repoRoot);
    throw err;
  }

  // 10. Create draft PR
  const remoteUrl = await getRemoteUrl(repoRoot);
  const defaultBranch = await getDefaultBranch(config, remoteUrl);

  const prTitlePrefix = commitPrefix === 'feat' ? 'Add' : 'Fix';
  const prTitle = `${prTitlePrefix}: ${wishText.charAt(0).toUpperCase() + wishText.slice(1)}`;
  let prUrl, prNumber;
  try {
    ({ url: prUrl, number: prNumber } = await createPR(config, {
      title: prTitle,
      body: prDescription,
      branch: wishBranch,
      base: defaultBranch,
      draft: !options.ready,
      remoteUrl,
    }));
  } catch (err) {
    await cleanup(repoRoot, originalBranch, wishBranch);
    if (wasStashed) await popStash(repoRoot);
    throw err;
  }

  // 10. Save history
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const actualCost = estimatedCost; // Approximate
  saveWish({ wish: wishText, prUrl, prNumber, repo: repoRoot.split('/').pop(), cost: actualCost, filesChanged: applied.length });

  // 11. Save context
  try { saveContext(repoRoot, wishText, applied); } catch { /* non-blocking */ }

  // 12. Return to original branch (enables chaining: wish && wish && wish)
  const { default: simpleGit } = await import('simple-git');
  const git = simpleGit(repoRoot);
  await git.checkout(originalBranch);

  // 13. Restore stashed changes
  if (wasStashed) {
    await popStash(repoRoot);
    if (isTTY) console.log(chalk.dim('  Restored your uncommitted changes.'));
  }

  // 14. Show result
  const { getHistory } = await import('./history.js');
  const isFirstWish = getHistory().length <= 1; // just saved this one
  if (isTTY) {
    console.log('');
    if (isFirstWish) {
      console.log(chalk.green.bold('  Your first wish, granted!'));
      console.log(chalk.green('  You just shipped a fix without writing code.'));
    } else {
      console.log(chalk.green.bold('  Wish granted!'));
    }
    console.log('');
    console.log(`  PR: ${prTitle}`);
    console.log(chalk.cyan(`  ${prUrl}`));
    console.log('');
    console.log(chalk.dim(`  Files changed: ${applied.length}`));
    console.log(chalk.dim(`  Cost: ~$${actualCost.toFixed(2)} | Time: ${elapsed}s`));
    console.log(chalk.dim('  Changed your mind? Run `adamant undo` to close this PR.'));
    console.log('');
  } else {
    // Plain output for piping
    console.log(`PR: ${prUrl}`);
    console.log(`Title: ${prTitle}`);
    console.log(`Files: ${applied.map(e => e.path).join(', ')}`);
  }

  // Clean up SIGINT handler
  process.removeListener('SIGINT', sigintHandler);
}
