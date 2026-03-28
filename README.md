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

## Install

```bash
npm install -g adamant-cli
```

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

## Commands

```bash
adamant wish "..."           # Make a wish → get a PR
adamant wish "..." --preview # See the diff before creating the PR
adamant wish "..." --dry-run # Show what would change, don't create anything
adamant log                  # See your wish history
adamant log --stats          # Your impact stats
adamant config               # View your settings
```

## FAQ

**How much does it cost?**
~$0.20 per wish. You use your own Claude API key.

**Will it break my code?**
No. PRs are drafts by default. You review everything before merging.

**Is it just Claude Code with extra steps?**
No. Claude Code speaks engineer. Adamant speaks product. You say "checkout abandonment" not "refactor CartCheckout.tsx." The translation is the product.

**What models does it support?**
Claude Sonnet 4.6 by default (fast, ~$0.20/wish). Pass `--model claude-opus-4-6` for higher accuracy on complex wishes.

## Requirements

- Node.js 18+
- A Claude API key ([get one here](https://console.anthropic.com))
- GitHub access (via `gh` CLI or personal access token)

## License

MIT
