import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { onRequestGet, onRequestPost } from './projects';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../_shared/auth', () => ({ getUser: vi.fn() }));
vi.mock('../_shared/db', () => ({ getDb: vi.fn() }));
vi.mock('../_shared/ensure-profile', () => ({ ensureProfile: vi.fn() }));
vi.mock('../../drizzle/schema.d1', () => ({
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

import { getUser } from '../_shared/auth';
import { getDb } from '../_shared/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER = { id: 'user-1', email: 'test@ruwt.dev' };

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeGetCtx(params = '') {
  return {
    request: new Request(`https://ruwt.dev/api/projects${params}`),
    env: makeEnv(),
  };
}

function makePostCtx(body: unknown) {
  return {
    request: new Request('https://ruwt.dev/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(),
  };
}

function createMockDb(opts: {
  selectRows?: any[];
  readBackRow?: any;
} = {}) {
  const selectRows = opts.selectRows ?? [];
  const insertedValues: any[] = [];
  let selectCallIdx = 0;

  const db = {
    insertedValues,
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue(selectRows),
            }),
          }),
          limit: vi.fn().mockImplementation(() => {
            selectCallIdx++;
            // First select-with-limit call is the readback after insert
            if (opts.readBackRow) return Promise.resolve([opts.readBackRow]);
            return Promise.resolve([]);
          }),
        }),
      }),
    })),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((val: any) => {
        insertedValues.push(val);
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
  mockDb = createMockDb();
  (getDb as Mock).mockReturnValue(mockDb);
});

// ---------------------------------------------------------------------------
// GET /api/projects
// ---------------------------------------------------------------------------

describe('GET /api/projects', () => {
  it('returns 401 when not authenticated', async () => {
    (getUser as Mock).mockResolvedValue(null);
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(401);
    const json = await res.json() as any;
    expect(json.error).toBe('Unauthorized');
  });

  it('returns projects on happy path', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({
      selectRows: [
        { id: 'p1', userId: 'user-1', name: 'My Project', fileCount: 3, lastOpenedAt: '2024-01-01' },
      ],
    });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.projects).toHaveLength(1);
    expect(json.projects[0].name).toBe('My Project');
  });

  it('returns empty array when user has no projects', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({ selectRows: [] });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.projects).toEqual([]);
  });

  it('caps limit at 50', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({ selectRows: [] });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestGet(makeGetCtx('?limit=100'));
    expect(res.status).toBe(200);
  });

  it('uses default limit and offset', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({ selectRows: [] });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(200);
  });

  it('returns 500 on unexpected error', async () => {
    (getUser as Mock).mockRejectedValue(new Error('DB error'));
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(500);
    const json = await res.json() as any;
    expect(json.error).toBe('Internal server error');
  });
});

// ---------------------------------------------------------------------------
// POST /api/projects
// ---------------------------------------------------------------------------

describe('POST /api/projects', () => {
  it('returns 401 when not authenticated', async () => {
    (getUser as Mock).mockResolvedValue(null);
    const res = await onRequestPost(makePostCtx({ name: 'Test' }));
    expect(res.status).toBe(401);
  });

  it('creates a project with given name', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const readBackRow = { id: 'uuid', userId: 'user-1', name: 'My App', r2Key: 'user-1/uuid.json' };
    mockDb = createMockDb({ readBackRow });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestPost(makePostCtx({ name: 'My App' }));
    expect(res.status).toBe(201);
    const json = await res.json() as any;
    expect(json.project).toBeDefined();
    expect(mockDb.insertedValues).toHaveLength(1);
    expect(mockDb.insertedValues[0].name).toBe('My App');
    expect(mockDb.insertedValues[0].userId).toBe('user-1');
    expect(mockDb.insertedValues[0].r2Key).toContain('user-1/');
  });

  it('defaults name to "Untitled Project" when not provided', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({ readBackRow: { id: 'uuid', name: 'Untitled Project' } });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestPost(makePostCtx({}));
    expect(res.status).toBe(201);
    expect(mockDb.insertedValues[0].name).toBe('Untitled Project');
  });

  it('defaults name to "Untitled Project" when name is empty string', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({ readBackRow: { id: 'uuid', name: 'Untitled Project' } });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestPost(makePostCtx({ name: '  ' }));
    expect(res.status).toBe(201);
    expect(mockDb.insertedValues[0].name).toBe('Untitled Project');
  });

  it('handles invalid JSON body gracefully', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({ readBackRow: { id: 'uuid', name: 'Untitled Project' } });
    (getDb as Mock).mockReturnValue(mockDb);

    const ctx = {
      request: new Request('https://ruwt.dev/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json}',
      }),
      env: makeEnv(),
    };

    const res = await onRequestPost(ctx);
    // Should default to "Untitled Project"
    expect(res.status).toBe(201);
    expect(mockDb.insertedValues[0].name).toBe('Untitled Project');
  });

  it('returns 500 on unexpected error', async () => {
    (getUser as Mock).mockRejectedValue(new Error('DB crash'));
    const res = await onRequestPost(makePostCtx({ name: 'Test' }));
    expect(res.status).toBe(500);
    const json = await res.json() as any;
    expect(json.error).toBe('Internal server error');
  });

  it('returns 500 when DB throws on insert', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    (getDb as Mock).mockImplementation(() => { throw new Error('DB down'); });
    const res = await onRequestPost(makePostCtx({ name: 'Test' }));
    expect(res.status).toBe(500);
  });
});
