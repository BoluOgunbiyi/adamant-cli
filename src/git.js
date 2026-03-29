import simpleGit from 'simple-git';
import { NotGitRepoError, DirtyTreeError, GitPushError, NoRemoteError } from './errors.js';

export async function checkGitState(repoRoot, autoStash = true) {
  const git = simpleGit(repoRoot);

  const isRepo = await git.checkIsRepo();
  if (!isRepo) throw new NotGitRepoError();

  const status = await git.status();

  // Check for detached HEAD
  if (!status.current) {
    throw new DirtyTreeError(); // Reuse - detached HEAD is not a safe state for wishes
  }

  // Only check tracked files (modified, staged, deleted) - ignore untracked files
  const trackedDirty = status.files.filter(f => f.index !== '?' && f.working_dir !== '?');

  if (trackedDirty.length > 0) {
    if (autoStash) {
      // Auto-stash dirty tracked files so the PM doesn't have to deal with git
      await git.stash(['push', '-m', 'adamant-auto-stash']);
      // Check again after stash
      const postStash = await git.status();
      const stillDirty = postStash.files.filter(f => f.index !== '?' && f.working_dir !== '?');
      if (stillDirty.length > 0) {
        throw new DirtyTreeError();
      }
      return { branch: status.current, isClean: true, wasStashed: true };
    }
    throw new DirtyTreeError();
  }

  return { branch: status.current, isClean: true, wasStashed: false };
}

export async function checkRemote(repoRoot) {
  const git = simpleGit(repoRoot);
  const remotes = await git.getRemotes(true);
  const origin = remotes.find(r => r.name === 'origin');
  if (!origin || (!origin.refs?.push && !origin.refs?.fetch)) {
    throw new NoRemoteError();
  }
  return origin;
}

export async function popStash(repoRoot) {
  const git = simpleGit(repoRoot);
  try {
    // Check if our auto-stash exists
    const stashList = await git.stashList();
    if (stashList.total > 0 && stashList.latest?.message?.includes('adamant-auto-stash')) {
      await git.stash(['pop']);
    }
  } catch { /* best effort - don't break the flow */ }
}

export async function getRepoRoot() {
  const git = simpleGit();
  try {
    return (await git.revparse(['--show-toplevel'])).trim();
  } catch {
    throw new NotGitRepoError();
  }
}

export async function getRemoteUrl(repoRoot) {
  const git = simpleGit(repoRoot);
  try {
    const remotes = await git.getRemotes(true);
    const origin = remotes.find(r => r.name === 'origin');
    return origin?.refs?.push || origin?.refs?.fetch || '';
  } catch {
    return '';
  }
}

function slugify(text) {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
  return slug || 'wish';
}

export async function createBranch(repoRoot, wish) {
  const git = simpleGit(repoRoot);
  const slug = slugify(wish);
  const ts = Date.now().toString(36);
  const branch = `wish/${slug}-${ts}`;

  await git.checkoutLocalBranch(branch);
  return branch;
}

export async function commitAndPush(repoRoot, message, editedFiles = []) {
  const git = simpleGit(repoRoot);
  try {
    // Only stage files Adamant actually edited - never stage untracked files
    if (editedFiles.length > 0) {
      await git.add(editedFiles);
    } else {
      await git.add('.');
    }
    await git.commit(message);
    await git.push('origin', 'HEAD', ['--set-upstream']);
  } catch (err) {
    throw new GitPushError(err.message);
  }
}

export async function cleanup(repoRoot, originalBranch, wishBranch) {
  const git = simpleGit(repoRoot);
  try {
    await git.checkout(originalBranch);
    await git.deleteLocalBranch(wishBranch, true);
  } catch { /* best effort */ }
}
