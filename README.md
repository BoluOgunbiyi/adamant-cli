# adamant

> I'm a PM. I just shipped a fix to production without opening Jira.

<!-- TODO: Add 30-second GIF demo here -->

## Try it now

```bash
npx adamant-cli
```

No install. No API key. See what Adamant does in 30 seconds.

## How it works

You describe what's wrong with your product in plain English.
Adamant reads your code and opens a pull request.

| Today (without Adamant) | With Adamant |
|------------------------|--------------|
| User reports issue | You type one sentence |
| PM writes ticket | Adamant reads your codebase |
| PM writes spec | Adamant writes the fix |
| Engineer implements | Adamant opens a PR |
| Code review + merge | You review + merge |
| **~3 weeks** | **~60 seconds** |

## Setup

### 1. Install

```bash
npm install -g adamant-cli
```

Requires Node.js 18 or higher.

### 2. Get a Claude API key

Go to [console.anthropic.com](https://console.anthropic.com) and create an API key. Keys start with `sk-ant-`.

### 3. Set up GitHub access

Either install the [GitHub CLI](https://cli.github.com) and run `gh auth login`, or have a [personal access token](https://github.com/settings/tokens) ready with `repo` scope.

### 4. Run first-time setup

```bash
adamant
```

Adamant will walk you through entering your API key and GitHub token. Takes about 30 seconds. Config is stored at `~/.adamant/config.json`.

---

## Examples

```bash
# Fix a UX problem
adamant wish "users keep abandoning checkout at step 3"

# Improve error handling
adamant wish "the error messages are confusing and don't explain what to do"

# Speed things up
adamant wish "loading is too slow on the dashboard"

# Mobile issues
adamant wish "the settings page is broken on mobile"
```

## What you get

A draft PR on GitHub with:
- Code changes in the right files
- A description written for PMs, not engineers
- Expected user impact

You review. You merge. Your product is better.

---

## Commands

### `adamant wish "<description>"`

Describe what you want changed in plain English. Adamant reads your repo, writes the fix, and opens a draft PR.

```bash
adamant wish "the error messages are confusing"
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--preview` | Show the diff and PR description before creating the PR |
| `--dry-run` | Show what would change without creating a branch or PR |
| `--yes` / `-y` | Skip the cost confirmation prompt |
| `--model <model>` | Use a specific Claude model (see Models section below) |
| `--ready` | Create the PR as ready for review instead of a draft |

```bash
# Preview changes before submitting
adamant wish "loading is too slow on the dashboard" --preview

# Skip confirmation, no PR created
adamant wish "fix the mobile layout" --dry-run

# Skip cost confirmation
adamant wish "improve error messages" --yes

# Use a more powerful model for complex changes
adamant wish "refactor the checkout flow" --model claude-opus-4-6

# Open PR as ready for review (not a draft)
adamant wish "fix typo in settings page" --ready
```

---

### `adamant log`

View your wish history — every wish you've made, the PR it opened, and what it cost.

```bash
adamant log
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--stats` | Show aggregated stats (total wishes, PRs opened, total cost) |

```bash
adamant log --stats
```

---

### `adamant config`

View your current Adamant configuration: API key, GitHub token status, default model, and preview preference.

```bash
adamant config
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--reset` | Wipe your config and run the setup wizard again |

```bash
# Re-run setup (e.g. to update your API key or GitHub token)
adamant config --reset
```

---

## Models

| Model | Flag value | Speed | Cost per wish | Best for |
|-------|-----------|-------|---------------|----------|
| Claude Sonnet 4.6 *(default)* | `claude-sonnet-4-6` | Fast | ~$0.20 | Most wishes |
| Claude Opus 4.6 | `claude-opus-4-6` | Slower | ~$1.00 | Complex or large codebases |
| Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | Fastest | ~$0.05 | Simple, focused changes |

Switch models per-wish with `--model`:
```bash
adamant wish "redesign the onboarding flow" --model claude-opus-4-6
```

---

## FAQ

**How much does it cost?**
~$0.20 per wish using the default model. You use your own Claude API key and pay Anthropic directly. Adamant itself is free.

**Will it break my code?**
No. PRs are drafts by default. You review everything before merging. Use `--dry-run` to preview changes without creating anything.

**Is it just Claude Code with extra steps?**
No. Claude Code speaks engineer. Adamant speaks product. You say "checkout abandonment" not "refactor CartCheckout.tsx." The translation is the product.

**Can I change the default model?**
Not via a config flag yet, but you can pass `--model` on any wish. Run `adamant config --reset` to re-run setup if you want to reconfigure your key or token.

**What if I have uncommitted changes?**
Adamant will auto-stash them before running and restore them after. You'll see a note in the output when this happens.

## Roadmap

What's coming next for Adamant:

| Feature | Description |
|---------|-------------|
| **Extension Integration** *(V3)* | The Adamant Chrome extension watches what users actually experience — capturing screenshots, rage clicks, and friction signals in real time. The CLI fixes code. V3 connects them: a PM spots a problem in the browser, clicks "wish", and Adamant automatically triggers the CLI to generate and open a PR. No copy-paste, no ticket — the wish flows directly from what the user sees in the browser to a code fix on GitHub. |
| `adamant fix <PR-URL>` | Point Adamant at a stale or stuck PR and let it diagnose what's blocking it — conflicts, failing checks, outdated reviews — and push a fix |
| `adamant scan` | Run Adamant against your whole repo to surface UX friction before users report it — slow pages, broken flows, confusing errors |
| Self-improving prompt agent | Adamant learns from every wish it fulfills, getting better at understanding your codebase and your team's patterns over time |
| Linear + Slack integration | Pipe wishes in directly from a Linear ticket or Slack message — no copy-paste required |
| JSON output mode | Get structured output from any command (`--json`) for scripting, dashboards, or piping into other tools |

Want to influence what gets built first? [Open an issue](https://github.com/adamant-cli/adamant/issues) or share feedback.

---

## Requirements

- Node.js 18+
- A Claude API key ([get one here](https://console.anthropic.com))
- GitHub access (via `gh` CLI or personal access token with `repo` scope)

## License

MIT
