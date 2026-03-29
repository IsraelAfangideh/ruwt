import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted runs before vi.mock hoisting, so the mock fn is available in the factory
const { mockDrizzle, mockSchema } = vi.hoisted(() => ({
  mockDrizzle: vi.fn(),
  mockSchema: { challenges: 'challenges-table', attempts: 'attempts-table' },
}));

vi.mock('drizzle-orm/d1', () => ({
  drizzle: mockDrizzle,
}));

vi.mock('../../../drizzle/schema.d1', () => mockSchema);

import { getDb } from './db';

describe('getDb', () => {
  beforeEach(() => {
    mockDrizzle.mockReset();
  });

  it('calls drizzle with the D1 binding and schema', () => {
    const fakeD1 = { prepare: vi.fn() } as unknown as D1Database;
    const env = { DB: fakeD1 };

    mockDrizzle.mockReturnValue({ query: {} });

    getDb(env);

    expect(mockDrizzle).toHaveBeenCalledOnce();
    expect(mockDrizzle).toHaveBeenCalledWith(fakeD1, { schema: mockSchema });
  });

  it('returns the drizzle instance', () => {
    const fakeDrizzleInstance = { query: {}, select: vi.fn() };
    mockDrizzle.mockReturnValue(fakeDrizzleInstance);

    const db = getDb({ DB: {} as D1Database });

    expect(db).toBe(fakeDrizzleInstance);
  });

  it('passes different D1 bindings through to drizzle', () => {
    const db1 = { name: 'binding-1' } as unknown as D1Database;
    const db2 = { name: 'binding-2' } as unknown as D1Database;

    mockDrizzle.mockReturnValue({});

    getDb({ DB: db1 });
    getDb({ DB: db2 });

    expect(mockDrizzle).toHaveBeenCalledTimes(2);
    expect(mockDrizzle.mock.calls[0][0]).toBe(db1);
    expect(mockDrizzle.mock.calls[1][0]).toBe(db2);
  });
});
