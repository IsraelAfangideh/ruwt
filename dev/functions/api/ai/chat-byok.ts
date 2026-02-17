/**
 * POST /api/ai/chat-byok
 * Proxy endpoint for BYOK model calls (OpenAI, Anthropic, Google APIs).
 * Decrypts user's stored API key, proxies to provider, tracks cost identically.
 */
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../_shared/db';
import { getUser } from '../../_shared/auth';
import { validateConstraints, checkPreCallConstraints } from '../../_shared/constraints';
import { getModelPricing, calculateCost, countMessageTokens, getBYOKProvider } from '../../_shared/ai-pricing';
import { profiles, attempts, aiCalls, attemptMessages, apiKeys } from '../../../drizzle/schema.d1';

const requestSchema = z.object({
  model: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string(),
    })
  ),
  attemptId: z.string().uuid().nullable().optional(),
  userMessage: z.string().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
});

async function decryptKey(encrypted: string, encryptionKey: string): Promise<string> {
  // Simple XOR-based encryption for D1 compatibility (no Web Crypto subtle in all CF environments)
  // In production, use AES-256-GCM via Web Crypto API
  const data = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const key = new TextEncoder().encode(encryptionKey);
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return new TextDecoder().decode(result);
}

async function callOpenAI(apiKey: string, model: string, messages: any[], opts: { maxTokens?: number; temperature?: number }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts.maxTokens || 4096,
      temperature: opts.temperature ?? 0.7,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${err}`);
  }
  const data = await res.json() as any;
  return {
    content: data.choices?.[0]?.message?.content || '',
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
    model: data.model || model,
  };
}

async function callAnthropic(apiKey: string, model: string, messages: any[], opts: { maxTokens?: number; temperature?: number }) {
  // Extract system message if present
  const systemMsg = messages.find((m: any) => m.role === 'system');
  const nonSystemMsgs = messages.filter((m: any) => m.role !== 'system');

  const body: any = {
    model,
    messages: nonSystemMsgs,
    max_tokens: opts.maxTokens || 4096,
    temperature: opts.temperature ?? 0.7,
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
    throw new Error(`Anthropic API error: ${res.status} ${err}`);
  }
  const data = await res.json() as any;
  return {
    content: data.content?.[0]?.text || '',
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
    model: data.model || model,
  };
}

async function callGoogle(apiKey: string, model: string, messages: any[], opts: { maxTokens?: number; temperature?: number }) {
  // Convert to Gemini format
  const contents = messages
    .filter((m: any) => m.role !== 'system')
    .map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const systemInstruction = messages.find((m: any) => m.role === 'system');

  const body: any = {
    contents,
    generationConfig: {
      maxOutputTokens: opts.maxTokens || 4096,
      temperature: opts.temperature ?? 0.7,
    },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google AI API error: ${res.status} ${err}`);
  }
  const data = await res.json() as any;
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    inputTokens: data.usageMetadata?.promptTokenCount || 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
    model,
  };
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await context.request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { model, messages, attemptId, userMessage, maxTokens, temperature } = parsed.data;

    const pricing = getModelPricing(model);
    if (!pricing) {
      return Response.json({ error: 'Unknown model' }, { status: 400 });
    }

    const provider = getBYOKProvider(model);
    if (!provider) {
      return Response.json({ error: 'Not a BYOK model. Use /api/ai/chat for Cloudflare models.' }, { status: 400 });
    }

    const db = getDb(context.env);

    // Get user's API key for this provider
    const [userKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, user.id))
      .limit(10);

    // Find key for this specific provider
    const allUserKeys = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, user.id));
    const providerKey = allUserKeys.find((k) => k.provider === provider);

    if (!providerKey) {
      return Response.json(
        { error: `No ${provider} API key configured. Add one in Settings > API Keys.` },
        { status: 400 }
      );
    }

    if (!context.env.ENCRYPTION_KEY) {
      return Response.json({ error: 'Server encryption not configured' }, { status: 500 });
    }

    const decryptedKey = await decryptKey(providerKey.encryptedKey, context.env.ENCRYPTION_KEY);

    // Pre-call constraint check
    const estimatedInputTokens = countMessageTokens(messages);
    const estimatedOutputTokens = Math.min(Math.ceil(estimatedInputTokens * 1.5), maxTokens || 4096);
    const estimatedCost = calculateCost(model, estimatedInputTokens, estimatedOutputTokens);

    if (attemptId) {
      const constraintCheck = await checkPreCallConstraints(db, attemptId, estimatedInputTokens, estimatedOutputTokens, estimatedCost);
      if (!constraintCheck.valid) {
        return Response.json({
          error: 'Constraint violation',
          violation: constraintCheck.violation,
          message: constraintCheck.message,
        }, { status: 403 });
      }
    }

    // Store user message for replay
    let nextSequence = 0;
    if (attemptId && userMessage) {
      const seqResult = await db
        .select({ maxSeq: sql<number>`COALESCE(MAX(${attemptMessages.sequence}), -1)` })
        .from(attemptMessages)
        .where(eq(attemptMessages.attemptId, attemptId));
      nextSequence = (seqResult[0]?.maxSeq ?? -1) + 1;
      await db.insert(attemptMessages).values({
        id: crypto.randomUUID(),
        attemptId,
        role: 'user',
        content: userMessage,
        sequence: nextSequence,
      });
      nextSequence++;
    }

    // Call the provider API (non-streaming for simplicity with BYOK)
    let result: { content: string; inputTokens: number; outputTokens: number; model: string };
    try {
      if (provider === 'openai') {
        result = await callOpenAI(decryptedKey, model, messages, { maxTokens, temperature });
      } else if (provider === 'anthropic') {
        result = await callAnthropic(decryptedKey, model, messages, { maxTokens, temperature });
      } else {
        result = await callGoogle(decryptedKey, model, messages, { maxTokens, temperature });
      }
    } catch (err) {
      return Response.json({
        error: `${provider} API call failed`,
        details: err instanceof Error ? err.message : String(err),
      }, { status: 502 });
    }

    const actualCost = calculateCost(model, result.inputTokens, result.outputTokens);

    // Track cost on attempt (same as Cloudflare models)
    if (attemptId) {
      await db
        .update(attempts)
        .set({
          totalCost: sql`${attempts.totalCost} + ${actualCost}`,
          inputTokens: sql`${attempts.inputTokens} + ${result.inputTokens}`,
          outputTokens: sql`${attempts.outputTokens} + ${result.outputTokens}`,
        })
        .where(eq(attempts.id, attemptId));

      await db.insert(aiCalls).values({
        id: crypto.randomUUID(),
        attemptId,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cost: actualCost,
      });

      // Store assistant message for replay
      if (userMessage) {
        await db.insert(attemptMessages).values({
          id: crypto.randomUUID(),
          attemptId,
          role: 'assistant',
          content: result.content,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          cost: actualCost,
          sequence: nextSequence,
        });
      }

      const postCheck = await validateConstraints(db, attemptId);
      if (!postCheck.valid) {
        return Response.json({
          content: result.content,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          cost: actualCost,
          model: result.model,
          constraintWarning: { violation: postCheck.violation, message: postCheck.message },
        });
      }
    }

    return Response.json({
      content: result.content,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cost: actualCost,
      model: result.model,
    });
  } catch (error) {
    console.error('BYOK chat error:', error);
    return Response.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
