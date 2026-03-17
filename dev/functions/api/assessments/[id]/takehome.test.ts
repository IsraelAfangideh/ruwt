import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockGetDb, mockCanViewResults } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockCanViewResults: vi.fn(),
}));

vi.mock('../../../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../_shared/org', () => ({ canViewResults: mockCanViewResults }));

import { onRequestGet } from './takehome';

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  } as Env;
}

function makeContext(assessmentId: string) {
  return {
    request: new Request(`https://ruwt.dev/api/assessments/${assessmentId}/takehome`),
    env: makeEnv(),
    params: { id: assessmentId },
  };
}

describe('GET /api/assessments/:id/takehome', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
    mockCanViewResults.mockReset();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await onRequestGet(makeContext('assess-1'));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Unauthorized');
  });

  it('returns 404 when user has no access', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    mockCanViewResults.mockResolvedValue(false);
    const db: Record<string, any> = {};
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('assess-1'));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Assessment not found');
  });

  it('returns empty array when no sessions exist', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    mockCanViewResults.mockResolvedValue(true);

    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockResolvedValue([]);
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('assess-1'));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual([]);
  });

  it('returns sessions with telemetry summary', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    mockCanViewResults.mockResolvedValue(true);

    const sessions = [
      {
        session: {
          id: 'sess-1',
          assessmentId: 'assess-1',
          status: 'completed',
          startedAt: '2026-03-01T10:00:00Z',
          completedAt: '2026-03-01T11:30:00Z',
          shareToken: 'abc123',
          totalCost: 100,
          totalTokens: 1000,
        },
        user: { id: 'cand-1', name: 'Alice', email: 'alice@test.com', avatarUrl: null },
      },
    ];

    const telemetryEvents = [
      { id: 't1', sessionId: 'sess-1', eventType: 'ai_call', data: JSON.stringify({ model: 'gpt-4', cost: 60 }) },
      { id: 't2', sessionId: 'sess-1', eventType: 'ai_call', data: JSON.stringify({ model: 'claude-3', cost: 40 }) },
      { id: 't3', sessionId: 'sess-1', eventType: 'file_change', data: '{}' },
      { id: 't4', sessionId: 'sess-1', eventType: 'file_change', data: '{}' },
    ];

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const currentCall = selectCallCount;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (currentCall === 1) return Promise.resolve(sessions);
        if (currentCall === 2) return Promise.resolve(telemetryEvents);
        return Promise.resolve([]);
      });
      return chain;
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeContext('assess-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0].candidate.name).toBe('Alice');
    expect(json[0].telemetrySummary.totalCost).toBe(100);
    expect(json[0].telemetrySummary.aiCallCount).toBe(2);
    expect(json[0].telemetrySummary.modelsUsed).toEqual(expect.arrayContaining(['gpt-4', 'claude-3']));
    expect(json[0].telemetrySummary.fileChangesCount).toBe(2);
    expect(json[0].telemetrySummary.timeSpentSeconds).toBe(5400); // 1.5 hours
    expect(json[0].telemetrySummary.totalEvents).toBe(4);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1' });
    mockCanViewResults.mockImplementation(() => { throw new Error('fail'); });
    mockGetDb.mockReturnValue({});

    const res = await onRequestGet(makeContext('assess-1'));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Internal server error');
  });
});
