/**
 * POST /api/ai/byok
 *
 * BYOK (Bring Your Own Key) proxy. Routes AI requests through the edge
 * using the user's own API key. We never store the key server-side —
 * it's used for a single request and discarded.
 *
 * This exists to solve CORS: browser can't call Anthropic/OpenAI directly.
 */
import { getUser } from '../../_shared/infra/auth';

type Provider = 'anthropic' | 'openai' | 'groq' | 'ollama';

const PROVIDER_URLS: Record<Provider, string> = {
  anthropic: 'https://api.anthropic.com/v1/messages',
  openai: 'https://api.openai.com/v1/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  ollama: '', // User-provided URL
};

interface BYOKRequest {
  provider: Provider;
  apiKey: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  ollamaUrl?: string;
  stream?: boolean;
  max_tokens?: number;
}

const MAX_BODY_SIZE = 1_000_000; // 1MB

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context: { request: Request; env: any }): Promise<Response> {
  const user = await getUser(context.request, context.env);
  if (!user) return jsonError('Unauthorized', 401);

  // Size limit
  const contentLength = parseInt(context.request.headers.get('content-length') ?? '0', 10);
  if (contentLength > MAX_BODY_SIZE) return jsonError('Request too large', 413);

  let body: BYOKRequest;
  try {
    body = await context.request.json() as BYOKRequest;
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  if (!body.provider || !(body.provider in PROVIDER_URLS)) {
    return jsonError(`Unsupported or missing provider: ${body.provider}`, 400);
  }
  if (!body.apiKey) return jsonError('Missing apiKey', 400);
  if (!body.model) return jsonError('Missing model', 400);
  if (!Array.isArray(body.messages)) return jsonError('Missing messages array', 400);

  const url = body.provider === 'ollama'
    ? (body.ollamaUrl ?? 'http://localhost:11434') + '/api/chat'
    : PROVIDER_URLS[body.provider];

  const headers = buildHeaders(body.provider, body.apiKey);
  const requestBody = buildRequestBody(body);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Proxy request failed';
    return jsonError(message, 502);
  }
}

function buildHeaders(provider: Provider, apiKey: string): Record<string, string> {
  switch (provider) {
    case 'anthropic':
      return {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      };
    case 'openai':
    case 'groq':
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };
    case 'ollama':
      return { 'Content-Type': 'application/json' };
  }
}

function buildRequestBody(body: BYOKRequest): Record<string, unknown> {
  switch (body.provider) {
    case 'anthropic':
      return {
        model: body.model,
        messages: body.messages,
        max_tokens: body.max_tokens ?? 4096,
        stream: body.stream ?? false,
      };
    case 'openai':
    case 'groq':
      return {
        model: body.model,
        messages: body.messages,
        max_tokens: body.max_tokens,
        stream: body.stream ?? false,
      };
    case 'ollama':
      return {
        model: body.model,
        messages: body.messages,
        stream: body.stream ?? false,
      };
  }
}
