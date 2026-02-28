import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDb } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
}));

vi.mock('../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../drizzle/schema.d1', () => ({
  certificates: { id: 'id', userId: 'user_id', type: 'type', title: 'title', metadata: 'metadata', shareToken: 'share_token', earnedAt: 'earned_at' },
  profiles: { id: 'id', name: 'name', username: 'username', avatarUrl: 'avatar_url' },
}));

import { onRequestGet } from './[shareToken]';

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeCtx(shareToken?: string) {
  return {
    request: new Request(`https://ruwt.dev/api/cert/${shareToken || ''}`),
    env: makeEnv(),
    params: Promise.resolve({ shareToken }),
  };
}

describe('GET /api/cert/:shareToken (public)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 400 when shareToken is missing', async () => {
    const res = await onRequestGet(makeCtx(undefined));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Missing token');
  });

  it('returns 404 when certificate not found', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });

    const res = await onRequestGet(makeCtx('bad-token'));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Certificate not found');
  });

  it('returns certificate data with parsed metadata and holder on happy path', async () => {
    const cert = {
      id: 'c-1', userId: 'u-1', type: 'track_completion', title: 'QA Master',
      metadata: '{"track":"qa_master","challengesSolved":5}',
      shareToken: 'tok-1', earnedAt: '2024-01-01',
    };
    const holder = { name: 'Alice', username: 'alice', avatarUrl: 'https://img.com/a.png' };

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([cert]) };
        }
        return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([holder]) };
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx('tok-1'));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.id).toBe('c-1');
    expect(json.title).toBe('QA Master');
    expect(json.metadata).toEqual({ track: 'qa_master', challengesSolved: 5 });
    expect(json.holder.name).toBe('Alice');
    expect(json.holder.username).toBe('alice');
  });

  it('handles null metadata', async () => {
    const cert = { id: 'c-1', userId: 'u-1', type: 'x', title: 'T', metadata: null, shareToken: 't', earnedAt: '2024-01-01' };

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([cert]) };
        }
        return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx('t'));
    const json = await res.json();
    expect(json.metadata).toBeNull();
    expect(json.holder).toBeNull();
  });

  it('handles invalid JSON in metadata', async () => {
    const cert = { id: 'c-1', userId: 'u-1', type: 'x', title: 'T', metadata: 'bad{', shareToken: 't', earnedAt: '2024-01-01' };

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([cert]) };
        }
        return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx('t'));
    const json = await res.json();
    expect(json.metadata).toBeNull();
  });

  it('returns 500 on unexpected error', async () => {
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestGet(makeCtx('tok'));
    expect(res.status).toBe(500);
  });
});
