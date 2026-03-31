/**
 * POST /api/ai/complete
 *
 * Lightweight fill-in-the-middle completion endpoint.
 * Uses the cheapest model (Llama 3.1 8B) for fast, low-cost completions.
 * Returns a single completion string — no streaming.
 */
import { getUser } from '../../_shared/infra/auth';
import { buildFIMPrompt } from '../../../src/lib/ai/fim-prompt';

const COMPLETION_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const MAX_OUTPUT_TOKENS = 128;

export async function onRequestPost(context: { request: Request; env: any }): Promise<Response> {
  const user = await getUser(context.request, context.env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: { prefix?: string; suffix?: string; language?: string; filePath?: string };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  if (!body.prefix && body.prefix !== '') {
    return new Response(JSON.stringify({ error: 'Missing prefix' }), { status: 400 });
  }
  if (!body.language) {
    return new Response(JSON.stringify({ error: 'Missing language' }), { status: 400 });
  }

  const { messages } = buildFIMPrompt({
    prefix: body.prefix ?? '',
    suffix: body.suffix ?? '',
    language: body.language,
    filePath: body.filePath,
  });

  const accountId = context.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = context.env.CLOUDFLARE_API_TOKEN;

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${COMPLETION_MODEL}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          max_tokens: MAX_OUTPUT_TOKENS,
          temperature: 0.2,
          stream: false,
        }),
      },
    );

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Model error' }), { status: 502 });
    }

    const data = await response.json() as { result?: { response?: string } };
    const completion = data.result?.response ?? '';

    return new Response(JSON.stringify({ completion, model: COMPLETION_MODEL }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Completion failed' }), { status: 502 });
  }
}
