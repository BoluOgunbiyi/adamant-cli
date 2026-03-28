import chalk from 'chalk';
import ora from 'ora';
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

  // Check remote exists before doing any work
  await checkRemote(repoRoot);

  const { branch: originalBranch, wasStashed } = await checkGitState(repoRoot, true);

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
  const { fileTree, fileContents, tokenEstimate, fileCount } = readRepo(wishText, repoRoot);

  // 4. Cost estimate
  const estimatedCost = (tokenEstimate / 1_000_000) * 3 + 0.045; // input + ~3K output
  if (!options.yes && isTTY) {
    const costStr = `$${estimatedCost.toFixed(2)}`;
    const answer = await ask(`  This wish will use ~${tokenEstimate.toLocaleString()} tokens (~${costStr}). Proceed? [Y/n] `);
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
  const userPrompt = buildUserPrompt(wishText, fileTree, fileContents, context);

  const { edits, prDescription } = await callClaude(config, systemPrompt, userPrompt, repoRoot, onProgress);

  if (edits.length === 0) {
    spinner?.fail("Adamant analyzed your repo but couldn't find code to change.");
    if (isTTY) {
      console.log('');
      console.log(chalk.dim('  Tips to get better results:'));
      console.log(chalk.dim('  - Name the specific page or screen: "on the settings page, ..."'));
      console.log(chalk.dim('  - Describe what the user sees: "users see a blank screen when ..."'));
      console.log(chalk.dim('  - For new features, say what to add: "add a toast notification that ..."'));
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
      console.log(formatDiff(applied, isTTY));
      console.log('');
      console.log(chalk.bold('  PR Description:'));
      console.log('  ' + prDescription.split('\n').join('\n  '));
    } else {
      console.log(formatDiff(applied, false));
      console.log(prDescription);
    }
    console.log(isTTY ? chalk.dim('  --dry-run: No branch or PR created.') : '--dry-run: No branch or PR created.');
    // Revert applied edits
    for (const edit of applied) {
      const { readFileSync, writeFileSync } = await import('fs');
      const { join } = await import('path');
      const fullPath = join(repoRoot, edit.path);
      let content = readFileSync(fullPath, 'utf-8');
      content = content.replace(edit.new_content, edit.old_content);
      writeFileSync(fullPath, content);
    }
    return;
  }

  if (showPreview && isTTY) {
    console.log('');
    console.log(chalk.bold('  Changes:'));
    console.log(formatDiff(applied, isTTY));
    console.log('');
    console.log(chalk.bold('  PR Description:'));
    console.log('  ' + prDescription.split('\n').join('\n  '));
    console.log('');

    if (config.preview_preference === null) {
      const answer = await ask('  [s]ubmit / [e]dit wish / [c]ancel: ');
      const choice = answer.trim().toLowerCase();

      if (choice === 'c') {
        // Revert edits
        for (const edit of applied) {
          const { readFileSync, writeFileSync } = await import('fs');
          const { join } = await import('path');
          const fullPath = join(repoRoot, edit.path);
          let content = readFileSync(fullPath, 'utf-8');
          content = content.replace(edit.new_content, edit.old_content);
          writeFileSync(fullPath, content);
        }
        console.log(chalk.dim('  Cancelled. No changes made.'));
        return;
      }

      if (choice === 'e') {
        // Revert and re-run with new wish
        for (const edit of applied) {
          const { readFileSync, writeFileSync } = await import('fs');
          const { join } = await import('path');
          const fullPath = join(repoRoot, edit.path);
          let content = readFileSync(fullPath, 'utf-8');
          content = content.replace(edit.new_content, edit.old_content);
          writeFileSync(fullPath, content);
        }
        const newWish = await ask('  New wish: ');
        if (newWish.trim()) {
          return runWish(newWish.trim(), { ...options, preview: true });
        }
        console.log(chalk.dim('  Cancelled.'));
        return;
      }

      // Save preference (skip preview next time)
      const { saveConfig } = await import('./config.js');
      config.preview_preference = 'skip';
      saveConfig(config);
    }
  }

  // 8. Create branch, commit, push
  const wishBranch = await createBranch(repoRoot, wishText);
  onProgress?.('Creating pull request...');

  const commitMsg = `fix: ${wishText}\n\nGenerated by Adamant CLI`;
  try {
    await commitAndPush(repoRoot, commitMsg);
  } catch (err) {
    await cleanup(repoRoot, originalBranch, wishBranch);
    throw err;
  }

  // 9. Create draft PR
  const remoteUrl = await getRemoteUrl(repoRoot);
  const defaultBranch = await getDefaultBranch(config, remoteUrl);

  const prTitle = `Fix: ${wishText.charAt(0).toUpperCase() + wishText.slice(1)}`;
  const { url: prUrl, number: prNumber } = await createPR(config, {
    title: prTitle,
    body: prDescription,
    branch: wishBranch,
    base: defaultBranch,
    draft: !options.noDraft,
    remoteUrl,
  });

  // 10. Save history
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const actualCost = estimatedCost; // Approximate
  saveWish({ wish: wishText, prUrl, prNumber, repo: repoRoot.split('/').pop(), cost: actualCost, filesChanged: applied.length });

  // 11. Save context
  try { saveContext(repoRoot, wishText, applied); } catch { /* non-blocking */ }

  // 12. Restore stashed changes
  if (wasStashed) {
    await cleanup(repoRoot, originalBranch, wishBranch);
    await popStash(repoRoot);
    if (isTTY) console.log(chalk.dim('  Restored your uncommitted changes.'));
  }

  // 13. Show result
  if (isTTY) {
    console.log('');
    console.log(chalk.green.bold('  Wish granted!'));
    console.log('');
    console.log(`  PR: ${prTitle}`);
    console.log(chalk.cyan(`  ${prUrl}`));
    console.log('');
    console.log(chalk.dim(`  Files changed: ${applied.length}`));
    console.log(chalk.dim(`  Cost: ~$${actualCost.toFixed(2)} | Time: ${elapsed}s`));
    console.log('');
  } else {
    // Plain output for piping
    console.log(`PR: ${prUrl}`);
    console.log(`Title: ${prTitle}`);
    console.log(`Files: ${applied.map(e => e.path).join(', ')}`);
  }
}
