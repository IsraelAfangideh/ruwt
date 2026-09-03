import { describe, it, expect } from 'vitest';
import { serializeVersusMatch, versusTeaser } from './serialize';
import type { VersusMatch } from '../../../drizzle/schema.d1';

function row(overrides: Partial<VersusMatch> = {}): VersusMatch {
  return {
    id: 'm1',
    userId: 'u1',
    challengeId: 'c1',
    userAttemptId: 'a1',
    opponentModel: '@cf/meta/llama-3.1-8b-instruct',
    opponentStatus: 'thinking',
    opponentCode: 'function solve() {}',
    opponentThinking: 'I should parse the input first',
    opponentIteration: 1,
    opponentCost: 4,
    opponentInputTokens: 10,
    opponentOutputTokens: 8,
    userPassedAt: null,
    opponentPassedAt: null,
    winner: null,
    createdAt: '2026-08-29T00:00:00.000Z',
    finishedAt: null,
    ...overrides,
  };
}

describe('versusTeaser', () => {
  it('uses the last thinking line', () => {
    expect(versusTeaser('one\nfiguring out the parser', 'thinking')).toBe('figuring out the parser');
  });

  it('falls back to status copy when empty', () => {
    expect(versusTeaser('', 'testing')).toBe('running tests…');
    expect(versusTeaser('', 'queued')).toBe('waiting to start…');
  });
});

describe('serializeVersusMatch', () => {
  it('maps columns and teaser', () => {
    const pub = serializeVersusMatch(row());
    expect(pub.id).toBe('m1');
    expect(pub.teaser).toBe('I should parse the input first');
    expect(pub.winner).toBeNull();
  });
});
