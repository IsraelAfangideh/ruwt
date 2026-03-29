import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreateSupabaseFromRequest } = vi.hoisted(() => ({
  mockCreateSupabaseFromRequest: vi.fn(),
}));

vi.mock('./supabase', () => ({
  createSupabaseFromRequest: mockCreateSupabaseFromRequest,
}));

// Import after mocking so the module picks up the mock
import { getUser } from './auth';

const ENV = {
  VITE_SUPABASE_URL: 'https://test.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'test-anon-key',
};

function makeSupabaseClient(getUserResult: { data: { user: any }; error: any }) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(getUserResult),
    },
  };
}

function makeRequest(url = 'https://ruwt.dev/api/test'): Request {
  return new Request(url);
}

describe('getUser', () => {
  beforeEach(() => {
    mockCreateSupabaseFromRequest.mockReset();
    // The WeakMap uses object identity, so new Request objects in each test
    // naturally avoid cache hits from previous tests.
  });

  it('returns the user object on successful auth', async () => {
    const fakeUser = { id: 'user-1', email: 'test@example.com' };
    const client = makeSupabaseClient({ data: { user: fakeUser }, error: null });
    mockCreateSupabaseFromRequest.mockReturnValue(client);

    const user = await getUser(makeRequest(), ENV);

    expect(user).toBe(fakeUser);
    expect(mockCreateSupabaseFromRequest).toHaveBeenCalledOnce();
  });

  it('returns null when Supabase returns an error', async () => {
    const client = makeSupabaseClient({
      data: { user: null },
      error: { message: 'JWT expired' },
    });
    mockCreateSupabaseFromRequest.mockReturnValue(client);

    const user = await getUser(makeRequest(), ENV);

    expect(user).toBeNull();
  });

  it('returns null when user is null (no session)', async () => {
    const client = makeSupabaseClient({
      data: { user: null },
      error: null,
    });
    mockCreateSupabaseFromRequest.mockReturnValue(client);

    const user = await getUser(makeRequest(), ENV);

    expect(user).toBeNull();
  });

  it('caches the result per request — does not call Supabase twice for the same request', async () => {
    const fakeUser = { id: 'user-cached', email: 'cached@example.com' };
    const client = makeSupabaseClient({ data: { user: fakeUser }, error: null });
    mockCreateSupabaseFromRequest.mockReturnValue(client);

    // Use the SAME request object for both calls
    const request = makeRequest();

    const first = await getUser(request, ENV);
    const second = await getUser(request, ENV);

    expect(first).toBe(fakeUser);
    expect(second).toBe(fakeUser);
    // createSupabaseFromRequest should only have been called once
    expect(mockCreateSupabaseFromRequest).toHaveBeenCalledOnce();
  });

  it('caches null results too — does not retry failed auth for the same request', async () => {
    const client = makeSupabaseClient({
      data: { user: null },
      error: { message: 'Invalid token' },
    });
    mockCreateSupabaseFromRequest.mockReturnValue(client);

    const request = makeRequest();

    const first = await getUser(request, ENV);
    const second = await getUser(request, ENV);

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(mockCreateSupabaseFromRequest).toHaveBeenCalledOnce();
  });

  it('different request objects get separate auth checks', async () => {
    const user1 = { id: 'user-1', email: 'a@example.com' };
    const user2 = { id: 'user-2', email: 'b@example.com' };

    const client1 = makeSupabaseClient({ data: { user: user1 }, error: null });
    const client2 = makeSupabaseClient({ data: { user: user2 }, error: null });

    mockCreateSupabaseFromRequest
      .mockReturnValueOnce(client1)
      .mockReturnValueOnce(client2);

    const req1 = makeRequest('https://ruwt.dev/api/a');
    const req2 = makeRequest('https://ruwt.dev/api/b');

    const result1 = await getUser(req1, ENV);
    const result2 = await getUser(req2, ENV);

    expect(result1).toBe(user1);
    expect(result2).toBe(user2);
    expect(mockCreateSupabaseFromRequest).toHaveBeenCalledTimes(2);
  });

  it('passes the request and env to createSupabaseFromRequest', async () => {
    const client = makeSupabaseClient({ data: { user: null }, error: null });
    mockCreateSupabaseFromRequest.mockReturnValue(client);

    const request = makeRequest();
    await getUser(request, ENV);

    expect(mockCreateSupabaseFromRequest).toHaveBeenCalledWith(request, ENV);
  });
});
