/**
 * GET /api/api-keys — List user's API keys (masked)
 * POST /api/api-keys — Add a new API key
 * DELETE /api/api-keys — Delete an API key by id
 */
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../_shared/db';
import { getUser } from '../_shared/auth';
import { apiKeys } from '../../drizzle/schema.d1';

function encryptKey(key: string, encryptionKey: string): string {
  const data = new TextEncoder().encode(key);
  const keyBytes = new TextEncoder().encode(encryptionKey);
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return btoa(String.fromCharCode(...result));
}

function maskKey(key: string): string {
  if (key.length <= 4) return '****';
  return '****' + key.slice(-4);
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    const keys = await db
      .select({
        id: apiKeys.id,
        provider: apiKeys.provider,
        label: apiKeys.label,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, user.id));

    return Response.json({ keys });
  } catch (error) {
    console.error('API keys list error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const addKeySchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google']),
  key: z.string().min(10),
  label: z.string().optional(),
});

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await context.request.json().catch(() => ({}));
    const parsed = addKeySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    }

    if (!context.env.ENCRYPTION_KEY) {
      return Response.json({ error: 'Server encryption not configured' }, { status: 500 });
    }

    const { provider, key, label } = parsed.data;
    const encrypted = encryptKey(key, context.env.ENCRYPTION_KEY);
    const id = crypto.randomUUID();

    const db = getDb(context.env);

    // Remove existing key for this provider (one key per provider)
    await db
      .delete(apiKeys)
      .where(eq(apiKeys.userId, user.id));

    // Only delete for this provider - re-query
    const existing = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, user.id));
    for (const k of existing) {
      if (k.provider === provider) {
        await db.delete(apiKeys).where(eq(apiKeys.id, k.id));
      }
    }

    await db.insert(apiKeys).values({
      id,
      userId: user.id,
      provider,
      encryptedKey: encrypted,
      label: label || `${provider} key`,
    });

    return Response.json({
      id,
      provider,
      label: label || `${provider} key`,
      maskedKey: maskKey(key),
    }, { status: 201 });
  } catch (error) {
    console.error('API key add error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const deleteKeySchema = z.object({
  id: z.string().uuid(),
});

export async function onRequestDelete(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await context.request.json().catch(() => ({}));
    const parsed = deleteKeySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const db = getDb(context.env);

    // Verify ownership
    const [key] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, parsed.data.id))
      .limit(1);

    if (!key || key.userId !== user.id) {
      return Response.json({ error: 'Key not found' }, { status: 404 });
    }

    await db.delete(apiKeys).where(eq(apiKeys.id, parsed.data.id));
    return Response.json({ ok: true });
  } catch (error) {
    console.error('API key delete error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
