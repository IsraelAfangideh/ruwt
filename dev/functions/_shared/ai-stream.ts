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

import { getModelPricing, getTierFallbackChain } from './ai-pricing';

/**
 * Extract text content from a parsed SSE chunk.
 * Handles both Cloudflare-native format ({ response: "..." })
 * and OpenAI-compatible format ({ choices: [{ delta: { content: "..." } }] }).
 */
function extractChunkContent(parsed: Record<string, unknown>): string | null {
  // Cloudflare-native format
  if (typeof parsed.response === 'string') return parsed.response;
  // OpenAI-compatible format
  if (Array.isArray(parsed.choices) && parsed.choices.length > 0) {
    const delta = (parsed.choices[0] as Record<string, unknown>)?.delta;
    if (delta && typeof (delta as Record<string, unknown>).content === 'string') {
      return (delta as Record<string, unknown>).content as string;
    }
  }
  return null;
}

// Default fallback: full chain from premium down
const DEFAULT_FALLBACK_CHAIN = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.1-70b-instruct',
  '@cf/qwen/qwen1.5-14b-chat-awq',
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/mistral/mistral-7b-instruct-v0.2',
  '@cf/ibm-granite/granite-4.0-h-micro',
  '@cf/meta/llama-3.2-1b-instruct',
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

  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Split by newline; keep last part as potentially incomplete line
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';

      for (const line of parts) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const content = extractChunkContent(parsed);
          if (content) {
            fullContent += content;
            yield content;
          }
        } catch {
          // skip
        }
      }
    }

    // Process any remaining buffered line
    if (buffer.startsWith('data: ')) {
      const data = buffer.slice(6);
      if (data !== '[DONE]') {
        try {
          const parsed = JSON.parse(data);
          const content = extractChunkContent(parsed);
          if (content) {
            fullContent += content;
            yield content;
          }
        } catch { /* skip */ }
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
  // Build tier-aware fallback chain: only fall to same tier or lower
  const pricing = getModelPricing(requestedModel);
  const chain = fallbackChain || (pricing ? getTierFallbackChain(pricing.tier) : DEFAULT_FALLBACK_CHAIN);
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
      const isModelUnavailable =
        response.status === 404 ||
        response.status === 400 ||
        err.toLowerCase().includes('model not found') ||
        err.toLowerCase().includes('not found') ||
        err.toLowerCase().includes('no route');
      if (isModelUnavailable && modelId !== models[models.length - 1]) {
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

    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Split by newline; keep last part as potentially incomplete line
        const parts = buffer.split('\n');
        buffer = parts.pop() ?? '';

        for (const line of parts) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const content = extractChunkContent(parsed);
            if (content) {
              fullContent += content;
              yield content;
            }
          } catch {
            // skip
          }
        }
      }

      // Process any remaining buffered line
      if (buffer.startsWith('data: ')) {
        const data = buffer.slice(6);
        if (data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data);
            const content = extractChunkContent(parsed);
            if (content) {
              fullContent += content;
              yield content;
            }
          } catch { /* skip */ }
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
