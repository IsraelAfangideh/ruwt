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

async function deriveAESKey(encryptionKey: string): Promise<CryptoKey> {
  const keyBytes = new TextEncoder().encode(encryptionKey);
  const hash = await crypto.subtle.digest('SHA-256', keyBytes);
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt']);
}

async function encryptKey(key: string, encryptionKey: string): Promise<string> {
  const aesKey = await deriveAESKey(encryptionKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(key);
  // AES-GCM encrypt returns ciphertext + 16-byte auth tag appended
  const ciphertextWithTag = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plaintext,
  );
  // Concatenate: iv (12 bytes) + ciphertext + tag
  const combined = new Uint8Array(iv.byteLength + ciphertextWithTag.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertextWithTag), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
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
    const encrypted = await encryptKey(key, context.env.ENCRYPTION_KEY);
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
