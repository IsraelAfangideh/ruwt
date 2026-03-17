import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { onRequestGet } from './files';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../_shared/auth', () => ({ getUser: vi.fn() }));
vi.mock('../../../_shared/db', () => ({ getDb: vi.fn() }));
vi.mock('../../../_shared/ensure-profile', () => ({ ensureProfile: vi.fn() }));
vi.mock('../../../../drizzle/schema.d1', () => ({
  projects: {
    id: 'id',
    userId: 'user_id',
    name: 'name',
    r2Key: 'r2_key',
  },
}));

import { getUser } from '../../../_shared/auth';
import { getDb } from '../../../_shared/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER = { id: 'user-1', email: 'test@ruwt.dev' };
const TEST_PROJECT = {
  id: 'proj-1',
  userId: 'user-1',
  name: 'My Project',
  r2Key: 'user-1/proj-1.json',
};

function makeEnv(bucket?: { get: Mock }): Env {
  const env: any = { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' };
  if (bucket) {
    env.PROJECTS_BUCKET = bucket;
  }
  return env as Env;
}

function makeCtx(id: string, bucket?: { get: Mock }) {
  return {
    request: new Request(`https://ruwt.dev/api/projects/${id}/files`),
    env: makeEnv(bucket),
    params: { id },
  };
}

function createMockDb(projectRow?: any) {
  return {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(projectRow ? [projectRow] : []),
        }),
      }),
    })),
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mockDb: ReturnType<typeof createMockDb>;

beforeEach(() => {
  vi.clearAllMocks();
  mockDb = createMockDb(TEST_PROJECT);
  (getDb as Mock).mockReturnValue(mockDb);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/projects/:id/files', () => {
  it('returns 401 when not authenticated', async () => {
    (getUser as Mock).mockResolvedValue(null);
    const res = await onRequestGet(makeCtx('proj-1'));
    expect(res.status).toBe(401);
  });

  it('returns files on happy path', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const files = { 'index.js': 'console.log("hi")' };
    const bucket = {
      get: vi.fn().mockResolvedValue({ text: () => Promise.resolve(JSON.stringify(files)) }),
    };

    const res = await onRequestGet(makeCtx('proj-1', bucket));
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.files).toEqual(files);
    expect(bucket.get).toHaveBeenCalledWith('user-1/proj-1.json');
  });

  it('returns empty files when R2 object not found', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const bucket = { get: vi.fn().mockResolvedValue(null) };

    const res = await onRequestGet(makeCtx('proj-1', bucket));
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.files).toEqual({});
  });

  it('returns empty files when R2 bucket not available', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);

    const res = await onRequestGet(makeCtx('proj-1'));
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.files).toEqual({});
  });

  it('returns empty files when R2 content is invalid JSON', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const bucket = {
      get: vi.fn().mockResolvedValue({ text: () => Promise.resolve('not json') }),
    };

    const res = await onRequestGet(makeCtx('proj-1', bucket));
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.files).toEqual({});
  });

  it('returns 404 when project not found', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb(null);
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestGet(makeCtx('nonexistent'));
    expect(res.status).toBe(404);
    const json = await res.json() as any;
    expect(json.error).toBe('Project not found');
  });

  it('returns 500 on unexpected error', async () => {
    (getUser as Mock).mockRejectedValue(new Error('DB crash'));
    const res = await onRequestGet(makeCtx('proj-1'));
    expect(res.status).toBe(500);
    const json = await res.json() as any;
    expect(json.error).toBe('Internal server error');
  });
});
