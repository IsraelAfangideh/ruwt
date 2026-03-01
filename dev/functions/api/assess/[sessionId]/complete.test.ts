import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────
const { mockGetUser, mockGetDb, mockSendEmail, mockResultsReadyEmail } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetDb: vi.fn(),
  mockSendEmail: vi.fn(),
  mockResultsReadyEmail: vi.fn(),
}));

vi.mock('../../../_shared/auth', () => ({ getUser: mockGetUser }));
vi.mock('../../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../_shared/newsletter/resend', () => ({ sendEmail: mockSendEmail }));
vi.mock('../../../_shared/email/templates', () => ({ resultsReadyEmail: mockResultsReadyEmail }));

import { onRequestPost } from './complete';

// ── Helpers ──────────────────────────────────────────────────────────

const FAKE_USER = { id: 'user-123', email: 'candidate@test.com' };

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
    RESEND_API_KEY: 'test-key',
  } as Env;
}

function makeContext(sessionId: string) {
  return {
    request: new Request(`https://ruwt.dev/api/assess/${sessionId}/complete`, { method: 'POST' }),
    env: makeEnv(),
    params: { sessionId },
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('POST /api/assess/:sessionId/complete', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetDb.mockReset();
    mockSendEmail.mockReset();
    mockResultsReadyEmail.mockReset();
    mockResultsReadyEmail.mockReturnValue({
      subject: 'Results ready',
      html: '<p>Results</p>',
      text: 'Results',
    });
    mockSendEmail.mockResolvedValue({ success: true });
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await onRequestPost(makeContext('sess-1'));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 404 when session does not exist', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const db: Record<string, any> = {};
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('nonexistent'));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Session not found');
  });

  it('returns 400 when session is not in_progress', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const session = {
      id: 'sess-1',
      userId: 'user-123',
      assessmentId: 'a-1',
      status: 'completed',
      inviteId: 'inv-1',
    };

    const db: Record<string, any> = {};
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([session]),
        }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('sess-1'));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Session is not active');
  });

  it('aggregates costs and tokens from attempts and completes session', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const session = {
      id: 'sess-1',
      userId: 'user-123',
      assessmentId: 'a-1',
      status: 'in_progress',
      inviteId: 'inv-1',
    };
    const sessionAttempts = [
      { totalCost: 100, inputTokens: 500, outputTokens: 200, status: 'passed' },
      { totalCost: 250, inputTokens: 1000, outputTokens: 400, status: 'passed' },
      { totalCost: 50, inputTokens: 200, outputTokens: 100, status: 'failed' },
    ];
    const updatedSession = {
      id: 'sess-1',
      status: 'completed',
      totalCost: 400,
      totalTokens: 2400,
      shareToken: 'share-abc123',
    };

    let selectCallCount = 0;
    let updateSetValues: any[] = [];
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (selectCallCount === 2) return Promise.resolve(sessionAttempts);
        return chain;
      });
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([session]);
        if (selectCallCount === 3) return Promise.resolve([updatedSession]);
        // Fire-and-forget: assessment lookup
        if (selectCallCount === 4) return Promise.resolve([]);
        return Promise.resolve([]);
      });
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      return chain;
    });
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockImplementation((val: any) => {
        updateSetValues.push(val);
        return {
          where: vi.fn().mockResolvedValue(undefined),
        };
      }),
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        catch: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('sess-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.session).toEqual(updatedSession);
    expect(json.shareUrl).toBe('https://ruwt.dev/results/share-abc123');

    // Verify cost aggregation: 100 + 250 + 50 = 400
    const sessionUpdate = updateSetValues[0];
    expect(sessionUpdate.totalCost).toBe(400);
    // Verify token aggregation: (500+200) + (1000+400) + (200+100) = 2400
    expect(sessionUpdate.totalTokens).toBe(2400);
    expect(sessionUpdate.status).toBe('completed');
  });

  it('updates invite status to completed when inviteId exists', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const session = {
      id: 'sess-1',
      userId: 'user-123',
      assessmentId: 'a-1',
      status: 'in_progress',
      inviteId: 'inv-1',
    };

    let selectCallCount = 0;
    let updateCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (selectCallCount === 2) return Promise.resolve([]);
        return chain;
      });
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([session]);
        if (selectCallCount === 3) return Promise.resolve([{ ...session, status: 'completed', shareToken: 'tok' }]);
        return Promise.resolve([]);
      });
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      return chain;
    });
    db.update = vi.fn().mockImplementation(() => {
      updateCallCount++;
      return {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      };
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        catch: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockGetDb.mockReturnValue(db);

    await onRequestPost(makeContext('sess-1'));

    // Should have 2 update calls: session status + invite status
    expect(updateCallCount).toBe(2);
  });

  it('skips invite update when inviteId is null', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const session = {
      id: 'sess-1',
      userId: 'user-123',
      assessmentId: 'a-1',
      status: 'in_progress',
      inviteId: null, // no invite
    };

    let selectCallCount = 0;
    let updateCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (selectCallCount === 2) return Promise.resolve([]);
        return chain;
      });
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([session]);
        if (selectCallCount === 3) return Promise.resolve([{ ...session, status: 'completed', shareToken: 'tok' }]);
        return Promise.resolve([]);
      });
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      return chain;
    });
    db.update = vi.fn().mockImplementation(() => {
      updateCallCount++;
      return {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      };
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        catch: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockGetDb.mockReturnValue(db);

    await onRequestPost(makeContext('sess-1'));

    // Only 1 update call: session status (no invite update)
    expect(updateCallCount).toBe(1);
  });

  it('sends results-ready email to assessment creator in fire-and-forget', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const session = {
      id: 'sess-1',
      userId: 'user-123',
      assessmentId: 'a-1',
      status: 'in_progress',
      inviteId: null,
    };
    const sessionAttempts = [
      { totalCost: 100, inputTokens: 500, outputTokens: 200, status: 'passed' },
      { totalCost: 50, inputTokens: 200, outputTokens: 100, status: 'failed' },
    ];
    const updatedSession = {
      id: 'sess-1',
      status: 'completed',
      shareToken: 'tok-abc',
    };
    const assessment = { id: 'a-1', createdBy: 'creator-1', title: 'Test Assessment' };
    const creatorProfile = { email: 'creator@test.com', displayName: 'Creator' };
    const candidateProfile = { email: 'candidate@test.com', displayName: 'Candidate' };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (selectCallCount === 2) return Promise.resolve(sessionAttempts);
        return chain;
      });
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([session]);
        if (selectCallCount === 3) return Promise.resolve([updatedSession]);
        // Fire-and-forget: assessment lookup
        if (selectCallCount === 4) return Promise.resolve([assessment]);
        // Creator profile lookup
        if (selectCallCount === 5) return Promise.resolve([creatorProfile]);
        // Candidate profile lookup
        if (selectCallCount === 6) return Promise.resolve([candidateProfile]);
        return Promise.resolve([]);
      });
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      return chain;
    });
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        catch: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('sess-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.session.status).toBe('completed');

    // Give the fire-and-forget async a tick to run
    await new Promise(r => setTimeout(r, 50));

    // The resultsReadyEmail template should have been called with proper args
    expect(mockResultsReadyEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateName: 'Candidate',
        assessmentTitle: 'Test Assessment',
        challengesPassed: 1,
        totalChallenges: 2,
      }),
    );

    // sendEmail should have been called to notify the creator
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        to: 'creator@test.com',
      }),
    );
  });

  it('handles fire-and-forget email failure without crashing', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockSendEmail.mockRejectedValue(new Error('Email service down'));

    const session = {
      id: 'sess-1',
      userId: 'user-123',
      assessmentId: 'a-1',
      status: 'in_progress',
      inviteId: null,
    };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (selectCallCount === 2) return Promise.resolve([{ totalCost: 100, inputTokens: 500, outputTokens: 200, status: 'passed' }]);
        return chain;
      });
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([session]);
        if (selectCallCount === 3) return Promise.resolve([{ ...session, status: 'completed', shareToken: 'tok' }]);
        if (selectCallCount === 4) return Promise.resolve([{ id: 'a-1', createdBy: 'c-1', title: 'Test' }]);
        if (selectCallCount === 5) return Promise.resolve([{ email: 'c@test.com', displayName: 'C' }]);
        if (selectCallCount === 6) return Promise.resolve([{ email: 'u@test.com', displayName: 'U' }]);
        return Promise.resolve([]);
      });
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      return chain;
    });
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ catch: vi.fn().mockResolvedValue(undefined) }),
    });
    mockGetDb.mockReturnValue(db);

    // Should not throw — fire-and-forget catches errors
    const res = await onRequestPost(makeContext('sess-1'));
    expect(res.status).toBe(200);

    await new Promise(r => setTimeout(r, 50));
  });

  it('returns 500 when outer try/catch catches an error', async () => {
    mockGetUser.mockRejectedValue(new Error('Auth explosion'));

    const res = await onRequestPost(makeContext('sess-1'));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });

  it('skips email when assessment not found in fire-and-forget (line 86)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const session = {
      id: 'sess-1',
      userId: 'user-123',
      assessmentId: 'a-1',
      status: 'in_progress',
      inviteId: null,
    };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (selectCallCount === 2) return Promise.resolve([]);
        return chain;
      });
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([session]);
        if (selectCallCount === 3) return Promise.resolve([{ ...session, status: 'completed', shareToken: 'tok' }]);
        // Fire-and-forget: assessment NOT found
        if (selectCallCount === 4) return Promise.resolve([]);
        return Promise.resolve([]);
      });
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      return chain;
    });
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ catch: vi.fn().mockResolvedValue(undefined) }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('sess-1'));
    expect(res.status).toBe(200);

    await new Promise(r => setTimeout(r, 50));
    // Email should NOT have been sent since assessment was not found
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('skips email when creator has no email address (line 93)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const session = {
      id: 'sess-1',
      userId: 'user-123',
      assessmentId: 'a-1',
      status: 'in_progress',
      inviteId: null,
    };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (selectCallCount === 2) return Promise.resolve([]);
        return chain;
      });
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([session]);
        if (selectCallCount === 3) return Promise.resolve([{ ...session, status: 'completed', shareToken: 'tok' }]);
        // Fire-and-forget: assessment found
        if (selectCallCount === 4) return Promise.resolve([{ id: 'a-1', createdBy: 'c-1', title: 'Test' }]);
        // Creator profile: NO email
        if (selectCallCount === 5) return Promise.resolve([{ email: null, displayName: 'NoEmail' }]);
        return Promise.resolve([]);
      });
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      return chain;
    });
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ catch: vi.fn().mockResolvedValue(undefined) }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('sess-1'));
    expect(res.status).toBe(200);

    await new Promise(r => setTimeout(r, 50));
    // Email should NOT have been sent since creator has no email
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('handles emailLogs insert failure gracefully (line 134)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const session = {
      id: 'sess-1',
      userId: 'user-123',
      assessmentId: 'a-1',
      status: 'in_progress',
      inviteId: null,
    };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (selectCallCount === 2) return Promise.resolve([{ totalCost: 50, inputTokens: 100, outputTokens: 50, status: 'passed' }]);
        return chain;
      });
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([session]);
        if (selectCallCount === 3) return Promise.resolve([{ ...session, status: 'completed', shareToken: 'tok' }]);
        if (selectCallCount === 4) return Promise.resolve([{ id: 'a-1', createdBy: 'c-1', title: 'Test' }]);
        if (selectCallCount === 5) return Promise.resolve([{ email: 'c@test.com', displayName: 'C' }]);
        if (selectCallCount === 6) return Promise.resolve([{ email: 'u@test.com', displayName: 'U' }]);
        return Promise.resolve([]);
      });
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      return chain;
    });
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    // emailLogs insert throws
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        catch: vi.fn().mockImplementation((fn: Function) => { fn(new Error('insert fail')); return Promise.resolve(); }),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('sess-1'));
    expect(res.status).toBe(200);

    await new Promise(r => setTimeout(r, 50));
    // Email was sent, insert failure was caught — no crash
    expect(mockSendEmail).toHaveBeenCalled();
  });

  it('uses candidate email as fallback name when displayName is missing (line 110)', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const session = {
      id: 'sess-1',
      userId: 'user-123',
      assessmentId: 'a-1',
      status: 'in_progress',
      inviteId: null,
    };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (selectCallCount === 2) return Promise.resolve([{ totalCost: 50, inputTokens: 100, outputTokens: 50, status: 'passed' }]);
        return chain;
      });
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([session]);
        if (selectCallCount === 3) return Promise.resolve([{ ...session, status: 'completed', shareToken: 'tok' }]);
        if (selectCallCount === 4) return Promise.resolve([{ id: 'a-1', createdBy: 'c-1', title: 'Test' }]);
        if (selectCallCount === 5) return Promise.resolve([{ email: 'c@test.com', displayName: 'C' }]);
        // Candidate: no displayName, only email
        if (selectCallCount === 6) return Promise.resolve([{ email: 'candidate@test.com', displayName: null }]);
        return Promise.resolve([]);
      });
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      return chain;
    });
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ catch: vi.fn().mockResolvedValue(undefined) }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('sess-1'));
    expect(res.status).toBe(200);

    await new Promise(r => setTimeout(r, 50));
    expect(mockResultsReadyEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateName: 'candidate@test.com',
      }),
    );
  });

  it('includes shareUrl in response using the shareToken', async () => {
    mockGetUser.mockResolvedValue(FAKE_USER);

    const session = {
      id: 'sess-1',
      userId: 'user-123',
      assessmentId: 'a-1',
      status: 'in_progress',
      inviteId: null,
    };
    const updatedSession = {
      id: 'sess-1',
      status: 'completed',
      shareToken: 'mytoken123',
    };

    let selectCallCount = 0;
    const db: Record<string, any> = {};
    db.select = vi.fn().mockImplementation(() => {
      selectCallCount++;
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => {
        if (selectCallCount === 2) return Promise.resolve([]);
        return chain;
      });
      chain.limit = vi.fn().mockImplementation(() => {
        if (selectCallCount === 1) return Promise.resolve([session]);
        if (selectCallCount === 3) return Promise.resolve([updatedSession]);
        return Promise.resolve([]);
      });
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      return chain;
    });
    db.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        catch: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeContext('sess-1'));
    const json = await res.json();

    expect(json.shareUrl).toBe('https://ruwt.dev/results/mytoken123');
  });
});
