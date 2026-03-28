// Error classes for Adamant CLI

export class ConfigNotFound extends Error {
  constructor() {
    super('Config not found');
    this.userMessage = "No config found. Run `adamant config` to get set up — it takes about 30 seconds.";
  }
}

export class ConfigParseError extends Error {
  constructor() {
    super('Config file is corrupted');
    this.userMessage = 'Your config file is corrupted and can\'t be read. Run `adamant config --reset` to wipe it and start fresh.';
  }
}

export class InvalidConfigError extends Error {
  constructor(field) {
    super(`Invalid config: ${field}`);
    this.userMessage = `Your ${field} looks invalid. Run \`adamant config\` to check and update your settings.`;
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
    this.userMessage = "You've hit the Claude API rate limit. Wait a minute and try again, or check your plan limits at console.anthropic.com.";
  }
}

export class TimeoutError extends Error {
  constructor() {
    super('Request timed out');
    this.userMessage = "The request to Claude timed out — your repo may be too large to process in one shot. Try running from a subdirectory, or break your wish into a smaller, more specific ask.";
  }
}

export class EmptyResponseError extends Error {
  constructor() {
    super('Empty response');
    this.userMessage = "Adamant couldn't figure out the right fix. Try rephrasing your wish with more detail — for example, mention the specific screen, feature, or file that needs changing.";
  }
}

export class MalformedEditError extends Error {
  constructor(detail) {
    super(`Malformed edit: ${detail}`);
    this.userMessage = `Adamant generated a change it couldn't apply (${detail}). Try rephrasing your wish, or use --preview to inspect what it produces.`;
  }
}

export class RefusalError extends Error {
  constructor(reason) {
    super(`Refused: ${reason}`);
    this.userMessage = `Claude declined to process this wish. Try rephrasing it — if your wish touches auth, secrets, or security-sensitive code, try being more specific about the UX problem instead.\n  Details: ${reason}`;
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
    this.userMessage = 'You have uncommitted changes. Commit or stash them first so Adamant can create a clean branch.';
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
