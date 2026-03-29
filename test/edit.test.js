import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyEdits } from '../src/edit.js';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';

const TMP = join(process.cwd(), 'test', '.tmp-edit');

beforeEach(() => { mkdirSync(TMP, { recursive: true }); });
afterEach(() => { rmSync(TMP, { recursive: true, force: true }); });

describe('applyEdits', () => {
  it('applies a single edit with unique match', () => {
    writeFileSync(join(TMP, 'app.js'), 'const x = 1;\nconst y = 2;\nconst z = 3;\n');
    const { applied, failed } = applyEdits([{ type: 'edit', path: 'app.js', old_content: 'const y = 2;', new_content: 'const y = 99;' }], TMP);
    expect(applied).toHaveLength(1);
    expect(failed).toHaveLength(0);
    expect(readFileSync(join(TMP, 'app.js'), 'utf-8')).toContain('const y = 99;');
  });

  it('fails when old_content not found', () => {
    writeFileSync(join(TMP, 'app.js'), 'const x = 1;\n');
    const { applied, failed } = applyEdits([{ type: 'edit', path: 'app.js', old_content: 'const y = 2;', new_content: 'const y = 99;' }], TMP);
    expect(applied).toHaveLength(0);
    expect(failed).toHaveLength(1);
  });

  it('fails when old_content matches multiple times', () => {
    writeFileSync(join(TMP, 'app.js'), 'const x = 1;\nconst x = 1;\n');
    const { applied, failed } = applyEdits([{ type: 'edit', path: 'app.js', old_content: 'const x = 1;', new_content: 'const x = 99;' }], TMP);
    expect(applied).toHaveLength(0);
    expect(failed).toHaveLength(1);
  });

  it('rejects empty old_content', () => {
    writeFileSync(join(TMP, 'app.js'), 'const x = 1;\n');
    const { applied, failed } = applyEdits([{ type: 'edit', path: 'app.js', old_content: '', new_content: 'something' }], TMP);
    expect(applied).toHaveLength(0);
    expect(failed).toHaveLength(1);
  });

  it('rejects whitespace-only old_content', () => {
    writeFileSync(join(TMP, 'app.js'), 'const x = 1;\n');
    const { applied, failed } = applyEdits([{ type: 'edit', path: 'app.js', old_content: '   \n  ', new_content: 'something' }], TMP);
    expect(applied).toHaveLength(0);
    expect(failed).toHaveLength(1);
  });

  it('creates a new file', () => {
    const { applied } = applyEdits([{ type: 'create', path: 'new.js', content: 'hello\n' }], TMP);
    expect(applied).toHaveLength(1);
    expect(readFileSync(join(TMP, 'new.js'), 'utf-8')).toBe('hello\n');
  });

  it('creates a new file in nested directory', () => {
    const { applied } = applyEdits([{ type: 'create', path: 'src/components/Button.tsx', content: 'export function Button() {}' }], TMP);
    expect(applied).toHaveLength(1);
    expect(readFileSync(join(TMP, 'src/components/Button.tsx'), 'utf-8')).toBe('export function Button() {}');
  });

  it('applies multiple edits to different files', () => {
    writeFileSync(join(TMP, 'a.js'), 'const a = 1;\n');
    writeFileSync(join(TMP, 'b.js'), 'const b = 2;\n');
    const { applied } = applyEdits([
      { type: 'edit', path: 'a.js', old_content: 'const a = 1;', new_content: 'const a = 10;' },
      { type: 'edit', path: 'b.js', old_content: 'const b = 2;', new_content: 'const b = 20;' },
    ], TMP);
    expect(applied).toHaveLength(2);
  });

  it('handles mixed success and failure', () => {
    writeFileSync(join(TMP, 'a.js'), 'const a = 1;\n');
    const { applied, failed } = applyEdits([
      { type: 'edit', path: 'a.js', old_content: 'const a = 1;', new_content: 'const a = 10;' },
      { type: 'edit', path: 'missing.js', old_content: 'nope', new_content: 'yep' },
    ], TMP);
    expect(applied).toHaveLength(1);
    expect(failed).toHaveLength(1);
  });

  it('fails gracefully when file does not exist', () => {
    const { applied, failed } = applyEdits([{ type: 'edit', path: 'nope.js', old_content: 'x', new_content: 'y' }], TMP);
    expect(applied).toHaveLength(0);
    expect(failed).toHaveLength(1);
  });
});
