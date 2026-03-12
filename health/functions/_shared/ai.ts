/**
 * Cloudflare Workers AI client using native binding.
 * Simpler than dev's version — no credit tracking, no pricing tiers.
 */
import type { Env } from './env';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CallAIOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

const PRIMARY_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const FALLBACK_MODEL = '@cf/meta/llama-3.1-8b-instruct';

/**
 * Non-streaming AI call — returns parsed JSON or plain text.
 * Used for food parsing, meal suggestions, workout generation.
 */
export async function callAI(
  env: Env,
  messages: Message[],
  options: CallAIOptions = {}
): Promise<string> {
  const model = options.model || PRIMARY_MODEL;

  try {
    const result = await env.AI.run(model, {
      messages,
      max_tokens: options.maxTokens || 1024,
      temperature: options.temperature ?? 0.3,
    });

    // Cloudflare Workers AI returns { response: string } or the response directly
    const response = typeof result === 'string' ? result : result?.response;
    if (typeof response === 'string') return response;
    if (typeof response === 'number' || typeof response === 'boolean') return String(response);
    return JSON.stringify(response);
  } catch (err: any) {
    // Fallback to smaller model on failure
    if (model === PRIMARY_MODEL) {
      return callAI(env, messages, { ...options, model: FALLBACK_MODEL });
    }
    throw err;
  }
}

/**
 * Streaming AI call — returns ReadableStream for SSE.
 * Used for coach chat.
 */
export async function streamAI(
  env: Env,
  messages: Message[],
  options: CallAIOptions = {}
): Promise<ReadableStream> {
  const model = options.model || PRIMARY_MODEL;

  const stream = await env.AI.run(model, {
    messages,
    max_tokens: options.maxTokens || 2048,
    temperature: options.temperature ?? 0.7,
    stream: true,
  });

  // Transform the raw SSE stream into clean text/event-stream
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      try {
        const reader = (stream as ReadableStream).getReader();
        let buffer = '';
        let sentDone = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += typeof value === 'string' ? value : decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              sentDone = true;
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              const text = extractChunkContent(parsed);
              if (text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              }
            } catch {
              // Skip unparseable chunks
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim()) {
          const line = buffer.trim();
          if (line.startsWith('data: ') && line.slice(6).trim() !== '[DONE]') {
            try {
              const parsed = JSON.parse(line.slice(6).trim());
              const text = extractChunkContent(parsed);
              if (text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              }
            } catch {}
          }
        }

        if (!sentDone) {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

/**
 * Parse AI response JSON — strips markdown code fences, extracts JSON from text.
 * Handles both object {} and array [] JSON.
 */
export function parseAIJson<T = unknown>(response: string): T {
  const cleaned = response.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    const match = arrMatch || objMatch;
    if (match) return JSON.parse(match[0]);
    throw new Error('AI returned invalid JSON');
  }
}

/**
 * Extract text from a parsed SSE chunk.
 * Handles Cloudflare-native { response: "..." } and OpenAI-compatible formats.
 */
function extractChunkContent(parsed: Record<string, unknown>): string | null {
  // Cloudflare-native format
  if (typeof parsed.response === 'string') return parsed.response;
  if (typeof parsed.response === 'number' || typeof parsed.response === 'boolean') return String(parsed.response);

  // OpenAI-compatible format
  if (Array.isArray(parsed.choices) && parsed.choices.length > 0) {
    const delta = (parsed.choices[0] as any)?.delta;
    if (delta) {
      if (typeof delta.content === 'string' && delta.content) return delta.content;
      if (typeof delta.content === 'number' || typeof delta.content === 'boolean') return String(delta.content);
    }
  }
  return null;
}
