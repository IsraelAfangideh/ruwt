/**
 * Tests for GET /api/models — List all AI models with usage stats.
 *
 * Verifies model listing, stats aggregation, zero-stat defaults,
 * and Cache-Control header.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDb, mockGetCloudflareModels } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockGetCloudflareModels: vi.fn(),
}));

vi.mock('../_shared/infra/db', () => ({ getDb: mockGetDb }));
vi.mock('../_shared/ai/ai-pricing', () => ({ getCloudflareModels: mockGetCloudflareModels }));

import { onRequestGet } from './models';

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeCtx() {
  return {
    request: new Request('https://ruwt.dev/api/models'),
    env: makeEnv(),
  };
}

const FAKE_MODELS = [
  {
    id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    displayName: 'Llama 3.3 70B',
    tier: 'premium' as const,
    description: 'Meta 70B',
    input: 0.50,
    output: 0.60,
    provider: 'cloudflare',
  },
  {
    id: '@cf/meta/llama-3.1-8b-instruct',
    displayName: 'Llama 3.1 8B',
    tier: 'budget' as const,
    description: 'Cheap 8B',
    input: 0.01,
    output: 0.01,
    provider: 'cloudflare',
  },
];

describe('GET /api/models', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns all models with stats', async () => {
    mockGetCloudflareModels.mockReturnValue(FAKE_MODELS);

    const stats = [
      { model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', times_used: 42, total_messages: 200, avg_cost: 15.5 },
    ];
    const db = { all: vi.fn().mockResolvedValue(stats) };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx());
    expect(res.status).toBe(200);

    const json = await res.json() as any;
    expect(json).toHaveLength(2);

    const llama70 = json.find((m: any) => m.id === '@cf/meta/llama-3.3-70b-instruct-fp8-fast');
    expect(llama70.displayName).toBe('Llama 3.3 70B');
    expect(llama70.tier).toBe('premium');
    expect(llama70.costIndicator).toBe('$$$');
    expect(llama70.stats.timesUsed).toBe(42);
    expect(llama70.stats.totalMessages).toBe(200);
    expect(llama70.stats.avgCost).toBe(15.5);
  });

  it('returns models with zero stats when no usage data', async () => {
    mockGetCloudflareModels.mockReturnValue(FAKE_MODELS);

    const db = { all: vi.fn().mockResolvedValue([]) };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx());
    expect(res.status).toBe(200);

    const json = await res.json() as any;
    expect(json).toHaveLength(2);

    for (const model of json) {
      expect(model.stats).toEqual({ timesUsed: 0, totalMessages: 0, avgCost: 0 });
    }
  });

  it('response has Cache-Control header', async () => {
    mockGetCloudflareModels.mockReturnValue([]);
    const db = { all: vi.fn().mockResolvedValue([]) };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx());
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=600');
  });

  it('returns 500 on unexpected error', async () => {
    mockGetCloudflareModels.mockReturnValue(FAKE_MODELS);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });

    const res = await onRequestGet(makeCtx());
    expect(res.status).toBe(500);
  });

  it('maps all tier levels to correct costIndicator', async () => {
    const allTierModels = [
      { id: 'r1', displayName: 'Reasoning', tier: 'reasoning', description: '', input: 1, output: 1, provider: 'cf' },
      { id: 'p1', displayName: 'Premium', tier: 'premium', description: '', input: 1, output: 1, provider: 'cf' },
      { id: 'm1', displayName: 'Mid', tier: 'mid', description: '', input: 1, output: 1, provider: 'cf' },
      { id: 'b1', displayName: 'Budget', tier: 'budget', description: '', input: 1, output: 1, provider: 'cf' },
      { id: 'u1', displayName: 'Unknown', tier: 'free', description: '', input: 1, output: 1, provider: 'cf' },
    ];
    mockGetCloudflareModels.mockReturnValue(allTierModels);
    const db = { all: vi.fn().mockResolvedValue([]) };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx());
    const json = await res.json() as any;

    expect(json.find((m: any) => m.id === 'r1').costIndicator).toBe('$$$$$');
    expect(json.find((m: any) => m.id === 'p1').costIndicator).toBe('$$$');
    expect(json.find((m: any) => m.id === 'm1').costIndicator).toBe('$$');
    expect(json.find((m: any) => m.id === 'b1').costIndicator).toBe('$');
    expect(json.find((m: any) => m.id === 'u1').costIndicator).toBe('$');
  });
});
