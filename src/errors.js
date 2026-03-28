// Error classes for Adamant CLI

export class ConfigNotFound extends Error {
  constructor() {
    super('Config not found');
    this.userMessage = "No config found. Let's get you set up!";
  }
}

export class ConfigParseError extends Error {
  constructor() {
    super('Config file is corrupted');
    this.userMessage = 'Config file is corrupted. Run `adamant config --reset` to fix it.';
  }
}

export class InvalidConfigError extends Error {
  constructor(field) {
    super(`Invalid config: ${field}`);
    this.userMessage = `Invalid ${field}. Run \`adamant config\` to check your settings.`;
  }
}

export class AuthError extends Error {
  constructor(msg) {
    super(msg);
    this.userMessage = 'Claude API key rejected. Run `adamant config` to update it.';
  }
}

export class RateLimitError extends Error {
  constructor() {
    super('Rate limited');
    this.userMessage = 'Rate limited by Claude API. Wait a minute and try again.';
  }
}

export class TimeoutError extends Error {
  constructor() {
    super('Request timed out');
    this.userMessage = 'Request timed out. Try a shorter wish or a smaller repo.';
  }
}

export class EmptyResponseError extends Error {
  constructor() {
    super('Empty response');
    this.userMessage = "Adamant couldn't figure out the right fix. Try rephrasing your wish with more detail about which part of the app is affected.";
  }
}

export class MalformedEditError extends Error {
  constructor(detail) {
    super(`Malformed edit: ${detail}`);
    this.userMessage = "Adamant got confused generating the fix. Here's what it tried:";
  }
}

export class RefusalError extends Error {
  constructor(reason) {
    super(`Refused: ${reason}`);
    this.userMessage = `Claude declined this wish: ${reason}`;
  }
}

export class NotGitRepoError extends Error {
  constructor() {
    super('Not a git repo');
    this.userMessage = 'Not in a git repo. Run this from inside a project.';
  }
}

export class DirtyTreeError extends Error {
  constructor() {
    super('Dirty working tree');
    this.userMessage = "Adamant tried to save your in-progress work but couldn't. Ask your engineer to commit or stash, then try again.";
  }
}

export class GitPushError extends Error {
  constructor(msg) {
    super(msg);
    this.userMessage = "Can't push to remote. Make sure you have push access to this repo.";
  }
}

export class BranchExistsError extends Error {
  constructor(branch) {
    super(`Branch exists: ${branch}`);
    this.userMessage = 'Branch name collision. Retrying with timestamp...';
  }
}

export class GitHubAuthError extends Error {
  constructor() {
    super('GitHub auth failed');
    this.userMessage = 'GitHub authentication failed. Run `adamant config` to update your token.';
  }
}

export class RepoNotFoundError extends Error {
  constructor(repo) {
    super(`Repo not found: ${repo}`);
    this.userMessage = `Repository not found on GitHub: ${repo}`;
  }
}

export class EditMatchError extends Error {
  constructor(path, snippet) {
    super(`No match in ${path}`);
    this.path = path;
    this.snippet = snippet;
    this.userMessage = `Couldn't apply change to ${path}. The code Adamant expected to find wasn't there.`;
  }
}

export class AmbiguousEditError extends Error {
  constructor(path, count) {
    super(`${count} matches in ${path}`);
    this.path = path;
    this.count = count;
    this.userMessage = `Found ${count} matching locations in ${path}. Skipping this edit to be safe.`;
  }
}

export class NoRemoteError extends Error {
  constructor() {
    super('No remote origin');
    this.userMessage = "This repo isn't connected to GitHub yet. Run `git remote add origin https://github.com/YOU/REPO.git` first, then try again.";
  }
}
