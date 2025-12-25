import {
  MOCK_RUNNERS,
  MOCK_BLOCKED_RESPONSE,
  MOCK_APPROVED_RESPONSE,
  MOCK_ERROR_RESPONSE,
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
    // Not in mock mode, use real fetch
    return fetch(url, options);
  }

  // Mock mode is enabled - return mock responses
  if (url.includes('/runners')) {
    // GET /runners - return mock runners list
    return new Response(JSON.stringify(MOCK_RUNNERS), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (url.includes('/runners/rewrite/chat')) {
    // POST /runners/rewrite/chat - return mock chat response
    // For testing, we'll alternate between blocked and approved responses
    // based on message content to test different scenarios
    const body = options.body ? JSON.parse(options.body as string) : {};
    const message = body.message || '';

    // If message contains certain keywords, return different responses
    if (message.toLowerCase().includes('error')) {
      return new Response(JSON.stringify(MOCK_ERROR_RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (message.toLowerCase().includes('love') || message.toLowerCase().includes('kind')) {
      // Already kind message - still blocked but with encouragement
      return new Response(JSON.stringify(MOCK_APPROVED_RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Default: blocked response
    return new Response(JSON.stringify(MOCK_BLOCKED_RESPONSE), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (url.includes('/report')) {
    // POST /report - return mock report success
    return new Response(JSON.stringify(MOCK_REPORT_SUCCESS), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Unknown endpoint - fallback to real fetch
  return fetch(url, options);
}


