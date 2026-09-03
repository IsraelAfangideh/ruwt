import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../ai/ai-stream', () => ({
  streamCloudflareAIWithFallback: vi.fn(),
}));
vi.mock('../ai/ai-pricing', () => ({
  calculateCost: () => 3,
}));
vi.mock('../scoring/judge', () => ({
  runTestCases: vi.fn(),
}));
vi.mock('../../../src/features/shared-ide/lib/code-apply', () => ({
  applyCodeFromResponse: () => ({ applied: true, newCode: 'function solve(){return 1}', method: 'code_block', failedCount: 0 }),
}));

import { streamCloudflareAIWithFallback } from '../ai/ai-stream';
import { runTestCases } from '../scoring/judge';
import { runOpponentTick } from './opponent-loop';

const MODEL = '@cf/meta/llama-3.1-8b-instruct';

function match(overrides: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    userId: 'u1',
    challengeId: 'c1',
    userAttemptId: 'a1',
    opponentModel: MODEL,
    opponentStatus: 'queued',
    opponentCode: 'function solve() {}',
    opponentThinking: '',
    opponentIteration: 0,
    opponentCost: 0,
    opponentInputTokens: 0,
    opponentOutputTokens: 0,
    userPassedAt: null,
    opponentPassedAt: null,
    winner: null,
    createdAt: '2026-08-29T00:00:00.000Z',
    finishedAt: null,
    ...overrides,
  };
}

function challenge() {
  return {
    id: 'c1',
    title: 'One',
    description: 'return 1',
    difficulty: 'easy',
    starterCode: 'function solve() {}',
    testCases: JSON.stringify([{ input: '1', expectedOutput: '1' }]),
    hiddenTestCases: JSON.stringify([{ input: '2', expectedOutput: '2' }]),
    testHarness: null,
    useStdin: 0,
    language: 'javascript',
    execTimeLimit: 5000,
    execMemoryLimit: 256,
  };
}

function makeDb(current: ReturnType<typeof match>) {
  const store = { row: { ...current } };
  return {
    store,
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([store.row]),
          }),
        }),
      }),
      update: () => ({
        set: (patch: Record<string, unknown>) => ({
          where: () => {
            store.row = { ...store.row, ...patch };
            return Promise.resolve();
          },
        }),
      }),
    },
  };
}

async function* stream() {
  yield { text: 'planning', phase: 'thinking' as const };
  yield { text: '```js\nfunction solve(){return 1}\n```', phase: 'content' as const };
  return { inputTokens: 20, outputTokens: 10, model: MODEL };
}

describe('runOpponentTick', () => {
  beforeEach(() => {
    vi.mocked(streamCloudflareAIWithFallback).mockReset();
    vi.mocked(runTestCases).mockReset();
  });

  it('aborts without calling the model when the user already won', async () => {
    const row = match({ winner: 'user', opponentStatus: 'thinking' });
    const { db } = makeDb(row);
    const emit = vi.fn();
    const result = await runOpponentTick({
      env: {} as Env,
      db,
      match: row as any,
      challenge: challenge() as any,
      emit,
    });
    expect(streamCloudflareAIWithFallback).not.toHaveBeenCalled();
    expect(result.continue).toBe(false);
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'done' }));
  });

  it('marks opponent winner when public and hidden tests pass', async () => {
    vi.mocked(streamCloudflareAIWithFallback).mockReturnValue(stream() as any);
    vi.mocked(runTestCases).mockResolvedValue({
      passed: true,
      passedTests: 1,
      totalTests: 1,
      failedTests: 0,
      results: [{ passed: true, input: '1', expectedOutput: '1', actualOutput: '1' }],
    } as any);
    const row = match();
    const { db, store } = makeDb(row);
    const emit = vi.fn();
    const result = await runOpponentTick({
      env: {} as Env,
      db,
      match: row as any,
      challenge: challenge() as any,
      emit,
    });
    expect(result.continue).toBe(false);
    expect(store.row.winner).toBe('opponent');
    expect(store.row.opponentStatus).toBe('passed');
  });
});
