#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { configExists } from '../src/config.js';
import { runWish } from '../src/wish.js';
import { runDemo } from '../src/demo.js';
import { formatHistory, formatStats } from '../src/history.js';
import { loadConfig, saveConfig, runSetup } from '../src/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('adamant')
  .description('English to Pull Request in 60 seconds. The PM\'s code tool.')
  .version(pkg.version);

// Wish command
program
  .command('wish')
  .argument('<text...>', 'Describe what you want changed in plain English')
  .description('Make a wish - describe what you want changed in plain English')
  .option('--preview', 'See the diff before creating the PR')
  .option('--dry-run', 'Show what would change without creating anything')
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('--model <model>', 'Claude model to use')
  .option('--file <path>', 'Focus on a specific file or directory')
  .option('--ready', 'Create PR as ready for review (default: draft)')
  .option('--local', 'Apply changes locally without creating a branch or PR')
  .action(async (textParts, options) => {
    const text = textParts.join(' ');
    try {
      await runWish(text, options);
    } catch (err) {
      if (err.userMessage) {
        console.error('\n  ' + chalk.red(err.userMessage));
        if (process.env.DEBUG) console.error(err);
      } else {
        console.error('\n  ' + chalk.red('Something went wrong.'));
        console.error('  ' + chalk.dim(err.message));
        if (process.env.DEBUG) console.error(err);
      }
      process.exit(1);
    }
  });

// Log command
program
  .command('log')
  .description('View your wish history')
  .option('--stats', 'Show aggregated stats')
  .action((options) => {
    const isTTY = process.stdout.isTTY;
    if (options.stats) {
      console.log(formatStats(isTTY));
    } else {
      console.log(formatHistory(isTTY));
    }
  });

// Config command
program
  .command('config')
  .description('View or update your Adamant config')
  .option('--reset', 'Reset config and run setup again')
  .action(async (options) => {
    if (options.reset) {
      await runSetup();
      return;
    }
    if (!configExists()) {
      console.log(chalk.dim('\n  No config found. Run `adamant config --reset` to set up.\n'));
      return;
    }
    const config = loadConfig();
    console.log('\n  Adamant Config:');
    const key = config.anthropic_api_key || '';
  console.log(`  API Key: ${key.slice(0, 7)}...${key.slice(-4)}`);
    console.log(`  GitHub:  ${config.github_token ? 'configured' : 'not set'}`);
    console.log(`  Model:   ${config.default_model || 'claude-sonnet-4-6'}`);
    console.log(`  Preview: ${config.preview_preference === null ? 'ask on first wish' : config.preview_preference}`);
    console.log('');
  });

// Default: show help or demo
program.action(async () => {
  if (!configExists()) {
    await runDemo();
  } else {
    const config = loadConfig();
    console.log('');
    console.log(chalk.bold('  Welcome back to Adamant.'));
    console.log(chalk.dim('  English to Pull Request in 60 seconds.'));
    console.log('');
    console.log('  What would you like to fix today?');
    console.log('');
    console.log(chalk.cyan('    adamant wish "describe the problem in plain English"'));
    console.log('');
    console.log('  ' + chalk.dim('Examples:'));
    console.log(chalk.dim('    adamant wish "users keep abandoning checkout at step 3"'));
    console.log(chalk.dim('    adamant wish "the error messages are confusing and unhelpful"'));
    console.log(chalk.dim('    adamant wish "the settings page is broken on mobile"'));
    console.log('');
    console.log('  ' + chalk.dim('Other commands:'));
    console.log(chalk.dim('    adamant log           - see your wish history'));
    console.log(chalk.dim('    adamant log --stats   - view your impact stats'));
    console.log(chalk.dim('    adamant config        - view your current settings'));
    console.log('');
    console.log('  ' + chalk.dim(`Model: ${config.default_model || 'claude-sonnet-4-6'} · ~$0.20/wish`));
    console.log('');
  }
});

program.parse();

// Check for unknown commands after parsing
const knownCommands = ['wish', 'log', 'config'];
const args = process.argv.slice(2);
if (args.length > 0 && !args[0].startsWith('-') && !knownCommands.includes(args[0])) {
  console.error(`\n  Unknown command: ${args[0]}`);
  console.error('  Run `adamant --help` to see available commands.\n');
  process.exit(1);
}
