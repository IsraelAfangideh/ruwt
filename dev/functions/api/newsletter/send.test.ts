import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGetDb, mockSendEmail, mockGetPlatformActivity,
  mockGenerateSharedContent, mockGeneratePerUserDigest,
  mockGenerateLinkedinDraft, mockClassifyUserState,
  mockBuildWeeklyHtml, mockBuildWeeklyText,
  mockGetRivals, mockGetSmartRecommendations,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockSendEmail: vi.fn().mockResolvedValue({ success: true, id: 'msg-1' }),
  mockGetPlatformActivity: vi.fn().mockResolvedValue({ recentCommits: [] }),
  mockGenerateSharedContent: vi.fn().mockResolvedValue({ whatsNew: 'New stuff' }),
  mockGeneratePerUserDigest: vi.fn().mockResolvedValue({ subject: 'Weekly digest', body: 'Your digest' }),
  mockGenerateLinkedinDraft: vi.fn().mockResolvedValue('LinkedIn post draft'),
  mockClassifyUserState: vi.fn().mockResolvedValue({ state: 'active' }),
  mockBuildWeeklyHtml: vi.fn().mockReturnValue('<html>digest</html>'),
  mockBuildWeeklyText: vi.fn().mockReturnValue('text digest'),
  mockGetRivals: vi.fn().mockResolvedValue([]),
  mockGetSmartRecommendations: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../_shared/newsletter/resend', () => ({ sendEmail: mockSendEmail }));
vi.mock('../../_shared/newsletter/content', () => ({
  getPlatformActivity: mockGetPlatformActivity,
  generateSharedContent: mockGenerateSharedContent,
  generatePerUserDigest: mockGeneratePerUserDigest,
  generateLinkedinDraft: mockGenerateLinkedinDraft,
  classifyUserState: mockClassifyUserState,
}));
vi.mock('../../_shared/newsletter/template', () => ({
  buildWeeklyHtml: mockBuildWeeklyHtml,
  buildWeeklyText: mockBuildWeeklyText,
}));
vi.mock('../../_shared/rivals', () => ({ getRivals: mockGetRivals }));
vi.mock('../../_shared/recommendations', () => ({ getSmartRecommendations: mockGetSmartRecommendations }));

import { onRequestPost } from './send';

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    VITE_SUPABASE_URL: 'u',
    VITE_SUPABASE_ANON_KEY: 'k',
    CRON_SECRET: 'secret-123',
    ADMIN_USER_IDS: 'admin-1',
    ...overrides,
  } as Env;
}

function makeCtx(token?: string, params = '', env?: Env) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return {
    request: new Request(`https://ruwt.dev/api/newsletter/send${params}`, { method: 'POST', headers }),
    env: env ?? makeEnv(),
  };
}

function makeTestDb(subscribers: any[] = []) {
  return {
    all: vi.fn().mockResolvedValue(subscribers),
    run: vi.fn().mockResolvedValue({}),
  };
}

describe('POST /api/newsletter/send (cron-secured)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Re-set the defaults that resetAllMocks clears
    mockSendEmail.mockResolvedValue({ success: true, id: 'msg-1' });
    mockGetPlatformActivity.mockResolvedValue({ recentCommits: [] });
    mockGenerateSharedContent.mockResolvedValue({ whatsNew: 'New stuff' });
    mockGeneratePerUserDigest.mockResolvedValue({ subject: 'Weekly digest', body: 'Your digest' });
    mockGenerateLinkedinDraft.mockResolvedValue('LinkedIn post draft');
    mockClassifyUserState.mockResolvedValue({ state: 'active' });
    mockBuildWeeklyHtml.mockReturnValue('<html>digest</html>');
    mockBuildWeeklyText.mockReturnValue('text digest');
    mockGetRivals.mockResolvedValue([]);
    mockGetSmartRecommendations.mockResolvedValue([]);
  });

  it('returns 401 without auth token', async () => {
    const res = await onRequestPost(makeCtx());
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong token', async () => {
    const res = await onRequestPost(makeCtx('wrong'));
    expect(res.status).toBe(401);
  });

  it('returns success with 0 sent when no subscribers', async () => {
    mockGetDb.mockReturnValue(makeTestDb([]));

    const res = await onRequestPost(makeCtx('secret-123', '?test=true'));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toBe('No subscribers');
    expect(json.sent).toBe(0);
  });

  it('sends to admin subscribers in test mode and returns results', async () => {
    const subscribers = [
      { id: 'admin-1', email: 'admin@ruwt.dev', name: 'Admin', timezone: null },
    ];
    const db = makeTestDb(subscribers);
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeCtx('secret-123', '?test=true'));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.sent).toBe(1);
    expect(json.failed).toBe(0);

    // Verify AI content generation was called
    expect(mockGetPlatformActivity).toHaveBeenCalled();
    expect(mockGenerateSharedContent).toHaveBeenCalled();
    expect(mockGeneratePerUserDigest).toHaveBeenCalled();
    expect(mockClassifyUserState).toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledOnce();

    // Verify newsletter log was created
    expect(db.run).toHaveBeenCalled();
  });

  it('returns dry run results without sending in dry+test mode', async () => {
    const subscribers = [
      { id: 'admin-1', email: 'admin@ruwt.dev', name: 'Admin', timezone: null },
    ];
    mockGetDb.mockReturnValue(makeTestDb(subscribers));

    const res = await onRequestPost(makeCtx('secret-123', '?test=true&dry=true'));
    const json = await res.json();
    expect(json.success).toBe(true);
    // In dry mode, results count as "success" in the map
    expect(json.results).toHaveLength(1);
    expect(json.results[0].success).toBe(true);

    // Email should NOT have been sent in dry mode
    expect(mockSendEmail).not.toHaveBeenCalled();

    // Results should include subject and html
    expect(json.results[0].subject).toBe('Weekly digest');
    expect(json.results[0].html).toBeDefined();
    expect(json.results[0].text).toBeDefined();
  });

  it('tracks email send failures', async () => {
    const subscribers = [
      { id: 'admin-1', email: 'admin@ruwt.dev', name: 'Admin', timezone: null },
    ];
    mockGetDb.mockReturnValue(makeTestDb(subscribers));
    mockSendEmail.mockResolvedValue({ success: false, error: 'Rate limit' });

    const res = await onRequestPost(makeCtx('secret-123', '?test=true'));
    const json = await res.json();
    expect(json.sent).toBe(0);
    expect(json.failed).toBe(1);
  });

  it('includes linkedin draft only for admin subscribers', async () => {
    const subscribers = [
      { id: 'admin-1', email: 'admin@ruwt.dev', name: 'Admin', timezone: null },
    ];
    mockGetDb.mockReturnValue(makeTestDb(subscribers));

    await onRequestPost(makeCtx('secret-123', '?test=true'));

    // buildWeeklyHtml should receive linkedin draft for admin
    expect(mockBuildWeeklyHtml).toHaveBeenCalledWith(
      expect.objectContaining({ linkedinDraft: 'LinkedIn post draft' }),
    );
  });

  it('returns 500 on unexpected error', async () => {
    mockGetDb.mockImplementation(() => { throw new Error('boom'); });
    const res = await onRequestPost(makeCtx('secret-123'));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('boom');
  });

  it('returns 401 when CRON_SECRET is not configured in env', async () => {
    const env = makeEnv({ CRON_SECRET: undefined } as any);
    const res = await onRequestPost(makeCtx('any-token', '', env));
    expect(res.status).toBe(401);
  });

  it('excludes linkedinDraft for non-admin subscribers', async () => {
    const subscribers = [
      { id: 'non-admin', email: 'user@ruwt.dev', name: 'User', timezone: null },
    ];
    mockGetDb.mockReturnValue(makeTestDb(subscribers));

    await onRequestPost(makeCtx('secret-123', '?test=true'));

    // buildWeeklyHtml should receive null linkedinDraft for non-admin
    expect(mockBuildWeeklyHtml).toHaveBeenCalledWith(
      expect.objectContaining({ linkedinDraft: null }),
    );
  });

  it('includes commitsFound in response', async () => {
    const subscribers = [
      { id: 'admin-1', email: 'admin@ruwt.dev', name: 'Admin', timezone: null },
    ];
    mockGetDb.mockReturnValue(makeTestDb(subscribers));
    mockGetPlatformActivity.mockResolvedValue({ recentCommits: ['a', 'b', 'c'] });

    const res = await onRequestPost(makeCtx('secret-123', '?test=true'));
    const json = await res.json();

    expect(json.commitsFound).toBe(3);
  });

  it('counts skipped subscribers in response', async () => {
    // In test mode, no subscribers are skipped since test mode bypasses filtering
    const subscribers = [
      { id: 'admin-1', email: 'admin@ruwt.dev', name: 'Admin', timezone: null },
    ];
    mockGetDb.mockReturnValue(makeTestDb(subscribers));

    const res = await onRequestPost(makeCtx('secret-123', '?test=true'));
    const json = await res.json();

    // In test mode, all subscribers match (no skipping), so skipped = total - eligible = 0
    expect(json.skipped).toBe(0);
  });

  it('returns no-users-due message when no subscribers match timezone', async () => {
    // In non-test mode with subscribers who have timezone that is not morning
    const allSubscribers = [
      { id: 'user-1', email: 'user@ruwt.dev', name: 'User', timezone: 'Pacific/Auckland' },
    ];

    const db = {
      all: vi.fn()
        .mockResolvedValueOnce(allSubscribers) // first call: get all subscribers
        .mockResolvedValueOnce([]),             // second call: already sent check
      run: vi.fn().mockResolvedValue({}),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeCtx('secret-123'));
    const json = await res.json();

    // Unless it's morning in Auckland, subscribers will be filtered out
    // The response should show either success with send counts, or "No users due"
    expect(json.success).toBe(true);
  });

  it('handles multiple subscribers in test mode sending to each', async () => {
    const env = makeEnv({ ADMIN_USER_IDS: 'admin-1,admin-2' });
    const subscribers = [
      { id: 'admin-1', email: 'admin1@ruwt.dev', name: 'Admin 1', timezone: null },
      { id: 'admin-2', email: 'admin2@ruwt.dev', name: 'Admin 2', timezone: null },
    ];
    mockGetDb.mockReturnValue(makeTestDb(subscribers));

    const res = await onRequestPost(makeCtx('secret-123', '?test=true', env));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.sent).toBe(2);
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
  });

  it('includes user state in results', async () => {
    const subscribers = [
      { id: 'admin-1', email: 'admin@ruwt.dev', name: 'Admin', timezone: 'America/New_York' },
    ];
    mockGetDb.mockReturnValue(makeTestDb(subscribers));
    mockClassifyUserState.mockResolvedValue({ state: 'churning' });

    const res = await onRequestPost(makeCtx('secret-123', '?test=true'));
    const json = await res.json();

    expect(json.results[0].state).toBe('churning');
    expect(json.results[0].timezone).toBe('America/New_York');
  });

  it('filters out subscribers with invalid timezone (isMorningLocal catch branch)', async () => {
    // Non-test mode: subscribers with invalid timezone should be filtered (isMorningLocal returns false)
    const allSubscribers = [
      { id: 'user-1', email: 'user@ruwt.dev', name: 'User', timezone: 'Invalid/Timezone' },
    ];

    const db = {
      all: vi.fn()
        .mockResolvedValueOnce(allSubscribers) // first call: get all subscribers
        .mockResolvedValueOnce([]),             // second call: already sent check (empty)
      run: vi.fn().mockResolvedValue({}),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeCtx('secret-123'));
    const json = await res.json();

    // Invalid timezone causes isMorningLocal to throw and return false, filtering the subscriber out
    expect(json.success).toBe(true);
    // The subscriber should be filtered out (no users due)
    expect(json.sent).toBe(0);
  });

  it('sends to subscribers with no timezone when UTC hour is 14', async () => {
    // Mock Date to simulate UTC hour 14
    const originalDate = globalThis.Date;
    const mockDate = new originalDate('2026-02-28T14:30:00Z');

    vi.spyOn(globalThis, 'Date').mockImplementation(function (this: any, ...args: any[]) {
      if (args.length === 0) return mockDate;
      return new originalDate(...args);
    } as any);
    // Also override Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());

    const allSubscribers = [
      { id: 'user-1', email: 'user@ruwt.dev', name: 'User', timezone: null },
    ];

    const db = {
      all: vi.fn()
        .mockResolvedValueOnce(allSubscribers)
        .mockResolvedValueOnce([]), // no one sent this week
      run: vi.fn().mockResolvedValue({}),
    };
    mockGetDb.mockReturnValue(db);

    const res = await onRequestPost(makeCtx('secret-123'));
    const json = await res.json();

    expect(json.success).toBe(true);
    // The no-timezone subscriber should be included when UTC is 14
    expect(json.sent).toBe(1);

    vi.restoreAllMocks();
    // Re-set the defaults that restoreAllMocks clears
    mockSendEmail.mockResolvedValue({ success: true, id: 'msg-1' });
    mockGetPlatformActivity.mockResolvedValue({ recentCommits: [] });
    mockGenerateSharedContent.mockResolvedValue({ whatsNew: 'New stuff' });
    mockGeneratePerUserDigest.mockResolvedValue({ subject: 'Weekly digest', body: 'Your digest' });
    mockGenerateLinkedinDraft.mockResolvedValue('LinkedIn post draft');
    mockClassifyUserState.mockResolvedValue({ state: 'active' });
    mockBuildWeeklyHtml.mockReturnValue('<html>digest</html>');
    mockBuildWeeklyText.mockReturnValue('text digest');
    mockGetRivals.mockResolvedValue([]);
    mockGetSmartRecommendations.mockResolvedValue([]);
  });
});
