/**
 * Stream Cloudflare AI response. Uses env for CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.
 * Only Cloudflare models are supported in Workers.
 *
 * Yields StreamChunk objects with phase metadata to distinguish
 * reasoning tokens ('thinking') from answer tokens ('content').
 */
interface Env {
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChunk {
  text: string;
  phase: 'thinking' | 'content';
}

import { getModelPricing, getTierFallbackChain } from './ai-pricing';

/**
 * Extract text content from a parsed SSE chunk.
 * Handles three formats:
 * 1. Cloudflare-native: { response: "..." }
 * 2. OpenAI-compatible: { choices: [{ delta: { content: "..." } }] }
 * 3. Reasoning models: { choices: [{ delta: { reasoning_content: "..." } }] }
 *    (GLM-4.7, Qwen3 MoE send reasoning_content before content)
 *
 * Returns a StreamChunk with phase metadata so the SSE layer can
 * distinguish thinking tokens from answer tokens.
 */
function extractChunkContent(parsed: Record<string, unknown>): StreamChunk | null {
  // Cloudflare-native format (these models don't produce reasoning_content)
  // Note: Cloudflare API sometimes returns bare numeric tokens as JSON numbers
  // (e.g. {"response":1} instead of {"response":"1"}), so we handle both.
  if (typeof parsed.response === 'string') {
    return { text: parsed.response, phase: 'content' };
  }
  if (typeof parsed.response === 'number' || typeof parsed.response === 'boolean') {
    return { text: String(parsed.response), phase: 'content' };
  }
  // OpenAI-compatible format
  if (Array.isArray(parsed.choices) && parsed.choices.length > 0) {
    const delta = (parsed.choices[0] as Record<string, unknown>)?.delta as Record<string, unknown> | undefined;
    if (delta) {
      // Prefer content over reasoning_content
      // Handle both string and numeric tokens (Cloudflare API quirk)
      if (typeof delta.content === 'string' && delta.content) {
        return { text: delta.content, phase: 'content' };
      }
      if (typeof delta.content === 'number' || typeof delta.content === 'boolean') {
        return { text: String(delta.content), phase: 'content' };
      }
      // reasoning_content = thinking-phase tokens from reasoning models
      if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
        return { text: delta.reasoning_content, phase: 'thinking' };
      }
      if (typeof delta.reasoning_content === 'number' || typeof delta.reasoning_content === 'boolean') {
        return { text: String(delta.reasoning_content), phase: 'thinking' };
      }
    }
  }
  return null;
}

/**
 * Extract content from a non-streaming OpenAI-format response.
 * Used for models that don't support SSE streaming (GPT-OSS).
 * Returns both content and reasoning separately.
 */
function extractNonStreamingContent(json: Record<string, unknown>): {
  content: string; reasoning: string; inputTokens: number; outputTokens: number;
} | null {
  const result = json.result as Record<string, unknown> | undefined;
  if (!result || !Array.isArray(result.choices) || result.choices.length === 0) return null;
  const msg = (result.choices[0] as Record<string, unknown>)?.message as Record<string, unknown> | undefined;
  if (!msg) return null;

  // Handle string, number, and boolean content (Cloudflare API can return non-string tokens)
  const rawContent = msg.content;
  const content = typeof rawContent === 'string' ? rawContent
    : (typeof rawContent === 'number' || typeof rawContent === 'boolean') ? String(rawContent)
    : '';
  const rawReasoning = msg.reasoning_content;
  const reasoning = typeof rawReasoning === 'string' ? rawReasoning
    : (typeof rawReasoning === 'number' || typeof rawReasoning === 'boolean') ? String(rawReasoning)
    : '';

  // If there's no content at all, nothing to return
  if (!content && !reasoning) return null;

  const usage = result.usage as Record<string, number> | undefined;
  const fullText = content || reasoning;
  return {
    content: content || reasoning, // fallback: use reasoning as content if content is empty
    reasoning,
    inputTokens: usage?.prompt_tokens ?? Math.ceil(fullText.length / 4),
    outputTokens: usage?.completion_tokens ?? Math.ceil(fullText.length / 4),
  };
}

// Default fallback: full chain from premium down
const DEFAULT_FALLBACK_CHAIN = [
  '@cf/qwen/qwen2.5-coder-32b-instruct',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-4-scout-17b-16e-instruct',
  '@cf/openai/gpt-oss-20b',
  '@cf/meta/llama-3.1-70b-instruct',
  '@cf/qwen/qwen3-30b-a3b-fp8',
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/mistral/mistral-7b-instruct-v0.2',
  '@cf/ibm-granite/granite-4.0-h-micro',
  '@cf/meta/llama-3.2-1b-instruct',
];

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface StreamOptions {
  maxTokens?: number;
  temperature?: number;
  tools?: ToolDefinition[];
  response_format?: Record<string, unknown>;
}

export async function* streamCloudflareAI(
  env: Env,
  modelId: string,
  messages: Message[],
  options?: StreamOptions
): AsyncGenerator<StreamChunk, { inputTokens: number; outputTokens: number }> {
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
        ...(options?.tools?.length && { tools: options.tools }),
        ...(options?.response_format && { response_format: options.response_format }),
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
  let realUsage: { prompt_tokens?: number; completion_tokens?: number } | null = null;

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
          // Capture real usage data from final chunk (Cloudflare sends it alongside last response)
          if (parsed.usage && typeof parsed.usage === 'object') {
            realUsage = parsed.usage as { prompt_tokens?: number; completion_tokens?: number };
          }
          const chunk = extractChunkContent(parsed);
          if (chunk) {
            fullContent += chunk.text;
            yield chunk;
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
          if (parsed.usage && typeof parsed.usage === 'object') {
            realUsage = parsed.usage as { prompt_tokens?: number; completion_tokens?: number };
          }
          const chunk = extractChunkContent(parsed);
          if (chunk) {
            fullContent += chunk.text;
            yield chunk;
          }
        } catch { /* skip */ }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    inputTokens: realUsage?.prompt_tokens ?? Math.ceil(inputText.length / 4),
    outputTokens: realUsage?.completion_tokens ?? Math.ceil(fullContent.length / 4),
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
  options?: StreamOptions,
  fallbackChain?: string[]
): AsyncGenerator<StreamChunk, { inputTokens: number; outputTokens: number; model: string }> {
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
          ...(options?.tools?.length && { tools: options.tools }),
          ...(options?.response_format && { response_format: options.response_format }),
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

    const contentType = response.headers.get('content-type') || '';

    // Some models (GPT-OSS) don't support streaming and return JSON
    if (contentType.includes('application/json')) {
      const json = await response.json() as Record<string, unknown>;
      const extracted = extractNonStreamingContent(json);
      if (extracted && (extracted.content || extracted.reasoning)) {
        // Yield reasoning first (thinking phase), then content (answer phase)
        if (extracted.reasoning && extracted.content !== extracted.reasoning) {
          yield { text: extracted.reasoning, phase: 'thinking' };
        }
        yield { text: extracted.content, phase: 'content' };
        return {
          inputTokens: extracted.inputTokens,
          outputTokens: extracted.outputTokens,
          model: modelId,
        };
      }
      // Empty result — retry non-streaming explicitly
      const retryResponse = await fetch(
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
          }),
        }
      );
      if (retryResponse.ok) {
        const retryJson = await retryResponse.json() as Record<string, unknown>;
        const retryExtracted = extractNonStreamingContent(retryJson);
        if (retryExtracted && (retryExtracted.content || retryExtracted.reasoning)) {
          if (retryExtracted.reasoning && retryExtracted.content !== retryExtracted.reasoning) {
            yield { text: retryExtracted.reasoning, phase: 'thinking' };
          }
          yield { text: retryExtracted.content, phase: 'content' };
          return {
            inputTokens: retryExtracted.inputTokens,
            outputTokens: retryExtracted.outputTokens,
            model: modelId,
          };
        }
      }
      // Model returned empty — try next in fallback chain
      if (modelId !== models[models.length - 1]) {
        lastError = `${modelId}: empty response`;
        continue;
      }
      throw new Error(`${modelId} returned empty response`);
    }

    // SSE streaming path
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';
    const inputText = messages.map((m) => m.content).join(' ');
    let realUsage: { prompt_tokens?: number; completion_tokens?: number } | null = null;

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
            // Capture real usage data from final chunk
            if (parsed.usage && typeof parsed.usage === 'object') {
              realUsage = parsed.usage as { prompt_tokens?: number; completion_tokens?: number };
            }
            const chunk = extractChunkContent(parsed);
            if (chunk) {
              fullContent += chunk.text;
              yield chunk;
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
            if (parsed.usage && typeof parsed.usage === 'object') {
              realUsage = parsed.usage as { prompt_tokens?: number; completion_tokens?: number };
            }
            const chunk = extractChunkContent(parsed);
            if (chunk) {
              fullContent += chunk.text;
              yield chunk;
            }
          } catch { /* skip */ }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      inputTokens: realUsage?.prompt_tokens ?? Math.ceil(inputText.length / 4),
      outputTokens: realUsage?.completion_tokens ?? Math.ceil(fullContent.length / 4),
      model: modelId,
    };
  }

  /* istanbul ignore next -- @preserve */
  throw new Error(`All models failed. Last error: ${lastError}`);
}
