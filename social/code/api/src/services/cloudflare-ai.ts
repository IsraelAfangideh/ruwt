type UnknownError = unknown;

export interface CloudflareAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CloudflareAIResponse {
  result: {
    response: string;
  };
  success: boolean;
  errors: Array<{ message: string; code: number }>;
}

export interface CloudflareAIStreamChunk {
  response: string;
}

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4/accounts';

function getAccountId(): string {
  const id = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!id) throw new Error('CLOUDFLARE_ACCOUNT_ID environment variable is required');
  return id;
}

function getApiToken(): string {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN environment variable is required');
  return token;
}

export function getModelCandidates(): string[] {
  const raw = process.env.CLOUDFLARE_AI_MODEL;

  if (raw && raw.trim()) {
    return raw.split(',').map(m => m.trim()).filter(Boolean);
  }

  // Open source models on Cloudflare Workers AI (ordered by preference).
  return [
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast',  // best quality, fast
    '@cf/meta/llama-3.1-70b-instruct',            // stable fallback
    '@cf/meta/llama-3.1-8b-instruct',             // lightweight fallback
  ];
}

export function isModelNotFoundError(err: UnknownError): boolean {
  if (!err || typeof err !== 'object') return false;

  const anyErr = err as any;
  const status = anyErr?.status;
  const message = String(anyErr?.message || '');

  if (status === 404) return true;

  return (
    message.includes('model not found') ||
    message.includes('Unknown model') ||
    message.includes('could not be found')
  );
}

function buildUrl(model: string): string {
  return `${CLOUDFLARE_API_BASE}/${getAccountId()}/ai/run/${model}`;
}

function buildHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${getApiToken()}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Call Cloudflare Workers AI (non-streaming).
 * Returns the text response from the model.
 */
export async function callCloudflareAI(
  model: string,
  messages: CloudflareAIMessage[],
  options?: { response_format?: Record<string, unknown> }
): Promise<string> {
  const url = buildUrl(model);
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      messages,
      ...(options?.response_format && { response_format: options.response_format }),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const error: any = new Error(`Cloudflare AI error (${res.status}): ${body}`);
    error.status = res.status;
    throw error;
  }

  const data = (await res.json()) as CloudflareAIResponse;

  if (!data.success) {
    const msg = data.errors?.map(e => e.message).join(', ') || 'Unknown error';
    throw new Error(`Cloudflare AI error: ${msg}`);
  }

  // Cloudflare may return response as a parsed object (when model outputs JSON)
  // or as a string. Always return a string for consistent downstream handling.
  const response = data.result.response;
  return typeof response === 'string' ? response : JSON.stringify(response);
}

/**
 * Call Cloudflare Workers AI with streaming (SSE).
 * Returns an async iterable of text chunks.
 */
export async function* streamCloudflareAI(
  model: string,
  messages: CloudflareAIMessage[]
): AsyncGenerator<string> {
  const url = buildUrl(model);
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ messages, stream: true }),
  });

  if (!res.ok) {
    const body = await res.text();
    const error: any = new Error(`Cloudflare AI error (${res.status}): ${body}`);
    error.status = res.status;
    throw error;
  }

  if (!res.body) {
    throw new Error('Cloudflare AI: No response body for streaming');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      const payload = trimmed.slice('data: '.length);
      if (payload === '[DONE]') return;

      try {
        const chunk = JSON.parse(payload) as CloudflareAIStreamChunk;
        if (chunk.response) {
          yield chunk.response;
        }
      } catch {
        // Skip malformed chunks
      }
    }
  }
}

/**
 * Convert Gemini-style history (used by mobile client) to OpenAI-compatible messages.
 */
export function convertHistory(
  history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>
): CloudflareAIMessage[] {
  return history.map(h => ({
    role: h.role === 'model' ? 'assistant' as const : 'user' as const,
    content: h.parts.map(p => p.text).join('\n'),
  }));
}
