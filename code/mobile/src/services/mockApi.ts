import {
  MOCK_RUNNERS,
  MOCK_BLOCKED_RESPONSE,
  MOCK_APPROVED_RESPONSE,
  MOCK_ERROR_RESPONSE,
  MOCK_RESPOND_RESPONSE,
  MOCK_RESPOND_ERROR_RESPONSE,
  MOCK_REPORT_SUCCESS,
} from '@ruwt/shared';

/**
 * Check if mock mode is enabled
 */
export function useMockMode(): boolean {
  return process.env.EXPO_PUBLIC_MOCK_MODE === 'true';
}

/**
 * Mock fetch interceptor
 * Returns mock responses when mock mode is enabled, otherwise falls back to real fetch
 */
export async function mockFetch(url: string, options: RequestInit): Promise<Response> {
  const isMockMode = useMockMode();

  if (!isMockMode) {
    return fetch(url, options);
  }

  // 1. CHECK SPECIFIC CHAT ENDPOINT FIRST
  if (url.includes('/runners/respond/chat')) {
    const body = options.body ? JSON.parse(options.body as string) : {};
    const message = body.message || '';

    if (message.toLowerCase().includes('error')) {
      return new Response(JSON.stringify(MOCK_RESPOND_ERROR_RESPONSE), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(MOCK_RESPOND_RESPONSE), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (url.includes('/runners/rewrite/chat')) {
    const body = options.body ? JSON.parse(options.body as string) : {};
    const message = body.message || '';

    if (message.toLowerCase().includes('error')) {
      return new Response(JSON.stringify({ error: 'Failed to send message' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (message.toLowerCase().includes('love') || message.toLowerCase().includes('kind')) {
      return new Response(JSON.stringify(MOCK_APPROVED_RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(MOCK_BLOCKED_RESPONSE), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. CHECK REPORT ENDPOINT
  if (url.includes('/report')) {
    return new Response(JSON.stringify(MOCK_REPORT_SUCCESS), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. CHECK GENERAL RUNNERS LIST LAST (Least specific)
  if (url.includes('/runners')) {
    return new Response(JSON.stringify(MOCK_RUNNERS), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return fetch(url, options);
}


