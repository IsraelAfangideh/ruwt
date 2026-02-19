/**
 * SSE streaming generators for commercial AI providers.
 * Used for both platform-hosted and BYOK model calls.
 * Each provider yields text chunks and returns token counts.
 */

export type HostedProvider = 'openai' | 'anthropic' | 'google';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface HostedStreamResult {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

interface HostedStreamOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface ProviderCredentials {
  provider: HostedProvider;
  apiKey: string;
}

/**
 * Master dispatcher — routes to the correct provider streaming generator.
 */
export async function* streamHostedModel(
  credentials: ProviderCredentials,
  modelId: string,
  messages: Message[],
  options?: HostedStreamOptions
): AsyncGenerator<string, HostedStreamResult> {
  switch (credentials.provider) {
    case 'openai':
      return yield* streamOpenAI(credentials.apiKey, modelId, messages, options);
    case 'anthropic':
      return yield* streamAnthropic(credentials.apiKey, modelId, messages, options);
    case 'google':
      return yield* streamGoogle(credentials.apiKey, modelId, messages, options);
    default:
      throw new Error(`Unsupported provider: ${credentials.provider}`);
  }
}

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

async function* streamOpenAI(
  apiKey: string,
  model: string,
  messages: Message[],
  opts?: HostedStreamOptions
): AsyncGenerator<string, HostedStreamResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts?.maxTokens || 4096,
      temperature: opts?.temperature ?? 0.7,
      stream: true,
      stream_options: { include_usage: true },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${err}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body from OpenAI');

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let usage = { prompt_tokens: 0, completion_tokens: 0 };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';

      for (const line of parts) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.usage) {
            usage = parsed.usage;
          }
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullContent += content;
            yield content;
          }
        } catch { /* skip malformed */ }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    inputTokens: usage.prompt_tokens || Math.ceil(messages.map(m => m.content).join(' ').length / 4),
    outputTokens: usage.completion_tokens || Math.ceil(fullContent.length / 4),
    model,
  };
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

async function* streamAnthropic(
  apiKey: string,
  model: string,
  messages: Message[],
  opts?: HostedStreamOptions
): AsyncGenerator<string, HostedStreamResult> {
  const systemMsg = messages.find(m => m.role === 'system');
  const nonSystemMsgs = messages.filter(m => m.role !== 'system');

  const body: Record<string, unknown> = {
    model,
    messages: nonSystemMsgs,
    max_tokens: opts?.maxTokens || 4096,
    temperature: opts?.temperature ?? 0.7,
    stream: true,
  };
  if (systemMsg) body.system = systemMsg.content;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${err}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body from Anthropic');

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';

      for (const line of parts) {
        if (!line.startsWith('data: ')) continue;
        try {
          const parsed = JSON.parse(line.slice(6));

          // message_start has input token count
          if (parsed.type === 'message_start' && parsed.message?.usage) {
            inputTokens = parsed.message.usage.input_tokens;
          }
          // content_block_delta has the text
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            fullContent += parsed.delta.text;
            yield parsed.delta.text;
          }
          // message_delta has output token count
          if (parsed.type === 'message_delta' && parsed.usage) {
            outputTokens = parsed.usage.output_tokens;
          }
        } catch { /* skip malformed */ }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    inputTokens: inputTokens || Math.ceil(messages.map(m => m.content).join(' ').length / 4),
    outputTokens: outputTokens || Math.ceil(fullContent.length / 4),
    model,
  };
}

// ---------------------------------------------------------------------------
// Google (Gemini)
// ---------------------------------------------------------------------------

async function* streamGoogle(
  apiKey: string,
  model: string,
  messages: Message[],
  opts?: HostedStreamOptions
): AsyncGenerator<string, HostedStreamResult> {
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const systemInstruction = messages.find(m => m.role === 'system');

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: opts?.maxTokens || 4096,
      temperature: opts?.temperature ?? 0.7,
    },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google AI API error (${res.status}): ${err}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body from Google');

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';

      for (const line of parts) {
        if (!line.startsWith('data: ')) continue;
        try {
          const parsed = JSON.parse(line.slice(6));
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            fullContent += text;
            yield text;
          }
          if (parsed.usageMetadata) {
            totalInputTokens = parsed.usageMetadata.promptTokenCount || totalInputTokens;
            totalOutputTokens = parsed.usageMetadata.candidatesTokenCount || totalOutputTokens;
          }
        } catch { /* skip malformed */ }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    inputTokens: totalInputTokens || Math.ceil(messages.map(m => m.content).join(' ').length / 4),
    outputTokens: totalOutputTokens || Math.ceil(fullContent.length / 4),
    model,
  };
}
