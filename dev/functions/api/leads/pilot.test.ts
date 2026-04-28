import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost } from './pilot';

vi.mock('../../_shared/infra/db', () => ({ getDb: vi.fn() }));
vi.mock('../../../drizzle/schema.d1', () => ({
  pilotLeads: { id: 'id' },
}));

import { getDb } from '../../_shared/infra/db';

function makeEnv(): Env {
  return { DB: {} as D1Database } as Env;
}

function makeCtx(body: unknown, headers: Record<string, string> = {}) {
  return {
    request: new Request('https://ruwt.dev/api/leads/pilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    env: makeEnv(),
  };
}

function makeMockDb() {
  const inserted: any[] = [];
  const db = {
    inserted,
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((v: any) => {
        inserted.push(v);
        return Promise.resolve();
      }),
    })),
  };
  return db;
}

describe('POST /api/leads/pilot', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects missing email', async () => {
    const res = await onRequestPost(makeCtx({}));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/email/i);
  });

  it('rejects malformed email', async () => {
    const res = await onRequestPost(makeCtx({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
  });

  it('rejects free-provider emails with explanatory message', async () => {
    const res = await onRequestPost(makeCtx({ email: 'someone@gmail.com' }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/work email/i);
  });

  it('stores a valid lead and returns 201 with id', async () => {
    const db = makeMockDb();
    (getDb as any).mockReturnValue(db);

    const res = await onRequestPost(makeCtx({
      email: 'cto@acme.io',
      name: 'Sam',
      company: 'Acme',
      role: 'CTO',
      hiresPerYear: 25,
      currentTool: 'Codility',
      notes: 'Tired of Cluely-passing candidates',
    }, { 'CF-Connecting-IP': '203.0.113.5', 'User-Agent': 'curl/8' }));

    expect(res.status).toBe(201);
    const body = await res.json() as { ok: boolean; id: string };
    expect(body.ok).toBe(true);
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);

    expect(db.inserted).toHaveLength(1);
    const row = db.inserted[0];
    expect(row.email).toBe('cto@acme.io');
    expect(row.name).toBe('Sam');
    expect(row.company).toBe('Acme');
    expect(row.hiresPerYear).toBe(25);
    expect(row.currentTool).toBe('Codility');
    expect(row.notes).toContain('Cluely');
    expect(row.ip).toBe('203.0.113.5');
    expect(row.userAgent).toBe('curl/8');
  });

  it('lowercases and trims the email', async () => {
    const db = makeMockDb();
    (getDb as any).mockReturnValue(db);
    await onRequestPost(makeCtx({ email: '  CTO@Acme.IO  ' }));
    expect(db.inserted[0].email).toBe('cto@acme.io');
  });

  it('clamps hiresPerYear to a reasonable range', async () => {
    const db = makeMockDb();
    (getDb as any).mockReturnValue(db);
    await onRequestPost(makeCtx({ email: 'cto@acme.io', hiresPerYear: -50 }));
    expect(db.inserted[0].hiresPerYear).toBe(0);

    db.inserted.length = 0;
    await onRequestPost(makeCtx({ email: 'cto@acme.io', hiresPerYear: 9_999_999 }));
    expect(db.inserted[0].hiresPerYear).toBe(100000);
  });

  it('stores null for missing optional fields', async () => {
    const db = makeMockDb();
    (getDb as any).mockReturnValue(db);
    await onRequestPost(makeCtx({ email: 'cto@acme.io' }));
    const row = db.inserted[0];
    expect(row.name).toBeNull();
    expect(row.company).toBeNull();
    expect(row.role).toBeNull();
    expect(row.hiresPerYear).toBeNull();
    expect(row.currentTool).toBeNull();
    expect(row.notes).toBeNull();
  });

  it('returns 500 on db error', async () => {
    (getDb as any).mockReturnValue({
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockRejectedValue(new Error('db down')) }),
    });
    const res = await onRequestPost(makeCtx({ email: 'cto@acme.io' }));
    expect(res.status).toBe(500);
  });

  it('handles non-JSON body gracefully', async () => {
    const res = await onRequestPost(makeCtx('not-json'));
    expect(res.status).toBe(400);
  });

  it('falls back to X-Forwarded-For when CF-Connecting-IP missing', async () => {
    const db = makeMockDb();
    (getDb as any).mockReturnValue(db);
    await onRequestPost(makeCtx(
      { email: 'cto@acme.io' },
      { 'X-Forwarded-For': '198.51.100.1, 10.0.0.1' },
    ));
    expect(db.inserted[0].ip).toBe('198.51.100.1');
  });
});
