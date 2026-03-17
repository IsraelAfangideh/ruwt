import { describe, it, expect } from 'vitest';
import { parseRuwtConfig } from './ruwt-config';
import type { RuwtConfig } from './ruwt-config';

describe('parseRuwtConfig', () => {
  it('parses a minimal config with only name', () => {
    const result = parseRuwtConfig('name: my-project');
    expect(result).toEqual({ name: 'my-project' });
  });

  it('parses a full config with all fields', () => {
    const yaml = `
name: ruwt
mode: cloud
machine:
  spec: medium
  region: iad
setup:
  - cd dev && npm install
  - cd social/code/api && bun install
tasks:
  test:
    command: cd dev && npx vitest run
    label: Run all tests
  typecheck:
    command: cd dev && npx tsc --noEmit
    label: TypeScript check
env:
  - CLOUDFLARE_API_TOKEN
  - FLY_API_TOKEN
`;
    const result = parseRuwtConfig(yaml);
    expect(result.name).toBe('ruwt');
    expect(result.mode).toBe('cloud');
    expect(result.machine).toEqual({ spec: 'medium', region: 'iad' });
    expect(result.setup).toEqual([
      'cd dev && npm install',
      'cd social/code/api && bun install',
    ]);
    expect(result.tasks).toBeDefined();
    expect(result.tasks!.test).toEqual({
      command: 'cd dev && npx vitest run',
      label: 'Run all tests',
    });
    expect(result.tasks!.typecheck).toEqual({
      command: 'cd dev && npx tsc --noEmit',
      label: 'TypeScript check',
    });
    expect(result.env).toEqual(['CLOUDFLARE_API_TOKEN', 'FLY_API_TOKEN']);
  });

  it('parses mode: browser', () => {
    const result = parseRuwtConfig('name: test\nmode: browser');
    expect(result.mode).toBe('browser');
  });

  it('trims the name field', () => {
    const result = parseRuwtConfig('name: "  my-app  "');
    expect(result.name).toBe('my-app');
  });

  it('handles machine with only spec', () => {
    const result = parseRuwtConfig('name: test\nmachine:\n  spec: large');
    expect(result.machine).toEqual({ spec: 'large' });
  });

  it('handles machine with only region', () => {
    const result = parseRuwtConfig('name: test\nmachine:\n  region: ewr');
    expect(result.machine).toEqual({ region: 'ewr' });
  });

  it('handles empty tasks object', () => {
    const result = parseRuwtConfig('name: test\ntasks: {}');
    expect(result.tasks).toEqual({});
  });

  it('handles empty setup array', () => {
    const result = parseRuwtConfig('name: test\nsetup: []');
    expect(result.setup).toEqual([]);
  });

  it('handles empty env array', () => {
    const result = parseRuwtConfig('name: test\nenv: []');
    expect(result.env).toEqual([]);
  });

  it('converts non-string setup items to string', () => {
    const result = parseRuwtConfig('name: test\nsetup:\n  - 42\n  - true');
    expect(result.setup).toEqual(['42', 'true']);
  });

  it('converts non-string env items to string', () => {
    const result = parseRuwtConfig('name: test\nenv:\n  - 123');
    expect(result.env).toEqual(['123']);
  });

  it('converts non-string machine.spec to string', () => {
    const result = parseRuwtConfig('name: test\nmachine:\n  spec: 4');
    expect(result.machine!.spec).toBe('4');
  });

  // Error cases

  it('throws on empty string', () => {
    expect(() => parseRuwtConfig('')).toThrow('expected a YAML mapping');
  });

  it('throws on scalar YAML', () => {
    expect(() => parseRuwtConfig('just a string')).toThrow('expected a YAML mapping');
  });

  it('throws on null YAML', () => {
    expect(() => parseRuwtConfig('null')).toThrow('expected a YAML mapping');
  });

  it('throws when name is missing', () => {
    expect(() => parseRuwtConfig('mode: cloud')).toThrow('"name" is required');
  });

  it('throws when name is empty string', () => {
    expect(() => parseRuwtConfig('name: ""')).toThrow('"name" is required');
  });

  it('throws when name is not a string', () => {
    expect(() => parseRuwtConfig('name: 42')).toThrow('"name" is required');
  });

  it('throws on invalid mode value', () => {
    expect(() => parseRuwtConfig('name: test\nmode: hybrid')).toThrow('"mode" must be "browser" or "cloud"');
  });

  it('throws when machine is not an object', () => {
    expect(() => parseRuwtConfig('name: test\nmachine: fast')).toThrow('"machine" must be a mapping');
  });

  it('throws when setup is not an array', () => {
    expect(() => parseRuwtConfig('name: test\nsetup: run-all')).toThrow('"setup" must be an array');
  });

  it('throws when tasks is not an object', () => {
    expect(() => parseRuwtConfig('name: test\ntasks: run')).toThrow('"tasks" must be a mapping');
  });

  it('throws when tasks is an array', () => {
    expect(() => parseRuwtConfig('name: test\ntasks:\n  - run')).toThrow('"tasks" must be a mapping');
  });

  it('throws when a task is not an object', () => {
    expect(() => parseRuwtConfig('name: test\ntasks:\n  run: fast')).toThrow('task "run" must be a mapping');
  });

  it('throws when a task is missing command', () => {
    expect(() => parseRuwtConfig('name: test\ntasks:\n  run:\n    label: Run')).toThrow('task "run" is missing "command"');
  });

  it('throws when a task is missing label', () => {
    expect(() => parseRuwtConfig('name: test\ntasks:\n  run:\n    command: npm run')).toThrow('task "run" is missing "label"');
  });

  it('throws when env is not an array', () => {
    expect(() => parseRuwtConfig('name: test\nenv: TOKEN')).toThrow('"env" must be an array');
  });

  // Type checks
  it('returns correct TypeScript type shape', () => {
    const config: RuwtConfig = parseRuwtConfig('name: typed\nmode: browser');
    expect(config.name).toBe('typed');
    expect(config.mode).toBe('browser');
    expect(config.machine).toBeUndefined();
    expect(config.setup).toBeUndefined();
    expect(config.tasks).toBeUndefined();
    expect(config.env).toBeUndefined();
  });
});
