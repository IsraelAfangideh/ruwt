import { describe, it, expect } from 'vitest';
import { buildFIMPrompt } from './fim-prompt';

describe('buildFIMPrompt', () => {
  it('builds prompt with prefix and suffix', () => {
    const result = buildFIMPrompt({ prefix: 'function add(', suffix: ') {}', language: 'javascript' });
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages.some((m) => m.content.includes('function add('))).toBe(true);
    expect(result.messages.some((m) => m.content.includes(') {}'))).toBe(true);
  });

  it('includes language in system context', () => {
    const result = buildFIMPrompt({ prefix: 'x', suffix: 'y', language: 'typescript' });
    const systemMsg = result.messages.find((m) => m.role === 'system');
    expect(systemMsg?.content).toContain('typescript');
  });

  it('includes filePath when provided', () => {
    const result = buildFIMPrompt({ prefix: 'x', suffix: 'y', language: 'js', filePath: 'src/utils.ts' });
    const systemMsg = result.messages.find((m) => m.role === 'system');
    expect(systemMsg?.content).toContain('src/utils.ts');
  });

  it('handles empty suffix', () => {
    const result = buildFIMPrompt({ prefix: 'const x = ', suffix: '', language: 'javascript' });
    expect(result.messages.length).toBeGreaterThan(0);
  });

  it('handles empty prefix', () => {
    const result = buildFIMPrompt({ prefix: '', suffix: 'return x;', language: 'javascript' });
    expect(result.messages.length).toBeGreaterThan(0);
  });

  it('truncates prefix to token budget', () => {
    const longPrefix = 'a'.repeat(5000);
    const result = buildFIMPrompt({ prefix: longPrefix, suffix: 'y', language: 'js' });
    const userMsg = result.messages.find((m) => m.role === 'user');
    expect(userMsg!.content.length).toBeLessThan(5000);
  });

  it('truncates suffix to token budget', () => {
    const longSuffix = 'b'.repeat(3000);
    const result = buildFIMPrompt({ prefix: 'x', suffix: longSuffix, language: 'js' });
    const userMsg = result.messages.find((m) => m.role === 'user');
    expect(userMsg!.content.length).toBeLessThan(3000);
  });

  it('returns stop sequences', () => {
    const result = buildFIMPrompt({ prefix: 'x', suffix: 'y', language: 'js' });
    expect(result.stopSequences).toBeDefined();
    expect(result.stopSequences!.length).toBeGreaterThan(0);
  });
});
