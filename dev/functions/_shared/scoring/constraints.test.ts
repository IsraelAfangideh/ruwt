import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  validateConstraints,
  checkPreCallConstraints,
  getAttemptWithChallenge,
} from './constraints';

// ---------------------------------------------------------------------------
// Helper: build a mock Db that stubs the drizzle select → from → join → where → limit chain.
// The `rows` argument is the resolved value of the full query.
// ---------------------------------------------------------------------------
function mockDb(rows: any[] = []) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  return {
    select: vi.fn().mockReturnValue(chain),
    _chain: chain, // expose for assertions
  } as any;
}

// ---------------------------------------------------------------------------
// A. calculateConstraintStatus — tested indirectly through validateConstraints
//    because it's a private function. We control the data returned by the mock DB.
// ---------------------------------------------------------------------------
describe('calculateConstraintStatus (via validateConstraints)', () => {
  it('returns valid when cost is within limit', async () => {
    const db = mockDb([{
      attempt: { totalCost: 100, expiresAt: null },
      challenge: { maxCost: 200, wallClockLimit: null },
    }]);

    const result = await validateConstraints(db, 'attempt-1');
    expect(result).toEqual({ valid: true });
  });

  it('returns cost_exceeded when cost >= maxCost', async () => {
    const db = mockDb([{
      attempt: { totalCost: 500, expiresAt: null },
      challenge: { maxCost: 500, wallClockLimit: null },
    }]);

    const result = await validateConstraints(db, 'attempt-1');
    expect(result.valid).toBe(false);
    expect(result.violation).toBe('cost');
    expect(result.message).toContain('Cost limit exceeded');
  });

  it('returns cost_exceeded when cost exceeds maxCost', async () => {
    const db = mockDb([{
      attempt: { totalCost: 600, expiresAt: null },
      challenge: { maxCost: 500, wallClockLimit: null },
    }]);

    const result = await validateConstraints(db, 'attempt-1');
    expect(result.valid).toBe(false);
    expect(result.violation).toBe('cost');
  });

  it('returns time_expired when expiresAt is in the past', async () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString();
    const db = mockDb([{
      attempt: { totalCost: 0, expiresAt: pastDate },
      challenge: { maxCost: 1000, wallClockLimit: 300 },
    }]);

    const result = await validateConstraints(db, 'attempt-1');
    expect(result.valid).toBe(false);
    expect(result.violation).toBe('time');
    expect(result.message).toBe('Time limit expired');
  });

  it('returns valid when expiresAt is in the future', async () => {
    const futureDate = new Date(Date.now() + 60_000).toISOString();
    const db = mockDb([{
      attempt: { totalCost: 0, expiresAt: futureDate },
      challenge: { maxCost: 1000, wallClockLimit: 300 },
    }]);

    const result = await validateConstraints(db, 'attempt-1');
    expect(result).toEqual({ valid: true });
  });

  it('skips cost check when maxCost is null', async () => {
    const db = mockDb([{
      attempt: { totalCost: 999_999, expiresAt: null },
      challenge: { maxCost: null, wallClockLimit: null },
    }]);

    const result = await validateConstraints(db, 'attempt-1');
    expect(result).toEqual({ valid: true });
  });

  it('skips time check when expiresAt is null', async () => {
    const db = mockDb([{
      attempt: { totalCost: 0, expiresAt: null },
      challenge: { maxCost: null, wallClockLimit: 300 },
    }]);

    const result = await validateConstraints(db, 'attempt-1');
    expect(result).toEqual({ valid: true });
  });

  it('reports cost violation first when both cost and time are exceeded', async () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString();
    const db = mockDb([{
      attempt: { totalCost: 1000, expiresAt: pastDate },
      challenge: { maxCost: 500, wallClockLimit: 300 },
    }]);

    const result = await validateConstraints(db, 'attempt-1');
    expect(result.valid).toBe(false);
    // Cost is checked first in the implementation
    expect(result.violation).toBe('cost');
  });

  it('formats cost message in dollar units (divides by 10000)', async () => {
    const db = mockDb([{
      attempt: { totalCost: 50000, expiresAt: null },
      challenge: { maxCost: 50000, wallClockLimit: null },
    }]);

    const result = await validateConstraints(db, 'attempt-1');
    expect(result.message).toContain('$5.0000');
  });
});

// ---------------------------------------------------------------------------
// B. getAttemptWithChallenge
// ---------------------------------------------------------------------------
describe('getAttemptWithChallenge', () => {
  it('returns the first row when the attempt is found', async () => {
    const row = {
      attempt: { id: 'att-1', totalCost: 42 },
      challenge: { id: 'ch-1', maxCost: 100 },
    };
    const db = mockDb([row]);

    const result = await getAttemptWithChallenge(db, 'att-1');
    expect(result).toBe(row);
  });

  it('throws when no attempt is found', async () => {
    const db = mockDb([]);

    await expect(getAttemptWithChallenge(db, 'nonexistent'))
      .rejects.toThrow('Attempt not found: nonexistent');
  });

  it('constructs the query with select, from, innerJoin, where, and limit', async () => {
    const row = { attempt: { id: 'a' }, challenge: { id: 'c' } };
    const db = mockDb([row]);

    await getAttemptWithChallenge(db, 'att-1');

    expect(db.select).toHaveBeenCalledOnce();
    expect(db._chain.from).toHaveBeenCalledOnce();
    expect(db._chain.innerJoin).toHaveBeenCalledOnce();
    expect(db._chain.where).toHaveBeenCalledOnce();
    expect(db._chain.limit).toHaveBeenCalledWith(1);
  });
});

// ---------------------------------------------------------------------------
// C. checkPreCallConstraints
// ---------------------------------------------------------------------------
describe('checkPreCallConstraints', () => {
  it('returns valid when projected cost is under the limit', async () => {
    const db = mockDb([{
      attempt: { totalCost: 100, expiresAt: null },
      challenge: { maxCost: 500, wallClockLimit: null },
    }]);

    const result = await checkPreCallConstraints(db, 'att-1', 200);
    expect(result).toEqual({ valid: true });
  });

  it('returns cost violation when projected cost exceeds limit', async () => {
    const db = mockDb([{
      attempt: { totalCost: 400, expiresAt: null },
      challenge: { maxCost: 500, wallClockLimit: null },
    }]);

    const result = await checkPreCallConstraints(db, 'att-1', 200);
    expect(result.valid).toBe(false);
    expect(result.violation).toBe('cost');
    expect(result.message).toContain('would exceed the cost limit');
  });

  it('returns cost violation when projected cost exactly equals limit', async () => {
    // checkPreCallConstraints uses > (not >=), so exactly at limit should pass
    const db = mockDb([{
      attempt: { totalCost: 300, expiresAt: null },
      challenge: { maxCost: 500, wallClockLimit: null },
    }]);

    const result = await checkPreCallConstraints(db, 'att-1', 200);
    // 300 + 200 = 500, maxCost is 500, uses > not >= so this should be valid
    expect(result).toEqual({ valid: true });
  });

  it('returns time violation when time has expired (even if cost is fine)', async () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString();
    const db = mockDb([{
      attempt: { totalCost: 0, expiresAt: pastDate },
      challenge: { maxCost: 1000, wallClockLimit: 300 },
    }]);

    const result = await checkPreCallConstraints(db, 'att-1', 10);
    expect(result.valid).toBe(false);
    expect(result.violation).toBe('time');
    expect(result.message).toBe('Time limit has expired');
  });

  it('returns valid when maxCost is null (no cost constraint)', async () => {
    const db = mockDb([{
      attempt: { totalCost: 999_999, expiresAt: null },
      challenge: { maxCost: null, wallClockLimit: null },
    }]);

    const result = await checkPreCallConstraints(db, 'att-1', 500_000);
    expect(result).toEqual({ valid: true });
  });

  it('returns valid when time has not expired', async () => {
    const futureDate = new Date(Date.now() + 60_000).toISOString();
    const db = mockDb([{
      attempt: { totalCost: 0, expiresAt: futureDate },
      challenge: { maxCost: null, wallClockLimit: 300 },
    }]);

    const result = await checkPreCallConstraints(db, 'att-1', 100);
    expect(result).toEqual({ valid: true });
  });

  it('formats projected cost in dollar units in the message', async () => {
    const db = mockDb([{
      attempt: { totalCost: 40_000, expiresAt: null },
      challenge: { maxCost: 50_000, wallClockLimit: null },
    }]);

    const result = await checkPreCallConstraints(db, 'att-1', 20_000);
    // projected = 60000 / 10000 = $6.0000, limit = 50000 / 10000 = $5.0000
    expect(result.message).toContain('$6.0000');
    expect(result.message).toContain('$5.0000');
  });

  it('throws when the attempt is not found (delegates to getAttemptWithChallenge)', async () => {
    const db = mockDb([]);

    await expect(checkPreCallConstraints(db, 'missing', 100))
      .rejects.toThrow('Attempt not found: missing');
  });
});
