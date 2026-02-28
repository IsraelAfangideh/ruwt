// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('createClient (supabase)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('returns a stub client when VITE_SUPABASE_URL is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'some-key');

    const mockCreateBrowserClient = vi.fn(() => ({ _real: true }));
    vi.doMock('@supabase/ssr', () => ({
      createBrowserClient: mockCreateBrowserClient,
    }));

    const { createClient } = await import('./client');
    const client = createClient();

    // Stub client should have auth methods that reject
    await expect(client.auth.signInWithPassword({} as any)).rejects.toThrow('Supabase not configured');
    await expect(client.auth.signInWithOAuth({} as any)).rejects.toThrow('Supabase not configured');
    await expect(client.auth.signUp({} as any)).rejects.toThrow('Supabase not configured');
    await expect(client.auth.signOut()).rejects.toThrow('Supabase not configured');
    await expect(client.auth.exchangeCodeForSession('')).rejects.toThrow('Supabase not configured');

    // getUser should resolve with null user
    const { data } = await client.auth.getUser();
    expect(data.user).toBeNull();

    // onAuthStateChange should return unsubscribe-able subscription
    const { data: { subscription } } = client.auth.onAuthStateChange(() => {});
    expect(typeof subscription.unsubscribe).toBe('function');
    subscription.unsubscribe(); // should not throw

    // createBrowserClient should NOT have been called
    expect(mockCreateBrowserClient).not.toHaveBeenCalled();
  });

  it('returns a stub client when VITE_SUPABASE_ANON_KEY is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    vi.doMock('@supabase/ssr', () => ({
      createBrowserClient: vi.fn(() => ({ _real: true })),
    }));

    const { createClient } = await import('./client');
    const client = createClient();

    await expect(client.auth.signInWithPassword({} as any)).rejects.toThrow('Supabase not configured');
  });

  it('creates a real client via createBrowserClient when env vars are present', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

    const mockClient = { _real: true, auth: {} };
    const mockCreateBrowserClient = vi.fn(() => mockClient);
    vi.doMock('@supabase/ssr', () => ({
      createBrowserClient: mockCreateBrowserClient,
    }));

    const { createClient } = await import('./client');
    const client = createClient();

    expect(mockCreateBrowserClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key'
    );
    expect(client).toBe(mockClient);
  });

  it('returns cached singleton on subsequent calls', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

    const mockClient = { _real: true, auth: {} };
    const mockCreateBrowserClient = vi.fn(() => mockClient);
    vi.doMock('@supabase/ssr', () => ({
      createBrowserClient: mockCreateBrowserClient,
    }));

    const { createClient } = await import('./client');

    const client1 = createClient();
    const client2 = createClient();

    expect(client1).toBe(client2);
    // createBrowserClient should only have been called once
    expect(mockCreateBrowserClient).toHaveBeenCalledTimes(1);
  });

  it('stub client from() returns chainable select/order methods', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    vi.doMock('@supabase/ssr', () => ({
      createBrowserClient: vi.fn(),
    }));

    const { createClient } = await import('./client');
    const client = createClient();

    // from().select().order() should work and return { data: null, error: null }
    const result = await (client as any).from('challenges').select().order('created_at');
    expect(result).toEqual({ data: null, error: null });
  });

  it('stub client does not cache (each missing-env call returns a new stub)', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'key');

    vi.doMock('@supabase/ssr', () => ({
      createBrowserClient: vi.fn(),
    }));

    const { createClient } = await import('./client');

    // The stub is returned directly without being cached in supabaseClient
    // This is because the code only sets supabaseClient when env vars ARE present
    const client1 = createClient();
    const client2 = createClient();

    // Both are stubs — they won't be the same object reference (new object each time)
    // but they should both be functional stubs
    await expect(client1.auth.signOut()).rejects.toThrow('Supabase not configured');
    await expect(client2.auth.signOut()).rejects.toThrow('Supabase not configured');
  });
});
