import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDb } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
}));

vi.mock('../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../../drizzle/schema.d1', () => ({
  assessmentSessions: { id: 'id', assessmentId: 'assessment_id', userId: 'user_id', shareToken: 'share_token', status: 'status', totalCost: 'total_cost', totalTokens: 'total_tokens', startedAt: 'started_at', completedAt: 'completed_at' },
  assessments: { id: 'id', title: 'title', description: 'description', companyName: 'company_name', companyLogoUrl: 'company_logo_url' },
  assessmentChallenges: { assessmentId: 'assessment_id', challengeId: 'challenge_id', sortOrder: 'sort_order' },
  challenges: { id: 'id', title: 'title', difficulty: 'difficulty', category: 'category', skillTested: 'skill_tested' },
  attempts: { id: 'id', challengeId: 'challenge_id', assessmentSessionId: 'assessment_session_id', status: 'status', totalCost: 'total_cost', inputTokens: 'input_tokens', outputTokens: 'output_tokens', passedTests: 'passed_tests', totalTests: 'total_tests' },
  aiCalls: { attemptId: 'attempt_id', model: 'model', cost: 'cost', inputTokens: 'input_tokens', outputTokens: 'output_tokens' },
  profiles: { id: 'id', name: 'name', avatarUrl: 'avatar_url' },
}));

import { onRequestGet } from './[shareToken]';

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeCtx(shareToken: string) {
  return {
    request: new Request(`https://ruwt.dev/api/results/${shareToken}`),
    env: makeEnv(),
    params: { shareToken },
  };
}

describe('GET /api/results/:shareToken (public)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 404 when session not found', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });

    const res = await onRequestGet(makeCtx('bad-token'));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Results not found');
  });

  it('returns full results on happy path', async () => {
    const session = { id: 'sess-1', assessmentId: 'assess-1', userId: 'u-1', shareToken: 'tok-1', status: 'completed', totalCost: 1000, totalTokens: 500, startedAt: '2024-01-01', completedAt: '2024-01-01' };
    const assessment = { id: 'assess-1', title: 'QA Test', description: 'Test desc', companyName: 'Acme', companyLogoUrl: null };
    const candidate = { name: 'Alice', avatarUrl: null };
    const challengeList = [{ sortOrder: 1, challenge: { id: 'ch-1', title: 'FizzBuzz', difficulty: 'easy', category: 'prompt_efficiency', skillTested: 'basic' } }];
    const sessionAttempts = [{ id: 'att-1', challengeId: 'ch-1', status: 'passed', totalCost: 500, inputTokens: 100, outputTokens: 200, passedTests: 5, totalTests: 5, assessmentSessionId: 'sess-1' }];
    const aiCallsForAttempt = [{ model: 'gpt-4', cost: 300, inputTokens: 80, outputTokens: 150 }];

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          // session
          return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([session]) };
        }
        if (selectCall === 2) {
          // assessment
          return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([assessment]) };
        }
        if (selectCall === 3) {
          // candidate profile
          return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([candidate]) };
        }
        if (selectCall === 4) {
          // challenges in assessment
          return {
            from: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockResolvedValue(challengeList),
          };
        }
        if (selectCall === 5) {
          // session attempts
          return { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(sessionAttempts) };
        }
        // ai calls per attempt
        return { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(aiCallsForAttempt) };
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx('tok-1'));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.assessment.title).toBe('QA Test');
    expect(json.candidate.name).toBe('Alice');
    expect(json.session.status).toBe('completed');
    expect(json.summary.challengesPassed).toBe(1);
    expect(json.summary.totalChallenges).toBe(1);
    expect(json.challengeResults).toHaveLength(1);
    expect(json.challengeResults[0].status).toBe('passed');
    expect(json.challengeResults[0].modelUsage['gpt-4']).toBeDefined();
    expect(json.challengeResults[0].modelUsage['gpt-4'].calls).toBe(1);
  });

  it('returns Anonymous candidate when profile not found', async () => {
    const session = { id: 'sess-1', assessmentId: 'assess-1', userId: 'u-1', shareToken: 'tok-1', status: 'completed', totalCost: 0, totalTokens: 0, startedAt: 't', completedAt: 't' };

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([session]) };
        if (selectCall === 2) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) }; // no assessment
        if (selectCall === 3) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) }; // no candidate
        if (selectCall === 4) return { from: vi.fn().mockReturnThis(), innerJoin: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockResolvedValue([]) };
        return { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
      }),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestGet(makeCtx('tok-1'));
    const json = await res.json();
    expect(json.candidate.name).toBe('Anonymous');
    expect(json.assessment).toBeNull();
  });

  it('returns 500 on error', async () => {
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestGet(makeCtx('tok-1'));
    expect(res.status).toBe(500);
  });
});
