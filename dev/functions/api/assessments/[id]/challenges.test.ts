import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────
const { mockGetUser, mockGetDb, mockCanManageAssessment } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockCanManageAssessment: vi.fn(),
}));

vi.mock('../../../_shared/infra/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../../_shared/infra/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../_shared/org', () => ({ canManageAssessment: mockCanManageAssessment }));

import { onRequestPut } from './challenges';

// ── Helpers ──────────────────────────────────────────────────────────

const FAKE_USER = { id: 'user-123', email: 'admin@test.com' };

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  } as Env;
}

function makeContext(id: string, body: unknown) {
  return {
    request: new Request(`https://ruwt.dev/api/assessments/${id}/challenges`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
    params: { id },
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('PUT /api/assessments/:id/challenges', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
    mockCanManageAssessment.mockReset();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestPut(makeContext('a-1', { challengeIds: ['ch-1'] }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 400 when no challenges are provided', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});

    const res = await onRequestPut(makeContext('a-1', { challengeIds: [], customChallengeIds: [] }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
  });

  it('returns 400 when more than 20 challenges are provided', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockGetDb.mockReturnValue({});

    const ids = Array.from({ length: 21 }, (_, i) => `ch-${i}`);
    const res = await onRequestPut(makeContext('a-1', { challengeIds: ids }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid request');
  });

  it('returns 404 when user cannot manage assessment', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(false);
    mockGetDb.mockReturnValue({});

    const res = await onRequestPut(makeContext('a-1', { challengeIds: ['ch-1'] }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Assessment not found');
  });

  it('returns 400 when standard challenge IDs are invalid', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);

    const existingChallenges = [{ id: 'ch-1' }, { id: 'ch-2' }];

    const db: Record<string, any> = {};
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockResolvedValue(existingChallenges),
    });
    db.delete = vi.fn();
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPut(makeContext('a-1', {
      challengeIds: ['ch-1', 'ch-nonexistent'],
    }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid challenge IDs');
    expect(json.invalidIds).toEqual(['ch-nonexistent']);
  });

  it('replaces all challenges and returns success with count', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);

    const existingChallenges = [{ id: 'ch-1' }, { id: 'ch-2' }, { id: 'ch-3' }];

    let insertCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockResolvedValue(existingChallenges),
    });
    db.delete = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation(() => {
        insertCount++;
        return Promise.resolve(undefined);
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPut(makeContext('a-1', {
      challengeIds: ['ch-1', 'ch-3'],
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.count).toBe(2);
    // Should have deleted old and inserted 2 new
    expect(db.delete).toHaveBeenCalled();
    expect(insertCount).toBe(2);
  });

  it('handles mixed standard and custom challenge IDs', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);

    const existingChallenges = [{ id: 'ch-1' }];

    let insertedValues: any[] = [];
    const db: Record<string, any> = {};
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockResolvedValue(existingChallenges),
    });
    db.delete = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((val: any) => {
        insertedValues.push(val);
        return Promise.resolve(undefined);
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPut(makeContext('a-1', {
      challengeIds: ['ch-1'],
      customChallengeIds: ['custom-1', 'custom-2'],
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.count).toBe(3); // 1 standard + 2 custom

    // Verify sort orders are sequential
    expect(insertedValues[0].sortOrder).toBe(0);
    expect(insertedValues[1].sortOrder).toBe(1);
    expect(insertedValues[2].sortOrder).toBe(2);

    // Custom challenges should have customChallengeId set
    expect(insertedValues[1].customChallengeId).toBe('custom-1');
    expect(insertedValues[2].customChallengeId).toBe('custom-2');
  });

  it('uses defaults when only customChallengeIds are provided', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);

    const db: Record<string, any> = {};
    // No standard challenge validation needed when challengeIds is empty
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockResolvedValue([]),
    });
    db.delete = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPut(makeContext('a-1', {
      customChallengeIds: ['custom-1'],
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.count).toBe(1);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockCanManageAssessment.mockResolvedValue(true);
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestPut(makeContext('a-1', { challengeIds: ['ch-1'] }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Internal server error');
  });
});
