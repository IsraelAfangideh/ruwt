/**
 * Tests for GET /api/models/:id — Single model detail with usage stats.
 *
 * Verifies model lookup, stats aggregation, win rate calculation,
 * 404 for unknown models, and Cache-Control header.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDb, mockGetModelPricing } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockGetModelPricing: vi.fn(),
}));

vi.mock('../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../_shared/ai-pricing', () => ({ getModelPricing: mockGetModelPricing }));

import { onRequestGet } from './[id]';

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeCtx(modelId: string) {
  return {
    request: new Request(`https://ruwt.dev/api/models/${encodeURIComponent(modelId)}`),
    env: makeEnv(),
    params: { id: encodeURIComponent(modelId) },
  };
}

const FAKE_PRICING = {
  displayName: 'Llama 3.3 70B',
  tier: 'premium',
  description: 'Meta 70B',
  input: 0.50,
  output: 0.60,
  provider: 'cloudflare',
};

describe('GET /api/models/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns model detail with stats', async () => {
    mockGetModelPricing.mockReturnValue(FAKE_PRICING);

    let allCall = 0;
    const db = {
      all: vi.fn().mockImplementation(() => {
        allCall++;
        if (allCall === 1) {
          // usage stats
          return Promise.resolve([{ times_used: 50, total_messages: 300, avg_cost: 12.0 }]);
        }
        // win stats
        return Promise.resolve([{ total: 40, wins: 30 }]);
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx('@cf/meta/llama-3.3-70b-instruct-fp8-fast'));
    expect(res.status).toBe(200);

    const json = await res.json() as any;
    expect(json.model.id).toBe('@cf/meta/llama-3.3-70b-instruct-fp8-fast');
    expect(json.model.displayName).toBe('Llama 3.3 70B');
    expect(json.model.tier).toBe('premium');
    expect(json.stats.timesUsed).toBe(50);
    expect(json.stats.totalMessages).toBe(300);
    expect(json.stats.avgCostPerMessage).toBe(12.0);
  });

  it('returns 404 for unknown model', async () => {
    mockGetModelPricing.mockReturnValue(undefined);

    const res = await onRequestGet(makeCtx('unknown-model'));
    expect(res.status).toBe(404);
    expect((await res.json() as any).error).toBe('Model not found');
  });

  it('computes win rate correctly', async () => {
    mockGetModelPricing.mockReturnValue(FAKE_PRICING);

    let allCall = 0;
    const db = {
      all: vi.fn().mockImplementation(() => {
        allCall++;
        if (allCall === 1) {
          return Promise.resolve([{ times_used: 10, total_messages: 50, avg_cost: 5.0 }]);
        }
        // 7 wins out of 10 total = 70%
        return Promise.resolve([{ total: 10, wins: 7 }]);
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx('@cf/meta/llama-3.3-70b-instruct-fp8-fast'));
    const json = await res.json() as any;
    expect(json.stats.winRate).toBe(70);
  });

  it('returns 0 win rate when no attempts', async () => {
    mockGetModelPricing.mockReturnValue(FAKE_PRICING);

    let allCall = 0;
    const db = {
      all: vi.fn().mockImplementation(() => {
        allCall++;
        if (allCall === 1) {
          return Promise.resolve([{ times_used: 0, total_messages: 0, avg_cost: 0 }]);
        }
        return Promise.resolve([{ total: 0, wins: 0 }]);
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx('@cf/meta/llama-3.3-70b-instruct-fp8-fast'));
    const json = await res.json() as any;
    expect(json.stats.winRate).toBe(0);
  });

  it('response has Cache-Control header', async () => {
    mockGetModelPricing.mockReturnValue(FAKE_PRICING);

    let allCall = 0;
    const db = {
      all: vi.fn().mockImplementation(() => {
        allCall++;
        if (allCall === 1) return Promise.resolve([{ times_used: 0, total_messages: 0, avg_cost: 0 }]);
        return Promise.resolve([{ total: 0, wins: 0 }]);
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx('@cf/meta/llama-3.3-70b-instruct-fp8-fast'));
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300');
  });

  it('returns 500 on unexpected error', async () => {
    mockGetModelPricing.mockReturnValue(FAKE_PRICING);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });

    const res = await onRequestGet(makeCtx('@cf/meta/llama-3.3-70b-instruct-fp8-fast'));
    expect(res.status).toBe(500);
  });
});
