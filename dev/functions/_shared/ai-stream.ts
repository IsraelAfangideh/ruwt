/**
 * Stream Cloudflare AI response. Uses env for CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.
 * Only Cloudflare models are supported in Workers.
 */
interface Env {
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const DEFAULT_FALLBACK_CHAIN = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.1-70b-instruct',
  '@cf/meta/llama-3.1-8b-instruct',
];

export async function* streamCloudflareAI(
  env: Env,
  modelId: string,
  messages: Message[],
  options?: { maxTokens?: number; temperature?: number }
): AsyncGenerator<string, { inputTokens: number; outputTokens: number }> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error('Cloudflare AI credentials not configured');
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        max_tokens: options?.maxTokens ?? 2048,
        temperature: options?.temperature ?? 0.7,
        stream: true,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Cloudflare AI error: ${response.status} - ${err}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullContent = '';
  const inputText = messages.map((m) => m.content).join(' ');

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));
      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data) as { response?: string };
          if (parsed.response) {
            fullContent += parsed.response;
            yield parsed.response;
          }
        } catch {
          // skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    inputTokens: Math.ceil(inputText.length / 4),
    outputTokens: Math.ceil(fullContent.length / 4),
  };
}

/**
 * Try models in order. If a model returns 404 or "model not found",
 * fall through to the next. Returns actual model used in the return value.
 */
export async function* streamCloudflareAIWithFallback(
  env: Env,
  requestedModel: string,
  messages: Message[],
  options?: { maxTokens?: number; temperature?: number },
  fallbackChain?: string[]
): AsyncGenerator<string, { inputTokens: number; outputTokens: number; model: string }> {
  const chain = fallbackChain || DEFAULT_FALLBACK_CHAIN;
  // Build ordered list: requested model first, then fallbacks (deduped)
  const models = [requestedModel, ...chain.filter((m) => m !== requestedModel)];

  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error('Cloudflare AI credentials not configured');
  }

  let lastError = '';
  for (const modelId of models) {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          max_tokens: options?.maxTokens ?? 2048,
          temperature: options?.temperature ?? 0.7,
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      const isModelNotFound =
        response.status === 404 ||
        err.toLowerCase().includes('model not found') ||
        err.toLowerCase().includes('not found');
      if (isModelNotFound && modelId !== models[models.length - 1]) {
        lastError = `${modelId}: ${response.status} - ${err}`;
        continue; // try next model
      }
      throw new Error(`Cloudflare AI error: ${response.status} - ${err}`);
    }

    // Model responded — stream it
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';
    const inputText = messages.map((m) => m.content).join(' ');

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));
        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data) as { response?: string };
            if (parsed.response) {
              fullContent += parsed.response;
              yield parsed.response;
            }
          } catch {
            // skip
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      inputTokens: Math.ceil(inputText.length / 4),
      outputTokens: Math.ceil(fullContent.length / 4),
      model: modelId,
    };
  }

  throw new Error(`All models failed. Last error: ${lastError}`);
}
