import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getUser } from '../../_shared/auth';
import { getDb } from '../../_shared/db';
import { requireOrgAccess } from '../../_shared/org';
import { ingestionApiKeys } from '../../../drizzle/schema.d1';
import { hashIngestionKey, keyPrefix, newIngestionKey } from '../../_shared/intelligence/keys';

const input = z.object({ orgId: z.uuid(), name: z.string().trim().min(1).max(80), expiresAt: z.iso.datetime().optional() }).strict();

export async function onRequestGet(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = new URL(context.request.url).searchParams.get('orgId');
  if (!orgId || !await requireOrgAccess(getDb(context.env), user.id, orgId, 'admin')) return Response.json({ error: 'Not found' }, { status: 404 });
  const keys = await getDb(context.env).select({ id: ingestionApiKeys.id, name: ingestionApiKeys.name, keyPrefix: ingestionApiKeys.keyPrefix, scopes: ingestionApiKeys.scopes, expiresAt: ingestionApiKeys.expiresAt, lastUsedAt: ingestionApiKeys.lastUsedAt, revokedAt: ingestionApiKeys.revokedAt, createdAt: ingestionApiKeys.createdAt }).from(ingestionApiKeys).where(eq(ingestionApiKeys.orgId, orgId)).orderBy(desc(ingestionApiKeys.createdAt));
  return Response.json({ keys });
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = input.safeParse(await context.request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid API key request' }, { status: 400 });
  const db = getDb(context.env);
  if (!await requireOrgAccess(db, user.id, parsed.data.orgId, 'admin')) return Response.json({ error: 'Not found' }, { status: 404 });
  const key = newIngestionKey();
  const id = crypto.randomUUID();
  await db.insert(ingestionApiKeys).values({ id, orgId: parsed.data.orgId, name: parsed.data.name, keyPrefix: keyPrefix(key), keyHash: await hashIngestionKey(key), expiresAt: parsed.data.expiresAt ?? null, createdBy: user.id });
  return Response.json({ id, key, keyPrefix: keyPrefix(key), warning: 'Copy this key now. Ruwt stores only its hash.' }, { status: 201 });
}
