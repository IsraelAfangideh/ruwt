import { describe, it, expect } from 'vitest';
import { buildIDESystemPrompt } from './ide-system-prompt';

describe('buildIDESystemPrompt', () => {
  const baseOpts = {
    mode: 'agent' as const,
    fileTree: ['index.js', 'package.json', 'src/app.ts'],
    language: 'typescript',
  };

  // ── Role per mode ─────────────────────────────────────────────────────

  it('returns prompt with agent role for agent mode', () => {
    const prompt = buildIDESystemPrompt({ ...baseOpts, mode: 'agent' });
    expect(prompt).toContain('autonomous');
    expect(prompt).toContain('tool');
  });

  it('returns prompt with ask role for ask mode', () => {
    const prompt = buildIDESystemPrompt({ ...baseOpts, mode: 'ask' });
    expect(prompt).toContain('explain');
    expect(prompt).not.toContain('SEARCH/REPLACE');
  });

  it('returns prompt with plan role for plan mode', () => {
    const prompt = buildIDESystemPrompt({ ...baseOpts, mode: 'plan' });
    expect(prompt).toContain('plan');
  });

  it('returns prompt with debug role for debug mode', () => {
    const prompt = buildIDESystemPrompt({ ...baseOpts, mode: 'debug' });
    expect(prompt).toContain('debug');
  });

  // ── Context injection ─────────────────────────────────────────────────

  it('includes file tree when provided', () => {
    const prompt = buildIDESystemPrompt(baseOpts);
    expect(prompt).toContain('index.js');
    expect(prompt).toContain('src/app.ts');
    expect(prompt).toContain('package.json');
  });

  it('includes current file content', () => {
    const prompt = buildIDESystemPrompt({
      ...baseOpts,
      currentFile: { path: 'src/app.ts', content: 'const x = 42;' },
    });
    expect(prompt).toContain('src/app.ts');
    expect(prompt).toContain('const x = 42;');
  });

  it('includes package.json content', () => {
    const prompt = buildIDESystemPrompt({
      ...baseOpts,
      packageJson: '{"name":"my-project","dependencies":{"react":"^19"}}',
    });
    expect(prompt).toContain('my-project');
    expect(prompt).toContain('react');
  });

  // ── Tool definitions ──────────────────────────────────────────────────

  it('includes tool definitions for agent mode', () => {
    const prompt = buildIDESystemPrompt({ ...baseOpts, mode: 'agent', includeToolDefs: true });
    expect(prompt).toContain('read_file');
    expect(prompt).toContain('write_file');
    expect(prompt).toContain('list_files');
    expect(prompt).toContain('search_files');
    expect(prompt).toContain('run_command');
  });

  it('omits tool definitions for ask mode', () => {
    const prompt = buildIDESystemPrompt({ ...baseOpts, mode: 'ask' });
    expect(prompt).not.toContain('read_file');
    expect(prompt).not.toContain('write_file');
  });

  it('omits tool definitions when includeToolDefs is false', () => {
    const prompt = buildIDESystemPrompt({ ...baseOpts, mode: 'agent', includeToolDefs: false });
    expect(prompt).not.toContain('read_file');
  });

  // ── Environment description ───────────────────────────────────────────

  it('includes environment description', () => {
    const prompt = buildIDESystemPrompt(baseOpts);
    expect(prompt).toContain('browser');
  });

  // ── Tier-based context ────────────────────────────────────────────────

  it('free tier includes full file tree', () => {
    const manyFiles = Array.from({ length: 60 }, (_, i) => `file${i}.ts`);
    const prompt = buildIDESystemPrompt({ ...baseOpts, fileTree: manyFiles, tier: 'free' });
    expect(prompt).toContain('file49.ts');
  });

  it('byok tier truncates file tree to 20 entries', () => {
    const manyFiles = Array.from({ length: 60 }, (_, i) => `file${i}.ts`);
    const prompt = buildIDESystemPrompt({ ...baseOpts, fileTree: manyFiles, tier: 'byok' });
    expect(prompt).toContain('file19.ts');
    expect(prompt).not.toContain('file20.ts');
    expect(prompt).toContain('40 more');
  });

  // ── Edge cases ────────────────────────────────────────────────────────

  it('handles empty project (no files)', () => {
    const prompt = buildIDESystemPrompt({ ...baseOpts, fileTree: [] });
    expect(prompt).toBeTruthy();
    expect(prompt.length).toBeGreaterThan(50);
  });

  it('handles missing optional fields', () => {
    const prompt = buildIDESystemPrompt({
      mode: 'agent',
      fileTree: [],
      language: 'javascript',
    });
    expect(prompt).toBeTruthy();
  });

  // ── Edit format rules ─────────────────────────────────────────────────

  it('includes edit format rules for agent mode', () => {
    const prompt = buildIDESystemPrompt({ ...baseOpts, mode: 'agent' });
    expect(prompt).toContain('SEARCH');
    expect(prompt).toContain('REPLACE');
  });

  it('includes edit format rules for debug mode', () => {
    const prompt = buildIDESystemPrompt({ ...baseOpts, mode: 'debug' });
    expect(prompt).toContain('SEARCH');
  });
});
