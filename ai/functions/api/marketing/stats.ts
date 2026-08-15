import { getUser } from '../../_shared/auth';
import { getDb } from '../../_shared/db';
import type { Env } from '../../_shared/env';
import { getMarketingSnapshot } from '../../_shared/marketing/stats';

function canViewHits(email: string | undefined, alertEmail: string | undefined): boolean {
  if (!email || !alertEmail) return false;
  return email.trim().toLowerCase() === alertEmail.trim().toLowerCase();
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const user = await getUser(context.request, context.env);
  if (!user || !canViewHits(user.email, context.env.ERROR_ALERT_EMAIL)) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  const snapshot = await getMarketingSnapshot(getDb(context.env));
  return Response.json(snapshot);
}
