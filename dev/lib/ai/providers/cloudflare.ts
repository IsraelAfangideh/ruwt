interface CloudflareMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CloudflareResponse {
  result: {
    response: string;
  };
  success: boolean;
  errors: Array<{ message: string }>;
}

export async function callCloudflareAI(
  modelId: string,
  messages: CloudflareMessage[],
  options?: {
    maxTokens?: number;
    temperature?: number;
  }
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error('Cloudflare credentials not configured');
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
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cloudflare AI error: ${error}`);
  }

  const data: CloudflareResponse = await response.json();

  if (!data.success) {
    throw new Error(`Cloudflare AI error: ${data.errors.map((e) => e.message).join(', ')}`);
  }

  // Estimate tokens (Cloudflare doesn't return exact counts)
  // Using rough estimate of 4 characters per token
  const inputText = messages.map((m) => m.content).join(' ');
  const inputTokens = Math.ceil(inputText.length / 4);
  const outputTokens = Math.ceil(data.result.response.length / 4);

  return {
    content: data.result.response,
    inputTokens,
    outputTokens,
  };
}

// Streaming version for Cloudflare AI
export async function* streamCloudflareAI(
  modelId: string,
  messages: CloudflareMessage[],
  options?: {
    maxTokens?: number;
    temperature?: number;
  }
): AsyncGenerator<string, { inputTokens: number; outputTokens: number }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error('Cloudflare credentials not configured');
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
    const error = await response.text();
    throw new Error(`Cloudflare AI error: ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let fullContent = '';
  const inputText = messages.map((m) => m.content).join(' ');

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter((line) => line.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6); // Remove 'data: ' prefix
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.response) {
            fullContent += parsed.response;
            yield parsed.response;
          }
        } catch {
          // Ignore parsing errors for incomplete chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Return token estimates
  return {
    inputTokens: Math.ceil(inputText.length / 4),
    outputTokens: Math.ceil(fullContent.length / 4),
  };
}
