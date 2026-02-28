import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreateServerClient } = vi.hoisted(() => ({
  mockCreateServerClient: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: mockCreateServerClient,
}));

import { createSupabaseFromRequest } from './supabase';

const ENV = {
  VITE_SUPABASE_URL: 'https://test.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'test-anon-key-123',
};

function makeRequest(cookieHeader?: string): Request {
  const headers = new Headers();
  if (cookieHeader !== undefined) {
    headers.set('Cookie', cookieHeader);
  }
  return new Request('https://ruwt.dev/api/test', { headers });
}

describe('createSupabaseFromRequest', () => {
  beforeEach(() => {
    mockCreateServerClient.mockReset();
    mockCreateServerClient.mockReturnValue({ auth: { getUser: vi.fn() } });
  });

  it('calls createServerClient with the correct URL and key', () => {
    createSupabaseFromRequest(makeRequest(), ENV);

    expect(mockCreateServerClient).toHaveBeenCalledOnce();
    expect(mockCreateServerClient.mock.calls[0][0]).toBe(ENV.VITE_SUPABASE_URL);
    expect(mockCreateServerClient.mock.calls[0][1]).toBe(ENV.VITE_SUPABASE_ANON_KEY);
  });

  it('returns the client created by createServerClient', () => {
    const fakeClient = { auth: { getUser: vi.fn() } };
    mockCreateServerClient.mockReturnValue(fakeClient);

    const result = createSupabaseFromRequest(makeRequest(), ENV);
    expect(result).toBe(fakeClient);
  });

  describe('cookie adapter — getAll', () => {
    function getCookieAdapter(cookieHeader?: string) {
      createSupabaseFromRequest(makeRequest(cookieHeader), ENV);
      // The third argument is the options object with cookies adapter
      const options = mockCreateServerClient.mock.calls[0][2];
      return options.cookies;
    }

    it('returns empty array when no Cookie header is present', () => {
      const adapter = getCookieAdapter(undefined);
      expect(adapter.getAll()).toEqual([]);
    });

    it('parses a single cookie correctly', () => {
      const adapter = getCookieAdapter('session=abc123');
      expect(adapter.getAll()).toEqual([
        { name: 'session', value: 'abc123' },
      ]);
    });

    it('parses multiple cookies separated by semicolons', () => {
      const adapter = getCookieAdapter('session=abc123; theme=dark; lang=en');
      expect(adapter.getAll()).toEqual([
        { name: 'session', value: 'abc123' },
        { name: 'theme', value: 'dark' },
        { name: 'lang', value: 'en' },
      ]);
    });

    it('handles cookies with equals signs in the value (e.g., base64)', () => {
      const adapter = getCookieAdapter('token=eyJhbGciOi==; other=val');
      expect(adapter.getAll()).toEqual([
        { name: 'token', value: 'eyJhbGciOi==' },
        { name: 'other', value: 'val' },
      ]);
    });

    it('filters out entries with empty names', () => {
      // Leading semicolons or double semicolons can create empty name entries
      const adapter = getCookieAdapter('; valid=yes; =empty-name');
      const cookies = adapter.getAll();
      // Every returned cookie must have a non-empty name
      for (const cookie of cookies) {
        expect(cookie.name).not.toBe('');
      }
      expect(cookies).toContainEqual({ name: 'valid', value: 'yes' });
    });

    it('trims whitespace from cookie names and values', () => {
      const adapter = getCookieAdapter('  spaced  =  value  ');
      expect(adapter.getAll()).toEqual([
        { name: 'spaced', value: 'value' },
      ]);
    });
  });

  describe('cookie adapter — setAll', () => {
    it('exists and does not throw when called', () => {
      createSupabaseFromRequest(makeRequest('session=abc'), ENV);
      const options = mockCreateServerClient.mock.calls[0][2];

      // setAll is a no-op in Cloudflare Workers — just verify it doesn't throw
      expect(() => options.cookies.setAll()).not.toThrow();
      expect(() => options.cookies.setAll([{ name: 'x', value: 'y' }])).not.toThrow();
    });
  });
});
