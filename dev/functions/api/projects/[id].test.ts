import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { onRequestGet, onRequestPut, onRequestDelete } from './[id]';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../_shared/infra/auth', () => ({ getUser: vi.fn() }));
vi.mock('../../_shared/infra/db', () => ({ getDb: vi.fn() }));
vi.mock('../../_shared/ensure-profile', () => ({ ensureProfile: vi.fn() }));
vi.mock('../../../drizzle/schema.d1', () => ({
  projects: {
    id: 'id',
    userId: 'user_id',
    name: 'name',
    description: 'description',
    r2Key: 'r2_key',
    language: 'language',
    fileCount: 'file_count',
    sizeBytes: 'size_bytes',
    lastOpenedAt: 'last_opened_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}));

import { getUser } from '../../_shared/infra/auth';
import { getDb } from '../../_shared/infra/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER = { id: 'user-1', email: 'test@ruwt.dev' };
const TEST_PROJECT = {
  id: 'proj-1',
  userId: 'user-1',
  name: 'My Project',
  r2Key: 'user-1/proj-1.json',
  fileCount: 2,
  sizeBytes: 100,
};

function makeEnv(withBucket = true): Env {
  const env: any = { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' };
  if (withBucket) {
    env.PROJECTS_BUCKET = {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
    };
  }
  return env as Env;
}

function makeGetCtx(id = 'proj-1', withBucket = true) {
  return {
    request: new Request(`https://ruwt.dev/api/projects/${id}`),
    env: makeEnv(withBucket),
    params: { id },
  };
}

function makePutCtx(id: string, body: unknown, withBucket = true) {
  return {
    request: new Request(`https://ruwt.dev/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(withBucket),
    params: { id },
  };
}

function makeDeleteCtx(id = 'proj-1', withBucket = true) {
  return {
    request: new Request(`https://ruwt.dev/api/projects/${id}`, { method: 'DELETE' }),
    env: makeEnv(withBucket),
    params: { id },
  };
}

function createMockDb(opts: {
  projectRow?: any;
} = {}) {
  const updatedSets: any[] = [];
  const deletedConditions: any[] = [];

  const db = {
    updatedSets,
    deletedConditions,
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(
            opts.projectRow ? [opts.projectRow] : []
          ),
        }),
      }),
    })),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockImplementation((s: any) => {
        updatedSets.push(s);
        return {
          where: vi.fn().mockResolvedValue(undefined),
        };
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockImplementation((cond: any) => {
        deletedConditions.push(cond);
        return Promise.resolve(undefined);
      }),
    }),
  };

  return db;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mockDb: ReturnType<typeof createMockDb>;

beforeEach(() => {
  vi.clearAllMocks();
  mockDb = createMockDb({ projectRow: TEST_PROJECT });
  (getDb as Mock).mockReturnValue(mockDb);
});

// ---------------------------------------------------------------------------
// GET /api/projects/:id
// ---------------------------------------------------------------------------

describe('GET /api/projects/:id', () => {
  it('returns 401 when not authenticated', async () => {
    (getUser as Mock).mockResolvedValue(null);
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(401);
  });

  it('returns project on happy path', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.project).toBeDefined();
    expect(json.project.name).toBe('My Project');
  });

  it('updates last_opened_at on fetch', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    await onRequestGet(makeGetCtx());
    expect(mockDb.updatedSets).toHaveLength(1);
    expect(mockDb.updatedSets[0]).toHaveProperty('lastOpenedAt');
  });

  it('returns 404 when project not found', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({ projectRow: null });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestGet(makeGetCtx('nonexistent'));
    expect(res.status).toBe(404);
    const json = await res.json() as any;
    expect(json.error).toBe('Project not found');
  });

  it('returns 404 when project belongs to another user', async () => {
    (getUser as Mock).mockResolvedValue({ id: 'user-other', email: 'other@ruwt.dev' });
    // The select with AND(id=X, userId=Y) returns empty since user doesn't match
    mockDb = createMockDb({ projectRow: null });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(404);
  });

  it('returns 500 on unexpected error', async () => {
    (getUser as Mock).mockRejectedValue(new Error('DB error'));
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/projects/:id
// ---------------------------------------------------------------------------

describe('PUT /api/projects/:id', () => {
  it('returns 401 when not authenticated', async () => {
    (getUser as Mock).mockResolvedValue(null);
    const res = await onRequestPut(makePutCtx('proj-1', { files: {} }));
    expect(res.status).toBe(401);
  });

  it('saves files on happy path', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const files = { 'index.js': 'console.log("hi")', 'util.js': 'export {}' };
    const ctx = makePutCtx('proj-1', { files });
    const res = await onRequestPut(ctx);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.ok).toBe(true);
    expect(json.fileCount).toBe(2);
    expect(json.sizeBytes).toBeGreaterThan(0);
    // R2 should have been called
    expect(ctx.env.PROJECTS_BUCKET!.put).toHaveBeenCalledTimes(1);
  });

  it('updates project name if provided', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const ctx = makePutCtx('proj-1', { files: { 'a.js': '1' }, name: 'New Name' });
    await onRequestPut(ctx);
    expect(mockDb.updatedSets[0].name).toBe('New Name');
  });

  it('does not update name if not provided', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const ctx = makePutCtx('proj-1', { files: { 'a.js': '1' } });
    await onRequestPut(ctx);
    expect(mockDb.updatedSets[0].name).toBeUndefined();
  });

  it('returns 404 when project not found', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({ projectRow: null });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestPut(makePutCtx('nonexistent', { files: {} }));
    expect(res.status).toBe(404);
  });

  it('returns 400 when files is missing', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const res = await onRequestPut(makePutCtx('proj-1', { name: 'Test' }));
    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toBe('files object required');
  });

  it('returns 400 when files is not an object', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const res = await onRequestPut(makePutCtx('proj-1', { files: 'not-an-object' }));
    expect(res.status).toBe(400);
  });

  it('handles missing R2 bucket gracefully', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const ctx = makePutCtx('proj-1', { files: { 'a.js': '1' } }, false);
    const res = await onRequestPut(ctx);
    expect(res.status).toBe(200);
  });

  it('handles invalid JSON body', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const ctx = {
      request: new Request('https://ruwt.dev/api/projects/proj-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: '{bad json',
      }),
      env: makeEnv(),
      params: { id: 'proj-1' },
    };
    const res = await onRequestPut(ctx);
    expect(res.status).toBe(400);
  });

  it('returns 500 on unexpected error', async () => {
    (getUser as Mock).mockRejectedValue(new Error('DB crash'));
    const res = await onRequestPut(makePutCtx('proj-1', { files: {} }));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/projects/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/projects/:id', () => {
  it('returns 401 when not authenticated', async () => {
    (getUser as Mock).mockResolvedValue(null);
    const res = await onRequestDelete(makeDeleteCtx());
    expect(res.status).toBe(401);
  });

  it('deletes project on happy path', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const ctx = makeDeleteCtx();
    const res = await onRequestDelete(ctx);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.ok).toBe(true);
    // R2 delete should have been called
    expect(ctx.env.PROJECTS_BUCKET!.delete).toHaveBeenCalledWith('user-1/proj-1.json');
    // D1 delete should have been called
    expect(mockDb.deletedConditions).toHaveLength(1);
  });

  it('returns 404 when project not found', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({ projectRow: null });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestDelete(makeDeleteCtx('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('handles missing R2 bucket gracefully', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const ctx = makeDeleteCtx('proj-1', false);
    const res = await onRequestDelete(ctx);
    expect(res.status).toBe(200);
  });

  it('returns 500 on unexpected error', async () => {
    (getUser as Mock).mockRejectedValue(new Error('DB crash'));
    const res = await onRequestDelete(makeDeleteCtx());
    expect(res.status).toBe(500);
  });
});
