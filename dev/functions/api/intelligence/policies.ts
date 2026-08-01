import { desc, eq } from 'drizzle-orm';
import { getUser } from '../../_shared/infra/auth';
import { getDb } from '../../_shared/infra/db';
import { requireOrgAccess } from '../../_shared/org';
import { policyInputSchema } from '../../../src/shared/intelligence/contracts';
import { intelligencePolicies } from '../../../drizzle/schema.d1';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = new URL(context.request.url).searchParams.get('orgId');
  const db = getDb(context.env);
  if (!orgId || !await requireOrgAccess(db, user.id, orgId, 'viewer')) return Response.json({ error: 'Not found' }, { status: 404 });
  const policies = await db.select().from(intelligencePolicies).where(eq(intelligencePolicies.orgId, orgId)).orderBy(desc(intelligencePolicies.createdAt));
  return Response.json({ policies });
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await context.request.json().catch(() => null) as Record<string, unknown> | null;
  const orgId = typeof body?.orgId === 'string' ? body.orgId : '';
  const { orgId: _orgId, ...policyBody } = body ?? {};
  const parsed = policyInputSchema.safeParse(policyBody);
  const db = getDb(context.env);
  if (!orgId || !await requireOrgAccess(db, user.id, orgId, 'admin')) return Response.json({ error: 'Not found' }, { status: 404 });
  if (!parsed.success) return Response.json({ error: 'Invalid policy' }, { status: 400 });
  const id = crypto.randomUUID();
  await db.insert(intelligencePolicies).values({ id, orgId, ...parsed.data, configuration: JSON.stringify(parsed.data.configuration), createdBy: user.id, mode: 'detect' });
  return Response.json({ id, mode: 'detect', message: 'This policy detects activity. It does not block an agent.' }, { status: 201 });
}
