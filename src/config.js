import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import { createInterface } from 'readline';
import { ConfigNotFound, ConfigParseError } from './errors.js';

const CONFIG_DIR = join(homedir(), '.adamant');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export function configExists() {
  return existsSync(CONFIG_FILE);
}

export function loadConfig() {
  if (!existsSync(CONFIG_FILE)) {
    throw new ConfigNotFound();
  }
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    throw new ConfigParseError();
  }
}

export function saveConfig(config) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

export async function runSetup() {
  const isTTY = process.stdout.isTTY;
  const chalk = (await import('chalk')).default;

  console.log('');
  console.log(chalk.bold('  Welcome to Adamant! ') + "Let's get you set up (30 seconds).");
  console.log('');

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  // 1. Claude API key
  console.log(chalk.dim('  1. Claude API key'));
  console.log(chalk.dim('     Get one at console.anthropic.com'));
  const apiKey = await ask(rl, '     Paste your key: ');
  if (!apiKey || !apiKey.startsWith('sk-')) {
    console.log(chalk.yellow("     That doesn't look right. Keys start with 'sk-'."));
    console.log(chalk.yellow('     You can fix this later with `adamant config`.'));
  }
  console.log('');

  // 2. GitHub token
  console.log(chalk.dim('  2. GitHub auth'));
  let githubToken = '';
  try {
    githubToken = execSync('gh auth token 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (githubToken) {
      console.log(chalk.green('     Found gh CLI auth. Using that.'));
    }
  } catch {
    // gh not available
  }
  if (!githubToken) {
    console.log(chalk.dim('     No gh CLI found. Paste a personal access token (repo scope):'));
    githubToken = await ask(rl, '     Token: ');
  }
  console.log('');

  // 3. Model
  const defaultModel = 'claude-sonnet-4-6';
  console.log(chalk.dim(`  3. Default model: ${defaultModel} (fast + affordable, ~$0.20/wish)`));
  console.log(chalk.dim('     Change anytime with --model flag'));
  console.log('');

  rl.close();

  const config = {
    anthropic_api_key: apiKey.trim(),
    github_token: githubToken.trim(),
    default_model: defaultModel,
    preview_preference: null, // null = ask on first wish
  };

  saveConfig(config);

  console.log(chalk.green.bold('  Done! ') + 'Try your first wish:');
  console.log('');
  console.log(chalk.cyan('    adamant wish "make the error messages more helpful"'));
  console.log('');

  return config;
}
