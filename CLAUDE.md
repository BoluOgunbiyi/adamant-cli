# Adamant CLI

The decision-to-code tool for product teams.

## Project Structure

```
bin/cli.js       Entry point (commander)
src/wish.js      Pipeline orchestrator
src/claude.js    Claude API client with tool-use
src/edit.js      Apply structured edits
src/repo.js      Read repo + keyword matching
src/git.js       Git operations
src/github.js    PR creation via Octokit
src/config.js    Auth + setup
src/history.js   Wish history + stats
src/demo.js      Demo mode
src/errors.js    Error classes
src/prompt.js    System prompt
```

## Conventions

- ES modules (import/export)
- chalk for colors, ora for spinners
- Every error has a `userMessage` property
- TTY detection for pipe-friendly output
