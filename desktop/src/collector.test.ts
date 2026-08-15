import { describe, expect, it } from 'vitest';
import { collectEvents } from './collector.js';
import { MemoryFs } from './fs-memory.js';
import { generateInsights } from './insights.js';
import { Engine } from './engine.js';
import { joinPath } from './fs.js';

const prompt = 'SECRET_PROMPT_PLEASE_DO_NOT_STORE';
const diff = 'UNIQUE_DIFF_FRAGMENT_XYZ';
const command = 'npm test --unique-flag-abc';

function claudeTranscript() {
  return [
    JSON.stringify({ type: 'user', timestamp: '2026-08-14T10:00:00.000Z', message: { role: 'user', content: prompt } }),
    JSON.stringify({
      type: 'assistant', timestamp: '2026-08-14T10:00:05.000Z',
      message: { role: 'assistant', model: 'claude-opus-4-6', content: [{ type: 'tool_use', id: '1', name: 'Edit', input: { file_path: '/Users/me/ruwt/desktop/src/cli.ts', old_string: diff, new_string: diff } }] },
    }),
    JSON.stringify({
      type: 'assistant', timestamp: '2026-08-14T10:01:00.000Z',
      message: { role: 'assistant', content: [{ type: 'tool_use', id: '2', name: 'Bash', input: { command } }] },
    }),
    JSON.stringify({
      type: 'assistant', timestamp: '2026-08-14T10:02:00.000Z',
      message: { role: 'assistant', content: [{ type: 'tool_use', id: '3', name: 'Read', input: { file_path: '/Users/me/ruwt/.env' } }] },
    }),
  ].join('\n');
}

function seedFs() {
  const fs = new MemoryFs('/home/me');
  const file = joinPath('/home/me', '.claude', 'projects', '-Users-me-ruwt', '11111111-1111-4111-8111-111111111111.jsonl');
  fs.files.set(file, claudeTranscript());
  return fs;
}

describe('local collector', () => {
  it('turns Claude Code transcripts into redacted events and insights', async () => {
    const fs = seedFs();
    const identity = { orgId: '5d1ac29a-7d23-42d5-b890-586ee309a4a9', actorId: 'local:test', desktopInstallationId: 'install-1' };
    const result = await collectEvents(fs, identity);
    expect(result.scanned).toBe(1);
    expect(result.events.length).toBeGreaterThan(4);
    const serialized = JSON.stringify(result.events);
    expect(serialized).not.toContain(prompt);
    expect(serialized).not.toContain(diff);
    expect(serialized).not.toContain(command);
    expect(result.events.some((event) => event.type === 'file.modified')).toBe(true);
    expect(result.events.some((event) => event.fileClassification === 'credential')).toBe(true);
    expect(result.events.some((event) => event.type === 'test.completed')).toBe(true);
    const insights = generateInsights(result.events);
    expect(insights.map((insight) => insight.ruleId)).toEqual(expect.arrayContaining(['activity_summary', 'sensitive_file_access']));
  });

  it('collects on startup through the engine and is idempotent', async () => {
    const fs = seedFs();
    const engine = new Engine(fs, joinPath('/home/me', '.ruwt', 'queue.json'), 'tauri');
    const first = await engine.collect();
    const second = await engine.collect();
    expect(first.snapshot.insights.length).toBeGreaterThan(0);
    expect(first.snapshot.overview.events).toBeGreaterThan(0);
    expect(first.snapshot.lastRunAt).toBeTruthy();
    expect(second.result.accepted).toBe(0);
    expect(second.result.duplicates).toBeGreaterThan(0);
    expect(second.snapshot.overview.events).toBe(first.snapshot.overview.events);
  });

  it('ignores editor config json that is not a session transcript', async () => {
    const fs = seedFs();
    fs.files.set(joinPath('/home/me', '.cursor', 'projects', 'workspace', 'canvases', 'tsconfig.json'), '{"compilerOptions":{}}');
    const result = await collectEvents(fs, { orgId: '5d1ac29a-7d23-42d5-b890-586ee309a4a9', actorId: 'local:test', desktopInstallationId: 'install-1' });
    expect(result.sources.find((source) => source.id === 'cursor')?.files).toBe(0);
  });
});
