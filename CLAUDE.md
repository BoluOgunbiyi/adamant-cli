# Adamant CLI — Architecture & Developer Guide

> This file is for developers (and AI coding assistants) working on the Adamant codebase.
> For end-user documentation, see [README.md](./README.md).

---

## What Adamant Does

Adamant is a CLI tool that turns plain-English product descriptions into GitHub pull requests.
A PM types `adamant wish "users keep abandoning checkout"`, and Adamant reads the codebase,
calls Claude to write the fix, applies the edits to disk, commits them to a new branch, and
opens a draft PR — all without the PM writing any code.

---

## Project Structure

```
bin/
  cli.js          — Entry point. Wires up Commander commands (wish, log, config).

src/
  wish.js         — Orchestrator for the full wish pipeline (steps 1–13).
  prompt.js       — Builds the system + user prompts sent to Claude.
  claude.js       — Claude API client. Manages the tool-use loop.
  repo.js         — Reads the repo for Claude: file tree, keyword-matched file contents,
                    and per-repo context memory (.adamant/context.json).
  edit.js         — Applies edits returned by Claude to disk. Produces diff output.
  git.js          — Git operations: stash, branch, commit, push, cleanup.
  github.js       — GitHub API: create PR, get default branch, parse remote URL.
  config.js       — Loads/saves ~/.adamant/config.json. Runs interactive setup wizard.
  history.js      — Logs wishes to ~/.adamant/history.json. Formats log + stats output.
  errors.js       — All custom error classes with user-facing messages.
  demo.js         — First-run walkthrough for unconfigured users.
```

---

## The Full Wish Pipeline (`src/wish.js`)

The `runWish()` function runs these steps in order:

1. **Load config** — reads `~/.adamant/config.json`. If missing, triggers the setup wizard.
2. **Git safety check** — finds the repo root, verifies a remote exists, auto-stashes any
   dirty tracked files so the working tree is clean before applying edits.
3. **Read repo** — builds a file tree and keyword-matches file contents to send to Claude.
4. **Cost estimate** — calculates an approximate Claude API cost based on token count + model
   pricing, and prompts the user to confirm (skippable with `--yes`).
5. **Call Claude** — sends system + user prompts and runs the tool-use loop until Claude
   returns edits and a PR description.
6. **Apply edits** — writes Claude's edit/create operations to disk.
7. **Preview gate** — if `--preview` or `--dry-run` is set, shows the diff and PR description.
   `--dry-run` also reverts changes and exits without creating anything.
8. **Create branch** — `wish/<slug>-<timestamp>` (e.g. `wish/fix-checkout-abandonment-1k4x2`).
9. **Commit & push** — stages only the files Adamant edited, commits, pushes to origin.
10. **Create PR** — opens a draft PR via GitHub API with the Claude-generated description.
11. **Save history** — appends the wish to `~/.adamant/history.json`.
12. **Save context** — writes a keyword→file mapping to `.adamant/context.json` in the repo,
    so future wishes benefit from knowing which files were touched for similar features.
13. **Restore stash** — pops the auto-stash (if any) and switches back to the original branch.

---

## How the System Prompt Works (`src/prompt.js`)

The system prompt defines Claude's *identity and constraints*. The user prompt carries the
*data* for a specific wish. They are built separately and combined in `callClaude()`.

### System Prompt (`buildSystemPrompt()`)

This is the most important file in the product. It tells Claude:

- **Its role**: "You are Adamant, a PM-to-engineer translator."
- **How to think**: Understand user intent, find the right files, make minimal changes.
- **File targeting rules**: Never touch global stylesheets, config files, or test files
  unless the wish explicitly mentions them. Prefer the most specific file.
- **Which tools to use** (and when): `read_file`, `search_files`, `edit_file`, `create_file`.
- **How to write the PR description**: A fixed, PM-readable format covering what users
  experience before/after, why the fix works, expected impact, and files changed.
- **Hard rules**: edit_file only for existing files; create_file only for new files;
  always include 3–5 lines of context in `old_content` to ensure unique matches.

The system prompt is intentionally opinionated — it constrains Claude toward small, targeted
changes rather than broad refactors, and toward PM-readable output rather than technical prose.

### User Prompt (`buildUserPrompt()`)

Assembled fresh for every wish. Contains:

1. The wish text verbatim.
2. The full git file tree (all tracked files).
3. Prior context: a keyword→file map from previous wishes on this repo (from `.adamant/context.json`).
4. Keyword-matched file contents (up to ~50K tokens / 200KB).
5. Instructions reminding Claude to use tools if it needs more files.

---

## The Claude Tool-Use Loop (`src/claude.js`)

Claude is given four tools: `read_file`, `search_files`, `edit_file`, `create_file`.

The loop runs up to 5 iterations:

1. Send the current message history to the Claude API.
2. Collect all `tool_use` blocks from the response.
3. For `edit_file` and `create_file` calls: record the edit in the `edits` array (do not apply yet — Claude's edits are batched and applied after the loop).
4. For `read_file` and `search_files` calls: execute immediately and return the result as a `tool_result` message, then loop again.
5. Break when Claude returns no tool calls, or when only edit/create calls remain and `stop_reason === 'end_turn'`.

**Why edits are deferred**: Claude may read a file and then edit it in the same session.
Applying edits during the loop would corrupt subsequent reads of the same file. Deferring
also makes rollback (dry-run, cancel) cleaner.

**Edit application** happens in `src/edit.js` → `applyEdits()`:
- `edit_file`: exact string match of `old_content` within the file. Fails if 0 or >1 matches.
- `create_file`: writes the file, creating parent directories as needed.

---

## Key Design Decisions

### 1. Keyword-based file selection, not full-repo indexing
`src/repo.js` reads only files whose names contain keywords from the wish. This keeps
token costs low and avoids overwhelming Claude with irrelevant code. Claude can always
call `read_file` to pull in additional files it needs.

### 2. Auto-stash instead of blocking on dirty state
Rather than asking the PM to `git stash` themselves, `src/git.js` auto-stashes dirty
tracked files before applying edits and pops the stash afterward. Untracked files are
left alone.

### 3. Exact-match edits (not full-file rewrites)
`edit_file` requires specifying the exact substring to replace. This is intentional:
it forces Claude to be surgical, makes diffs small and reviewable, and avoids
accidentally clobbering code it didn't read.

### 4. Draft PRs by default
All PRs are opened as drafts unless `--ready` is passed. This gives the user a chance
to review before the PR is visible to the team.

### 5. Per-repo context memory
`.adamant/context.json` maps wish keywords → files touched. On subsequent wishes, this
history is included in the user prompt so Claude can route to the right files faster.

### 6. Global config, local context
`~/.adamant/config.json` — API keys, model, preferences (user-level, never committed).
`.adamant/context.json` — wish history for this repo (repo-level, should be gitignored or committed as a team artifact).

### 7. Branch naming: `wish/<slug>-<timestamp>`
The timestamp suffix (base-36) prevents collisions when the same wish is run twice.
The slug is truncated to 40 chars to stay well under GitHub's 255-char branch limit.

---

## Error Handling

All user-facing errors extend standard `Error` and add a `userMessage` string.
`bin/cli.js` checks for `err.userMessage` and prints it with `chalk.red`. If no
`userMessage` is present, a generic "Something went wrong" message is shown.

Custom error types live in `src/errors.js`. Key ones:

| Error | When it fires |
|-------|--------------|
| `ConfigNotFound` | `~/.adamant/config.json` doesn't exist |
| `AuthError` | Claude API key is invalid (401) |
| `RateLimitError` | Claude API rate limit hit (429) |
| `EmptyResponseError` | Claude returned no edits and no description |
| `EditMatchError` | `old_content` not found in the target file |
| `AmbiguousEditError` | `old_content` matches more than once in the file |
| `NotGitRepoError` | Not inside a git repo |
| `DirtyTreeError` | Auto-stash failed or detached HEAD |
| `NoRemoteError` | No `origin` remote configured |
| `GitHubAuthError` | GitHub token invalid/missing |

---

## Config Schema (`~/.adamant/config.json`)

```json
{
  "anthropic_api_key": "sk-ant-...",
  "github_token": "ghp_...",
  "default_model": "claude-sonnet-4-6",
  "preview_preference": null
}
```

- `preview_preference`: `null` = ask the user on their first wish; `"skip"` = never show preview by default.
- File is written with mode `0o600` (owner read/write only).

---

## Adding a New Command

1. Add the command in `bin/cli.js` using `program.command(...)`.
2. Implement the handler in a new `src/<name>.js` module.
3. Add any new error types to `src/errors.js` with a `userMessage`.

## Adding a New Claude Tool

1. Add the tool definition to the `TOOLS` array in `src/claude.js`.
2. Add a handler branch in `handleToolCall()` in the same file.
3. Update the system prompt in `src/prompt.js` to tell Claude when to use it.

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@anthropic-ai/sdk` | Claude API client |
| `@octokit/rest` | GitHub REST API client |
| `chalk` | Terminal color output |
| `commander` | CLI argument parsing |
| `glob` | (available, currently unused in core) |
| `ora` | Spinner for long-running operations |
| `simple-git` | Git operations |

Dev: `vitest` for testing.

---

## Environment

- **Node.js 18+** required (uses native `fetch`, `fs/promises` patterns).
- **ESM only** (`"type": "module"` in package.json). Use `.js` extensions on all imports.
- No build step — source files are run directly by Node.
