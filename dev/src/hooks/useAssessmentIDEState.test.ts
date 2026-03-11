// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { mockAuthGuard, mockRoute } = vi.hoisted(() => {
  const mockAuthGuard = { current: { user: { id: 'u1' } as any, loading: false } };
  const mockRoute = { params: {} as any };
  return { mockAuthGuard, mockRoute };
});

vi.mock('@react-navigation/native', () => ({
  useRoute: () => mockRoute,
}));

vi.mock('@/hooks/useAuthGuard', () => ({
  useAuthGuard: () => mockAuthGuard.current,
}));

const ok = (data: any) => ({ ok: true, json: () => Promise.resolve(data) });
const fail = (data: any) => ({ ok: false, json: () => Promise.resolve(data) });

function setupFetch(map: Record<string, any> = {}) {
  const entries = Object.entries(map).sort(([a], [b]) => b.length - a.length);
  const fn = vi.fn().mockImplementation((url: string) => {
    for (const [pattern, response] of entries) {
      if (url.includes(pattern)) return Promise.resolve(response);
    }
    return Promise.resolve(ok([]));
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

setupFetch();
const { useAssessmentIDEState } = await import('./useAssessmentIDEState');

const CHALLENGES = [
  { id: 'ch1', title: 'String Formatter', difficulty: 'easy', category: 'model_selection', skillTested: 'Strings' },
  { id: 'ch2', title: 'Event Emitter', difficulty: 'medium', category: 'prompt_efficiency', skillTested: 'Events' },
];

describe('useAssessmentIDEState', () => {
  let fetchFn: ReturnType<typeof setupFetch>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRoute.params = {};
    mockAuthGuard.current = { user: { id: 'u1' } as any, loading: false };
    fetchFn = setupFetch({ '/api/challenges': ok(CHALLENGES) });
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('returns loading true initially', () => {
    const { result } = renderHook(() => useAssessmentIDEState());
    expect(result.current.loading).toBe(true);
  });

  it('returns null user when not authenticated', () => {
    mockAuthGuard.current = { user: null, loading: false };
    const { result } = renderHook(() => useAssessmentIDEState());
    expect(result.current.user).toBeNull();
  });

  it('loads user and challenges', async () => {
    const { result } = renderHook(() => useAssessmentIDEState());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toEqual({ id: 'u1' });
    expect(result.current.allChallenges).toEqual(CHALLENGES);
  });

  it('sets loadError when challenges fetch fails', async () => {
    fetchFn = setupFetch({ '/api/challenges': { ok: false } });
    const { result } = renderHook(() => useAssessmentIDEState());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toBe('Failed to load challenges. Try refreshing the page.');
  });

  it('loads org and custom challenges when orgs API returns data', async () => {
    fetchFn = setupFetch({
      '/api/challenges': ok(CHALLENGES),
      '/api/orgs': ok([{ orgId: 'org1' }]),
      '/api/orgs/org1/challenges': ok([{ id: 'cc1', title: 'Custom', status: 'active' }]),
    });
    const { result } = renderHook(() => useAssessmentIDEState());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.orgId).toBe('org1');
    expect(result.current.customChallenges).toEqual([{ id: 'cc1', title: 'Custom', status: 'active' }]);
  });

  it('loads existing assessment data when assessmentId is in route params', async () => {
    mockRoute.params = { assessmentId: 'a1' };
    fetchFn = setupFetch({
      '/api/challenges': ok(CHALLENGES),
      '/api/assessments/a1': ok({
        title: 'My Assessment',
        description: 'A test',
        timeLimit: 5400,
        status: 'active',
        challenges: [{ id: 'ch1', sortOrder: 0 }, { id: 'ch2', sortOrder: 1 }],
        companyName: 'Acme',
        companyLogoUrl: 'https://logo.png',
        welcomeMessage: 'Hello!',
        categoryWeights: JSON.stringify({ modelSelection: 30, promptEfficiency: 25, debugging: 15, strategy: 15, speed: 15 }),
        passThreshold: JSON.stringify({ enabled: true, mode: 'all_dimensions', dimensions: {} }),
      }),
    });
    const { result } = renderHook(() => useAssessmentIDEState());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.title).toBe('My Assessment');
    expect(result.current.description).toBe('A test');
    expect(result.current.timeLimitMinutes).toBe('90');
    expect(result.current.status).toBe('active');
    expect(result.current.selectedChallengeIds).toEqual(['ch1', 'ch2']);
    expect(result.current.companyName).toBe('Acme');
    expect(result.current.companyLogoUrl).toBe('https://logo.png');
    expect(result.current.welcomeMessage).toBe('Hello!');
    expect(result.current.weights.modelSelection).toBe('30');
    expect(result.current.passThreshold).toEqual({ enabled: true, mode: 'all_dimensions', dimensions: {} });
    expect(result.current.isEditing).toBe(true);
  });

  it('isEditing is false when no assessmentId param', async () => {
    const { result } = renderHook(() => useAssessmentIDEState());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isEditing).toBe(false);
  });

  it('computes weightSum correctly', async () => {
    const { result } = renderHook(() => useAssessmentIDEState());
    await waitFor(() => expect(result.current.loading).toBe(false));
    // Default weights: 20+20+20+20+20 = 100
    expect(result.current.weightSum).toBe(100);
  });

  it('weightSum is NaN when a weight is non-numeric', async () => {
    const { result } = renderHook(() => useAssessmentIDEState());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.setWeights((prev) => ({ ...prev, modelSelection: 'abc' }));
    });
    expect(result.current.weightSum).toBeNaN();
  });

  describe('toggleChallenge', () => {
    it('adds challenge id to selection', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => { result.current.toggleChallenge('ch1'); });
      expect(result.current.selectedChallengeIds).toContain('ch1');
    });

    it('removes challenge id from selection', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => { result.current.toggleChallenge('ch1'); });
      expect(result.current.selectedChallengeIds).toContain('ch1');
      act(() => { result.current.toggleChallenge('ch1'); });
      expect(result.current.selectedChallengeIds).not.toContain('ch1');
    });
  });

  describe('applyTemplate', () => {
    it('sets title, description, time limit and matches challenge IDs', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => {
        result.current.applyTemplate({
          id: 'frontend-dev',
          name: 'Frontend Developer',
          description: 'Tests frontend skills',
          timeLimitMinutes: 60,
          challengeTitles: ['String Formatter', 'Event Emitter'],
          categories: ['model_selection'],
        });
      });
      expect(result.current.title).toBe('Frontend Developer Assessment');
      expect(result.current.description).toBe('Tests frontend skills');
      expect(result.current.timeLimitMinutes).toBe('60');
      expect(result.current.selectedChallengeIds).toEqual(['ch1', 'ch2']);
    });

    it('only matches existing challenge titles', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => {
        result.current.applyTemplate({
          id: 'test',
          name: 'Test',
          description: 'Desc',
          timeLimitMinutes: 30,
          challengeTitles: ['Nonexistent Challenge'],
          categories: [],
        });
      });
      expect(result.current.selectedChallengeIds).toEqual([]);
    });
  });

  describe('dirty tracking', () => {
    it('starts not dirty', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.dirty).toBe(false);
    });

    it('marks dirty after title change (after initial load done)', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      // Wait for setTimeout(() => { initialLoadDone.current = true; }, 0) to fire
      await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
      act(() => { result.current.setTitle('New Title'); });
      expect(result.current.dirty).toBe(true);
    });
  });

  describe('handleSave', () => {
    it('creates a new assessment when no assessmentId exists', async () => {
      fetchFn = setupFetch({
        '/api/challenges': ok(CHALLENGES),
        '/api/assessments': ok({ id: 'new-a1' }),
      });
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => { result.current.setTitle('New Assessment'); });
      await act(async () => { await result.current.handleSave(); });
      expect(result.current.assessmentId).toBe('new-a1');
      expect(result.current.saving).toBe(false);
      expect(result.current.saveSuccess).toBe(true);
      expect(result.current.dirty).toBe(false);
    });

    it('updates existing assessment when assessmentId exists', async () => {
      mockRoute.params = { assessmentId: 'a1' };
      fetchFn = setupFetch({
        '/api/challenges': ok(CHALLENGES),
        '/api/assessments/a1': ok({ title: 'T', timeLimit: 3600, challenges: [] }),
        '/api/assessments/a1/challenges': ok({}),
      });
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => { result.current.setTitle('Updated'); });
      await act(async () => { await result.current.handleSave(); });
      expect(result.current.saving).toBe(false);
      expect(result.current.saveSuccess).toBe(true);
      // Check PUT was called for the assessment
      const putCalls = fetchFn.mock.calls.filter(
        (call: any[]) => call[0]?.includes('/api/assessments/a1') && call[1]?.method === 'PUT'
      );
      expect(putCalls.length).toBeGreaterThan(0);
    });

    it('sets saveError on failure', async () => {
      fetchFn = setupFetch({
        '/api/challenges': ok(CHALLENGES),
        '/api/assessments': fail({ error: 'Nope' }),
      });
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => { result.current.setTitle('Test'); });
      await act(async () => { await result.current.handleSave(); });
      expect(result.current.saveError).toBeTruthy();
    });
  });

  describe('handleActivate', () => {
    it('returns early without assessmentId', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => { await result.current.handleActivate(); });
      expect(fetchFn.mock.calls.filter((call: any[]) => call[1]?.body?.includes('"active"')).length).toBe(0);
    });

    it('sets error when title is empty', async () => {
      mockRoute.params = { assessmentId: 'a1' };
      fetchFn = setupFetch({
        '/api/challenges': ok(CHALLENGES),
        '/api/assessments/a1': ok({ title: '', timeLimit: 3600, challenges: [] }),
      });
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => { result.current.setTitle(''); });
      await act(async () => { await result.current.handleActivate(); });
      expect(result.current.activateError).toBe('Enter a title before activating.');
    });

    it('sets error when no challenges selected', async () => {
      mockRoute.params = { assessmentId: 'a1' };
      fetchFn = setupFetch({
        '/api/challenges': ok(CHALLENGES),
        '/api/assessments/a1': ok({ title: 'T', timeLimit: 3600, challenges: [] }),
      });
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => { result.current.setTitle('My Assessment'); });
      await act(async () => { await result.current.handleActivate(); });
      expect(result.current.activateError).toBe('Select at least one challenge before activating.');
    });

    it('activates successfully', async () => {
      mockRoute.params = { assessmentId: 'a1' };
      fetchFn = setupFetch({
        '/api/challenges': ok(CHALLENGES),
        '/api/assessments/a1': ok({ title: 'T', timeLimit: 3600, challenges: [{ id: 'ch1', sortOrder: 0 }] }),
      });
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => { await result.current.handleActivate(); });
      expect(result.current.status).toBe('active');
    });

    it('sets activateError on failure', async () => {
      mockRoute.params = { assessmentId: 'a1' };
      fetchFn = setupFetch({
        '/api/challenges': ok(CHALLENGES),
        '/api/assessments/a1': ok({ title: 'T', timeLimit: 3600, challenges: [{ id: 'ch1', sortOrder: 0 }] }),
      });
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      // Override to fail on PUT with status: active
      fetchFn.mockImplementation((_url: string, opts: any) => {
        if (opts?.method === 'PUT' && opts?.body?.includes('"active"')) {
          return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
        }
        return Promise.resolve(ok([]));
      });
      await act(async () => { await result.current.handleActivate(); });
      expect(result.current.activateError).toBeTruthy();
    });
  });

  describe('handleGenerateInvite', () => {
    it('returns early without assessmentId', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => { await result.current.handleGenerateInvite(); });
      expect(result.current.inviteLink).toBeNull();
    });

    it('generates invite link successfully', async () => {
      mockRoute.params = { assessmentId: 'a1' };
      fetchFn = setupFetch({
        '/api/challenges': ok(CHALLENGES),
        '/api/assessments/a1': ok({ title: 'T', timeLimit: 3600, challenges: [] }),
        '/api/assessments/a1/invites': ok({ url: 'https://ruwt.dev/invite/abc' }),
      });
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => { await result.current.handleGenerateInvite(); });
      expect(result.current.inviteLink).toBe('https://ruwt.dev/invite/abc');
      expect(result.current.generatingInvite).toBe(false);
    });

    it('sets inviteError on failure', async () => {
      mockRoute.params = { assessmentId: 'a1' };
      fetchFn = setupFetch({
        '/api/challenges': ok(CHALLENGES),
        '/api/assessments/a1': ok({ title: 'T', timeLimit: 3600, challenges: [] }),
        '/api/assessments/a1/invites': fail({ error: 'Limit reached' }),
      });
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => { await result.current.handleGenerateInvite(); });
      expect(result.current.inviteError).toBe('Limit reached');
    });

    it('sets network error on fetch throw', async () => {
      mockRoute.params = { assessmentId: 'a1' };
      fetchFn = setupFetch({
        '/api/challenges': ok(CHALLENGES),
        '/api/assessments/a1': ok({ title: 'T', timeLimit: 3600, challenges: [] }),
      });
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      fetchFn.mockImplementation((_url: string, opts: any) => {
        if (opts?.method === 'POST' && _url.includes('/invites')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(ok([]));
      });
      await act(async () => { await result.current.handleGenerateInvite(); });
      expect(result.current.inviteError).toBe('Network error \u2014 please try again');
    });
  });

  describe('copyInviteLink', () => {
    it('copies invite link to clipboard', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { clipboard: { writeText } });
      mockRoute.params = { assessmentId: 'a1' };
      fetchFn = setupFetch({
        '/api/challenges': ok(CHALLENGES),
        '/api/assessments/a1': ok({ title: 'T', timeLimit: 3600, challenges: [] }),
        '/api/assessments/a1/invites': ok({ url: 'https://ruwt.dev/invite/abc' }),
      });
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => { await result.current.handleGenerateInvite(); });
      await act(async () => { await result.current.copyInviteLink(); });
      expect(writeText).toHaveBeenCalledWith('https://ruwt.dev/invite/abc');
      expect(result.current.copied).toBe(true);
    });

    it('does nothing when no invite link', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => { await result.current.copyInviteLink(); });
      expect(result.current.copied).toBe(false);
    });
  });

  describe('agent callbacks', () => {
    it('handleAgentChallengesChanged re-fetches challenge selection', async () => {
      mockRoute.params = { assessmentId: 'a1' };
      fetchFn = setupFetch({
        '/api/challenges': ok(CHALLENGES),
        '/api/assessments/a1': ok({
          title: 'T', timeLimit: 3600,
          challenges: [{ id: 'ch1', sortOrder: 0 }],
        }),
      });
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.selectedChallengeIds).toEqual(['ch1']);

      // Update fetch to return new challenges
      fetchFn.mockImplementation((url: string) => {
        if (url.includes('/api/assessments/a1')) {
          return Promise.resolve(ok({
            title: 'T', timeLimit: 3600,
            challenges: [{ id: 'ch1', sortOrder: 0 }, { id: 'ch2', sortOrder: 1 }],
          }));
        }
        return Promise.resolve(ok([]));
      });
      await act(async () => { await result.current.handleAgentChallengesChanged(); });
      expect(result.current.selectedChallengeIds).toEqual(['ch1', 'ch2']);
    });

    it('handleAgentWeightsChanged sets weights from record', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => {
        result.current.handleAgentWeightsChanged({
          modelSelection: 30,
          promptEfficiency: 25,
          debugging: 15,
          strategy: 15,
          speed: 15,
        });
      });
      expect(result.current.weights.modelSelection).toBe('30');
      expect(result.current.weights.promptEfficiency).toBe('25');
    });

    it('handleAgentWeightsChanged defaults missing keys to 20', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => {
        result.current.handleAgentWeightsChanged({ modelSelection: 50 });
      });
      expect(result.current.weights.modelSelection).toBe('50');
      expect(result.current.weights.debugging).toBe('20');
    });

    it('handleAgentBrandingChanged sets branding fields', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => {
        result.current.handleAgentBrandingChanged({
          title: 'New Title',
          companyName: 'Acme',
          welcomeMessage: 'Hi',
        });
      });
      expect(result.current.title).toBe('New Title');
      expect(result.current.companyName).toBe('Acme');
      expect(result.current.welcomeMessage).toBe('Hi');
    });

    it('handleAgentBrandingChanged only sets provided fields', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => { result.current.setTitle('Original'); });
      act(() => {
        result.current.handleAgentBrandingChanged({ companyName: 'Test Corp' });
      });
      expect(result.current.title).toBe('Original');
      expect(result.current.companyName).toBe('Test Corp');
    });

    it('handleAgentTimeLimitChanged sets time limit', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => { result.current.handleAgentTimeLimitChanged(90); });
      expect(result.current.timeLimitMinutes).toBe('90');
    });

    it('handleAgentThresholdChanged sets pass threshold', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      const threshold = { enabled: true, mode: 'all_dimensions' as const, dimensions: { debugging: 50 } };
      act(() => { result.current.handleAgentThresholdChanged(threshold); });
      expect(result.current.passThreshold).toEqual(threshold);
    });

    it('handleCustomChallengeCreated re-fetches custom challenges', async () => {
      fetchFn = setupFetch({
        '/api/challenges': ok(CHALLENGES),
        '/api/orgs': ok([{ orgId: 'org1' }]),
        '/api/orgs/org1/challenges': ok([{ id: 'cc1', title: 'Old Custom', status: 'active' }]),
      });
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.orgId).toBe('org1');

      // Update to return new custom challenge list
      fetchFn.mockImplementation((url: string) => {
        if (url.includes('/api/orgs/org1/challenges')) {
          return Promise.resolve(ok([
            { id: 'cc1', title: 'Old Custom', status: 'active' },
            { id: 'cc2', title: 'New Custom', status: 'draft' },
          ]));
        }
        return Promise.resolve(ok([]));
      });
      await act(async () => { await result.current.handleCustomChallengeCreated(); });
      expect(result.current.customChallenges).toHaveLength(2);
    });

    it('handleCustomChallengeCreated does nothing without orgId', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.orgId).toBeNull();
      const callsBefore = fetchFn.mock.calls.length;
      await act(async () => { await result.current.handleCustomChallengeCreated(); });
      // No additional fetch
      expect(fetchFn.mock.calls.length).toBe(callsBefore);
    });

    it('handleAgentAssessmentCreated sets assessmentId', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => { result.current.handleAgentAssessmentCreated('new-id'); });
      expect(result.current.assessmentId).toBe('new-id');
    });

    it('handleApproveCustomChallenge updates status to active', async () => {
      fetchFn = setupFetch({
        '/api/challenges': ok(CHALLENGES),
        '/api/orgs': ok([{ orgId: 'org1' }]),
        '/api/orgs/org1/challenges': ok([{ id: 'cc1', title: 'Draft Challenge', status: 'draft' }]),
      });
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => { result.current.handleApproveCustomChallenge('cc1'); });
      expect(result.current.customChallenges[0].status).toBe('active');
    });

    it('handleDeleteCustomChallenge removes from list', async () => {
      fetchFn = setupFetch({
        '/api/challenges': ok(CHALLENGES),
        '/api/orgs': ok([{ orgId: 'org1' }]),
        '/api/orgs/org1/challenges': ok([
          { id: 'cc1', title: 'A', status: 'draft' },
          { id: 'cc2', title: 'B', status: 'draft' },
        ]),
      });
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => { result.current.handleDeleteCustomChallenge('cc1'); });
      expect(result.current.customChallenges).toHaveLength(1);
      expect(result.current.customChallenges[0].id).toBe('cc2');
    });

    it('handleInvitesSent increments inviteRefreshKey', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      const before = result.current.inviteRefreshKey;
      act(() => { result.current.handleInvitesSent(); });
      expect(result.current.inviteRefreshKey).toBe(before + 1);
    });
  });

  describe('setters', () => {
    it('setTitle updates title', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => { result.current.setTitle('Hello'); });
      expect(result.current.title).toBe('Hello');
    });

    it('setDescription updates description', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => { result.current.setDescription('Desc'); });
      expect(result.current.description).toBe('Desc');
    });

    it('setTimeLimitMinutes updates time limit', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => { result.current.setTimeLimitMinutes('120'); });
      expect(result.current.timeLimitMinutes).toBe('120');
    });

    it('setCompanyName updates branding', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => { result.current.setCompanyName('TestCo'); });
      expect(result.current.companyName).toBe('TestCo');
    });

    it('setCompanyLogoUrl updates branding', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => { result.current.setCompanyLogoUrl('https://logo.png'); });
      expect(result.current.companyLogoUrl).toBe('https://logo.png');
    });

    it('setWelcomeMessage updates branding', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => { result.current.setWelcomeMessage('Welcome!'); });
      expect(result.current.welcomeMessage).toBe('Welcome!');
    });

    it('setPassThreshold updates threshold', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => {
        result.current.setPassThreshold({ enabled: true, mode: 'weighted_average', minOverall: 70, dimensions: {} });
      });
      expect(result.current.passThreshold?.mode).toBe('weighted_average');
    });

    it('setConfirmActivate toggles confirm state', async () => {
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.confirmActivate).toBe(false);
      act(() => { result.current.setConfirmActivate(true); });
      expect(result.current.confirmActivate).toBe(true);
    });
  });

  describe('save with challenge ids', () => {
    it('sends challengeIds to the challenges endpoint', async () => {
      fetchFn = setupFetch({
        '/api/challenges': ok(CHALLENGES),
        '/api/assessments': ok({ id: 'new-a1' }),
        '/api/assessments/new-a1/challenges': ok({}),
        '/api/assessments/new-a1': ok({}),
      });
      const { result } = renderHook(() => useAssessmentIDEState());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => {
        result.current.setTitle('Test');
        result.current.toggleChallenge('ch1');
        result.current.toggleChallenge('ch2');
      });
      await act(async () => { await result.current.handleSave(); });
      const challengePut = fetchFn.mock.calls.find(
        (call: any[]) => call[0]?.includes('/challenges') && call[1]?.method === 'PUT'
      );
      expect(challengePut).toBeTruthy();
      const body = JSON.parse(challengePut![1].body);
      expect(body.challengeIds).toEqual(['ch1', 'ch2']);
    });
  });
});
