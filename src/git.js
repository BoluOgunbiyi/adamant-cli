import simpleGit from 'simple-git';
import { NotGitRepoError, DirtyTreeError, GitPushError } from './errors.js';

export async function checkGitState(repoRoot) {
  const git = simpleGit(repoRoot);

  const isRepo = await git.checkIsRepo();
  if (!isRepo) throw new NotGitRepoError();

  const status = await git.status();
  if (status.files.length > 0) throw new DirtyTreeError();

  return { branch: status.current, isClean: true };
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
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
}

export async function createBranch(repoRoot, wish) {
  const git = simpleGit(repoRoot);
  const slug = slugify(wish);
  const ts = Date.now().toString(36);
  const branch = `wish/${slug}-${ts}`;

  await git.checkoutLocalBranch(branch);
  return branch;
}

export async function commitAndPush(repoRoot, message) {
  const git = simpleGit(repoRoot);
  try {
    await git.add('.');
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
