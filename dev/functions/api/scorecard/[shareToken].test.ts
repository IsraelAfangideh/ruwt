import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDb } = vi.hoisted(() => ({ mockGetDb: vi.fn() }));

vi.mock('../../_shared/infra/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../drizzle/schema.d1', () => ({
  assessmentSessions: {
    id: 'id', assessmentId: 'assessment_id', userId: 'user_id', shareToken: 'share_token',
    totalCost: 'total_cost', totalTokens: 'total_tokens', completedAt: 'completed_at',
  },
  assessments: { id: 'id', title: 'title' },
  assessmentChallenges: { assessmentId: 'assessment_id', challengeId: 'challenge_id', sortOrder: 'sort_order' },
  challenges: { id: 'id', title: 'title', difficulty: 'difficulty', category: 'category' },
  attempts: {
    id: 'id', challengeId: 'challenge_id', assessmentSessionId: 'assessment_session_id',
    status: 'status', totalCost: 'total_cost', passedTests: 'passed_tests', totalTests: 'total_tests',
    inputTokens: 'input_tokens', outputTokens: 'output_tokens',
  },
  aiCalls: { attemptId: 'attempt_id', model: 'model', cost: 'cost', inputTokens: 'input_tokens', outputTokens: 'output_tokens' },
}));

import { onRequestGet } from './[shareToken]';

function makeCtx(shareToken: string) {
  return {
    request: new Request(`https://ruwt.dev/api/scorecard/${shareToken}`),
    env: { DB: {} as D1Database } as Env,
    params: { shareToken },
  };
}

interface Override {
  session?: any | null;
  assessment?: any | null;
  challengeList?: any[];
  sessionAttempts?: any[];
  aiCallsByAttempt?: Record<string, any[]>;
}

function makeDb(o: Override) {
  let call = 0;
  return {
    select: vi.fn().mockImplementation(() => {
      call++;
      if (call === 1) {
        // session
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue(o.session ? [o.session] : []),
        };
      }
      if (call === 2) {
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue(o.assessment ? [o.assessment] : []),
        };
      }
      if (call === 3) {
        return {
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockResolvedValue(o.challengeList ?? []),
        };
      }
      if (call === 4) {
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue(o.sessionAttempts ?? []),
        };
      }
      // subsequent: aiCalls per attempt — order matches attempts array
      const attemptIdx = call - 5;
      const att = (o.sessionAttempts ?? [])[attemptIdx];
      const calls = att ? (o.aiCallsByAttempt?.[att.id] ?? []) : [];
      return { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(calls) };
    }),
  };
}

describe('GET /api/scorecard/:shareToken (recruiter view)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 404 when session not found', async () => {
    mockGetDb.mockReturnValue(makeDb({ session: null }));
    const res = await onRequestGet(makeCtx('bad'));
    expect(res.status).toBe(404);
  });

  it('returns anonymized candidate ref derived from session id', async () => {
    mockGetDb.mockReturnValue(makeDb({
      session: { id: 'aaaaaaaa-bbbb-cccc-dddd-1234abcd5678', assessmentId: 'a-1', shareToken: 't', totalCost: 0, totalTokens: 0, completedAt: 'now' },
      assessment: { title: 'Senior Role' },
    }));
    const res = await onRequestGet(makeCtx('t'));
    const json = await res.json() as any;
    expect(json.candidateRef).toBe('Candidate #5678');
    // Critical: no PII fields leak through
    expect(json.candidate).toBeUndefined();
    expect(json.email).toBeUndefined();
    expect(json.name).toBeUndefined();
  });

  it('uppercases hex letters in the candidate ref', async () => {
    mockGetDb.mockReturnValue(makeDb({
      session: { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeffabcdef', assessmentId: 'a-1', shareToken: 't', totalCost: 0, totalTokens: 0, completedAt: 'now' },
      assessment: { title: 'X' },
    }));
    const res = await onRequestGet(makeCtx('t'));
    const json = await res.json() as any;
    expect(json.candidateRef).toBe('Candidate #CDEF');
  });

  it('classifies as Strong when pass rate >= 80%', async () => {
    const session = { id: 'sess-strong', assessmentId: 'a-1', shareToken: 't', totalCost: 1000, totalTokens: 500, completedAt: 'now' };
    const challengeList = [
      { sortOrder: 1, challenge: { id: 'c1', title: 'A', difficulty: 'easy', category: 'prompt_efficiency' } },
      { sortOrder: 2, challenge: { id: 'c2', title: 'B', difficulty: 'easy', category: 'debugging' } },
      { sortOrder: 3, challenge: { id: 'c3', title: 'C', difficulty: 'medium', category: 'real_world' } },
      { sortOrder: 4, challenge: { id: 'c4', title: 'D', difficulty: 'medium', category: 'real_world' } },
      { sortOrder: 5, challenge: { id: 'c5', title: 'E', difficulty: 'easy', category: 'debugging' } },
    ];
    const sessionAttempts = [
      { id: 'a1', challengeId: 'c1', status: 'passed', totalCost: 100, passedTests: 3, totalTests: 3, assessmentSessionId: 'sess-strong' },
      { id: 'a2', challengeId: 'c2', status: 'passed', totalCost: 100, passedTests: 3, totalTests: 3, assessmentSessionId: 'sess-strong' },
      { id: 'a3', challengeId: 'c3', status: 'passed', totalCost: 200, passedTests: 4, totalTests: 4, assessmentSessionId: 'sess-strong' },
      { id: 'a4', challengeId: 'c4', status: 'passed', totalCost: 200, passedTests: 4, totalTests: 4, assessmentSessionId: 'sess-strong' },
      { id: 'a5', challengeId: 'c5', status: 'failed', totalCost: 50, passedTests: 1, totalTests: 3, assessmentSessionId: 'sess-strong' },
    ];
    mockGetDb.mockReturnValue(makeDb({
      session, assessment: { title: 'X' },
      challengeList, sessionAttempts,
      aiCallsByAttempt: {
        a1: [{ model: 'haiku', cost: 100, inputTokens: 50, outputTokens: 50 }],
        a2: [{ model: 'haiku', cost: 100, inputTokens: 50, outputTokens: 50 }],
        a3: [{ model: 'sonnet', cost: 100, inputTokens: 50, outputTokens: 50 }, { model: 'sonnet', cost: 100, inputTokens: 50, outputTokens: 50 }],
        a4: [{ model: 'sonnet', cost: 100, inputTokens: 50, outputTokens: 50 }, { model: 'sonnet', cost: 100, inputTokens: 50, outputTokens: 50 }],
        a5: [{ model: 'haiku', cost: 50, inputTokens: 25, outputTokens: 25 }],
      },
    }));

    const res = await onRequestGet(makeCtx('t'));
    const json = await res.json() as any;
    expect(json.passRate).toBe(0.8);
    expect(json.challengesPassed).toBe(4);
    expect(json.totalChallenges).toBe(5);
    expect(json.rating.tier).toBe('strong');
    // Efficient solver flag: 4 passes, all with ≤4 calls
    expect(json.flags.find((f: any) => f.label === 'Efficient solver')).toBeDefined();
  });

  it('flags over-spec model usage on trivial tasks', async () => {
    const session = { id: 'sess-flag', assessmentId: 'a-1', shareToken: 't', totalCost: 5000, totalTokens: 1000, completedAt: 'now' };
    const challengeList = [
      { sortOrder: 1, challenge: { id: 'c1', title: 'Trivial', difficulty: 'easy', category: 'prompt_efficiency' } },
    ];
    const sessionAttempts = [
      { id: 'a1', challengeId: 'c1', status: 'passed', totalCost: 5000, passedTests: 3, totalTests: 3, assessmentSessionId: 'sess-flag' },
    ];
    mockGetDb.mockReturnValue(makeDb({
      session, assessment: { title: 'X' }, challengeList, sessionAttempts,
      aiCallsByAttempt: {
        a1: [{ model: 'gpt-o1', cost: 5000, inputTokens: 500, outputTokens: 500 }],
      },
    }));
    const res = await onRequestGet(makeCtx('t'));
    const json = await res.json() as any;
    const flag = json.flags.find((f: any) => f.label === 'Over-spec model usage');
    expect(flag).toBeDefined();
    expect(flag.type).toBe('caution');
  });

  it('flags high iteration count when an attempt has 12+ AI calls', async () => {
    const session = { id: 'sess-iter', assessmentId: 'a-1', shareToken: 't', totalCost: 9999, totalTokens: 9999, completedAt: 'now' };
    const challengeList = [
      { sortOrder: 1, challenge: { id: 'c1', title: 'Hard', difficulty: 'hard', category: 'real_world' } },
    ];
    const sessionAttempts = [
      { id: 'a1', challengeId: 'c1', status: 'failed', totalCost: 9999, passedTests: 1, totalTests: 5, assessmentSessionId: 'sess-iter' },
    ];
    const manyCalls = Array.from({ length: 15 }, () => ({ model: 'haiku', cost: 100, inputTokens: 30, outputTokens: 30 }));
    mockGetDb.mockReturnValue(makeDb({
      session, assessment: { title: 'X' }, challengeList, sessionAttempts,
      aiCallsByAttempt: { a1: manyCalls },
    }));
    const res = await onRequestGet(makeCtx('t'));
    const json = await res.json() as any;
    expect(json.flags.find((f: any) => f.label === 'High iteration count')).toBeDefined();
  });

  it('flags No passing solutions when nothing passes', async () => {
    const session = { id: 'sess-fail', assessmentId: 'a-1', shareToken: 't', totalCost: 100, totalTokens: 50, completedAt: 'now' };
    const challengeList = [
      { sortOrder: 1, challenge: { id: 'c1', title: 'A', difficulty: 'easy', category: null } },
    ];
    const sessionAttempts = [
      { id: 'a1', challengeId: 'c1', status: 'failed', totalCost: 100, passedTests: 0, totalTests: 3, assessmentSessionId: 'sess-fail' },
    ];
    mockGetDb.mockReturnValue(makeDb({
      session, assessment: { title: 'X' }, challengeList, sessionAttempts,
      aiCallsByAttempt: { a1: [{ model: 'haiku', cost: 100, inputTokens: 50, outputTokens: 50 }] },
    }));
    const res = await onRequestGet(makeCtx('t'));
    const json = await res.json() as any;
    expect(json.rating.tier).toBe('novice');
    expect(json.flags.find((f: any) => f.label === 'No passing solutions')).toBeDefined();
  });

  it('handles missing assessment gracefully', async () => {
    const session = { id: 'sess-noa', assessmentId: 'a-1', shareToken: 't', totalCost: 0, totalTokens: 0, completedAt: 'now' };
    mockGetDb.mockReturnValue(makeDb({ session, assessment: null }));
    const res = await onRequestGet(makeCtx('t'));
    const json = await res.json() as any;
    expect(res.status).toBe(200);
    expect(json.assessmentTitle).toBeNull();
  });

  it('returns 500 on db error', async () => {
    mockGetDb.mockReturnValue({ select: vi.fn(() => { throw new Error('boom'); }) });
    const res = await onRequestGet(makeCtx('t'));
    expect(res.status).toBe(500);
  });
});
