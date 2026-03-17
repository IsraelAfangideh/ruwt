import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { onRequestGet, onRequestPost } from './machines';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../_shared/auth', () => ({ getUser: vi.fn() }));
vi.mock('../_shared/db', () => ({ getDb: vi.fn() }));
vi.mock('../_shared/ensure-profile', () => ({ ensureProfile: vi.fn() }));
vi.mock('../../drizzle/schema.d1', () => ({
  cloudMachines: {
    id: 'id',
    userId: 'user_id',
    flyMachineId: 'fly_machine_id',
    bridgeToken: 'bridge_token',
    spec: 'spec',
    status: 'status',
    region: 'region',
    lastActiveAt: 'last_active_at',
    createdAt: 'created_at',
  },
}));

import { getUser } from '../_shared/auth';
import { getDb } from '../_shared/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER = { id: 'user-1', email: 'test@ruwt.dev' };

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'u',
    VITE_SUPABASE_ANON_KEY: 'k',
    FLY_API_TOKEN: 'fly-test-token',
    ...overrides,
  } as Env;
}

function makeGetCtx(envOverrides?: Partial<Env>) {
  return {
    request: new Request('https://ruwt.dev/api/machines'),
    env: makeEnv(envOverrides),
  };
}

function makePostCtx(body: unknown, envOverrides?: Partial<Env>) {
  return {
    request: new Request('https://ruwt.dev/api/machines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: makeEnv(envOverrides),
  };
}

function createMockDb(opts: {
  selectRows?: any[];
  updateFn?: Mock;
  insertFn?: Mock;
} = {}) {
  const selectRows = opts.selectRows ?? [];
  const insertedValues: any[] = [];

  const db = {
    insertedValues,
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(selectRows),
        }),
      }),
    })),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((val: any) => {
        insertedValues.push(val);
        return Promise.resolve(undefined);
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };

  return db;
}

// Mock global fetch for Fly API calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mockDb: ReturnType<typeof createMockDb>;

beforeEach(() => {
  vi.clearAllMocks();
  mockDb = createMockDb();
  (getDb as Mock).mockReturnValue(mockDb);
  mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve('error') });
});

// ---------------------------------------------------------------------------
// GET /api/machines
// ---------------------------------------------------------------------------

describe('GET /api/machines', () => {
  it('returns 401 when not authenticated', async () => {
    (getUser as Mock).mockResolvedValue(null);
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(401);
    const json = await res.json() as any;
    expect(json.error).toBe('Unauthorized');
  });

  it('returns status "none" when user has no machine', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({ selectRows: [] });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.status).toBe('none');
  });

  it('returns machine status when user has a machine', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({
      selectRows: [{
        id: 'm1',
        userId: 'user-1',
        flyMachineId: 'fly-123',
        status: 'running',
        bridgeToken: 'token-abc',
      }],
    });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.status).toBe('running');
    expect(json.machineId).toBe('fly-123');
    expect(json.wsUrl).toContain('ruwt-cloud.fly.dev');
  });

  it('returns 500 on unexpected error', async () => {
    (getUser as Mock).mockRejectedValue(new Error('DB error'));
    const res = await onRequestGet(makeGetCtx());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/machines — action validation
// ---------------------------------------------------------------------------

describe('POST /api/machines — validation', () => {
  it('returns 401 when not authenticated', async () => {
    (getUser as Mock).mockResolvedValue(null);
    const res = await onRequestPost(makePostCtx({ action: 'start' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing action', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const res = await onRequestPost(makePostCtx({}));
    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toContain('Invalid action');
  });

  it('returns 400 for invalid action', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const res = await onRequestPost(makePostCtx({ action: 'destroy' }));
    expect(res.status).toBe(400);
  });

  it('handles invalid JSON body', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const ctx = {
      request: new Request('https://ruwt.dev/api/machines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{bad json}',
      }),
      env: makeEnv(),
    };
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(400); // no action parsed
  });

  it('returns 500 on unexpected error', async () => {
    (getUser as Mock).mockRejectedValue(new Error('crash'));
    const res = await onRequestPost(makePostCtx({ action: 'start' }));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/machines — action: start
// ---------------------------------------------------------------------------

describe('POST /api/machines — start', () => {
  it('returns 503 when FLY_API_TOKEN is not set', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const res = await onRequestPost(makePostCtx(
      { action: 'start' },
      { FLY_API_TOKEN: undefined },
    ));
    expect(res.status).toBe(503);
    const json = await res.json() as any;
    expect(json.error).toBe('Cloud Mode not configured');
  });

  it('returns existing running machine without calling Fly API', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({
      selectRows: [{
        id: 'm1',
        userId: 'user-1',
        flyMachineId: 'fly-123',
        status: 'running',
        bridgeToken: 'existing-token',
      }],
    });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestPost(makePostCtx({ action: 'start' }));
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.machineId).toBe('fly-123');
    expect(json.token).toBe('existing-token');
    // Should NOT have called Fly API
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('starts a stopped machine via Fly API', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({
      selectRows: [{
        id: 'm1',
        userId: 'user-1',
        flyMachineId: 'fly-123',
        status: 'stopped',
        bridgeToken: 'old-token',
      }],
    });
    (getDb as Mock).mockReturnValue(mockDb);

    mockFetch.mockResolvedValueOnce({ ok: true });

    const res = await onRequestPost(makePostCtx({ action: 'start' }));
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.machineId).toBe('fly-123');
    expect(json.token).toBeTruthy();
    // Token should be new (not 'old-token')
    expect(json.token).not.toBe('old-token');

    // Verify Fly API was called to start
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/machines/fly-123/start'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns 502 when Fly API start fails', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({
      selectRows: [{
        id: 'm1',
        userId: 'user-1',
        flyMachineId: 'fly-123',
        status: 'stopped',
        bridgeToken: 'old-token',
      }],
    });
    (getDb as Mock).mockReturnValue(mockDb);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('machine not found'),
    });

    const res = await onRequestPost(makePostCtx({ action: 'start' }));
    expect(res.status).toBe(502);
    const json = await res.json() as any;
    expect(json.error).toContain('Failed to start');
  });

  it('creates a new machine when none exists', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({ selectRows: [] });
    (getDb as Mock).mockReturnValue(mockDb);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'new-fly-id' }),
    });

    const res = await onRequestPost(makePostCtx({ action: 'start', spec: 'medium' }));
    expect(res.status).toBe(201);
    const json = await res.json() as any;
    expect(json.machineId).toBe('new-fly-id');
    expect(json.token).toBeTruthy();
    expect(json.wsUrl).toContain('ruwt-cloud.fly.dev');

    // Verify Fly API was called to create
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/apps/ruwt-cloud/machines'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"memory_mb":1024'), // medium = 1024
      }),
    );

    // Verify D1 insert
    expect(mockDb.insertedValues).toHaveLength(1);
    expect(mockDb.insertedValues[0].flyMachineId).toBe('new-fly-id');
    expect(mockDb.insertedValues[0].spec).toBe('medium');
  });

  it('defaults spec to "light" (512 MB) when not specified', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({ selectRows: [] });
    (getDb as Mock).mockReturnValue(mockDb);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'new-fly-id' }),
    });

    await onRequestPost(makePostCtx({ action: 'start' }));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"memory_mb":512'),
      }),
    );
  });

  it('uses 2048 MB for heavy spec', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({ selectRows: [] });
    (getDb as Mock).mockReturnValue(mockDb);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'new-fly-id' }),
    });

    await onRequestPost(makePostCtx({ action: 'start', spec: 'heavy' }));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"memory_mb":2048'),
      }),
    );
  });

  it('returns 502 when Fly API create fails', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({ selectRows: [] });
    (getDb as Mock).mockReturnValue(mockDb);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('quota exceeded'),
    });

    const res = await onRequestPost(makePostCtx({ action: 'start' }));
    expect(res.status).toBe(502);
    const json = await res.json() as any;
    expect(json.error).toContain('Failed to create');
  });
});

// ---------------------------------------------------------------------------
// POST /api/machines — action: stop
// ---------------------------------------------------------------------------

describe('POST /api/machines — stop', () => {
  it('returns 503 when FLY_API_TOKEN is not set', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    const res = await onRequestPost(makePostCtx(
      { action: 'stop' },
      { FLY_API_TOKEN: undefined },
    ));
    expect(res.status).toBe(503);
  });

  it('returns 404 when user has no machine', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({ selectRows: [] });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestPost(makePostCtx({ action: 'stop' }));
    expect(res.status).toBe(404);
    const json = await res.json() as any;
    expect(json.error).toBe('No machine found');
  });

  it('returns already-stopped status without calling Fly API', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({
      selectRows: [{
        id: 'm1',
        userId: 'user-1',
        flyMachineId: 'fly-123',
        status: 'stopped',
      }],
    });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestPost(makePostCtx({ action: 'stop' }));
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.status).toBe('stopped');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('stops a running machine via Fly API', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({
      selectRows: [{
        id: 'm1',
        userId: 'user-1',
        flyMachineId: 'fly-123',
        status: 'running',
      }],
    });
    (getDb as Mock).mockReturnValue(mockDb);

    mockFetch.mockResolvedValueOnce({ ok: true });

    const res = await onRequestPost(makePostCtx({ action: 'stop' }));
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.status).toBe('stopped');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/machines/fly-123/stop'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns 502 when Fly API stop fails', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({
      selectRows: [{
        id: 'm1',
        userId: 'user-1',
        flyMachineId: 'fly-123',
        status: 'running',
      }],
    });
    (getDb as Mock).mockReturnValue(mockDb);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('stop error'),
    });

    const res = await onRequestPost(makePostCtx({ action: 'stop' }));
    expect(res.status).toBe(502);
  });
});

// ---------------------------------------------------------------------------
// POST /api/machines — action: status
// ---------------------------------------------------------------------------

describe('POST /api/machines — status', () => {
  it('returns "none" when user has no machine', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({ selectRows: [] });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestPost(makePostCtx({ action: 'status' }));
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.status).toBe('none');
  });

  it('returns machine status with wsUrl when running', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({
      selectRows: [{
        id: 'm1',
        userId: 'user-1',
        flyMachineId: 'fly-123',
        status: 'running',
      }],
    });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestPost(makePostCtx({ action: 'status' }));
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.status).toBe('running');
    expect(json.machineId).toBe('fly-123');
    expect(json.wsUrl).toContain('ruwt-cloud.fly.dev');
  });

  it('returns status without wsUrl when stopped', async () => {
    (getUser as Mock).mockResolvedValue(TEST_USER);
    mockDb = createMockDb({
      selectRows: [{
        id: 'm1',
        userId: 'user-1',
        flyMachineId: 'fly-123',
        status: 'stopped',
      }],
    });
    (getDb as Mock).mockReturnValue(mockDb);

    const res = await onRequestPost(makePostCtx({ action: 'status' }));
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.status).toBe('stopped');
    expect(json.wsUrl).toBeUndefined();
  });
});
