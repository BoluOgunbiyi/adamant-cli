import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractKeywords, readRepo, loadContext, saveContext } from '../src/repo.js';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const TMP = join(process.cwd(), 'test', '.tmp-repo');

function initGitRepo() {
  mkdirSync(TMP, { recursive: true });
  execSync('git init', { cwd: TMP, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: TMP, stdio: 'ignore' });
  execSync('git config user.name "Test"', { cwd: TMP, stdio: 'ignore' });
}

function commitFiles(files) {
  for (const [path, content] of Object.entries(files)) {
    const full = join(TMP, path);
    mkdirSync(join(TMP, path, '..').replace(join(path, '..'), ''), { recursive: true });
    const dir = full.substring(0, full.lastIndexOf('/'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(full, content);
  }
  execSync('git add -A && git commit -m "init"', { cwd: TMP, stdio: 'ignore' });
}

beforeEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('extractKeywords', () => {
  it('extracts meaningful words from a wish', () => {
    const kw = extractKeywords('users keep abandoning checkout at step 3');
    expect(kw).toContain('users');
    expect(kw).toContain('abandoning');
    expect(kw).toContain('checkout');
    expect(kw).toContain('step');
    expect(kw).not.toContain('at');
    expect(kw).not.toContain('keep');
  });

  it('filters stop words', () => {
    const kw = extractKeywords('fix the broken thing in my app');
    expect(kw).not.toContain('the');
    expect(kw).not.toContain('fix');
    expect(kw).not.toContain('my');
    expect(kw).toContain('broken');
    expect(kw).toContain('thing');
    expect(kw).toContain('app');
  });

  it('handles empty input', () => {
    const kw = extractKeywords('');
    expect(kw).toEqual([]);
  });

  it('handles all stop words', () => {
    const kw = extractKeywords('fix the is are a an');
    expect(kw).toEqual([]);
  });

  it('strips punctuation', () => {
    const kw = extractKeywords("can't load the checkout page!");
    expect(kw).toContain('load');
    expect(kw).toContain('checkout');
    expect(kw).toContain('page');
  });
});

describe('readRepo', () => {
  it('reads a simple git repo', () => {
    initGitRepo();
    commitFiles({
      'package.json': '{"name": "test"}',
      'src/app.js': 'console.log("hello")',
      'src/checkout/Cart.js': 'export function Cart() {}',
    });
    const result = readRepo('fix the checkout', TMP);
    expect(result.fileCount).toBe(3);
    expect(result.fileTree).toContain('src/checkout/Cart.js');
    expect(result.fileContents.some(f => f.path === 'package.json')).toBe(true);
    expect(result.fileContents.some(f => f.path.includes('checkout'))).toBe(true);
  });

  it('matches files by keyword', () => {
    initGitRepo();
    commitFiles({
      'package.json': '{}',
      'src/login.js': 'login code',
      'src/dashboard.js': 'dashboard code',
      'src/settings.js': 'settings code',
    });
    const result = readRepo('fix the dashboard loading', TMP);
    expect(result.fileContents.some(f => f.path.includes('dashboard'))).toBe(true);
  });

  it('prioritizes target file when --file is used', () => {
    initGitRepo();
    commitFiles({
      'package.json': '{}',
      'src/a.js': 'aaa',
      'src/b.js': 'bbb',
      'src/target.js': 'target content',
    });
    const result = readRepo('fix something', TMP, 'src/target.js');
    expect(result.fileContents[0].path).toBe('src/target.js');
  });

  it('matches directory with --file flag', () => {
    initGitRepo();
    commitFiles({
      'package.json': '{}',
      'src/components/Button.js': 'button',
      'src/components/Input.js': 'input',
      'src/utils/helpers.js': 'helpers',
    });
    const result = readRepo('fix components', TMP, 'src/components');
    const paths = result.fileContents.map(f => f.path);
    expect(paths).toContain('src/components/Button.js');
    expect(paths).toContain('src/components/Input.js');
  });

  it('throws on empty repo', () => {
    initGitRepo();
    expect(() => readRepo('anything', TMP)).toThrow('no tracked files');
  });

  it('always includes package.json', () => {
    initGitRepo();
    commitFiles({
      'package.json': '{"name": "test"}',
      'src/random.js': 'code',
    });
    const result = readRepo('something unrelated', TMP);
    expect(result.fileContents.some(f => f.path === 'package.json')).toBe(true);
  });
});

describe('context', () => {
  it('saves and loads context', () => {
    initGitRepo();
    commitFiles({ 'src/app.js': 'code' });

    saveContext(TMP, 'fix checkout flow', [{ path: 'src/checkout.js' }]);
    const ctx = loadContext(TMP);
    expect(ctx).not.toBeNull();
    expect(ctx.wishes).toHaveLength(1);
    expect(ctx.wishes[0].wish).toBe('fix checkout flow');
    expect(Object.keys(ctx.fileMap).length).toBeGreaterThan(0);
  });

  it('returns null when no context exists', () => {
    initGitRepo();
    commitFiles({ 'src/app.js': 'code' });
    expect(loadContext(TMP)).toBeNull();
  });

  it('accumulates context across saves', () => {
    initGitRepo();
    commitFiles({ 'src/app.js': 'code' });

    saveContext(TMP, 'fix checkout', [{ path: 'src/checkout.js' }]);
    saveContext(TMP, 'fix login', [{ path: 'src/login.js' }]);
    const ctx = loadContext(TMP);
    expect(ctx.wishes).toHaveLength(2);
  });
});
