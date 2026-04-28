/**
 * POST /api/leads/pilot
 * Capture a hiring-manager pilot signup from /for-hiring-managers.
 * Public, unauthenticated — gated by middleware rate limiting + CSRF check.
 */
import { getDb } from '../../_shared/infra/db';
import { pilotLeads } from '../../../drizzle/schema.d1';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'protonmail.com', 'proton.me', 'live.com', 'msn.com',
]);

export interface PilotLeadInput {
  email?: string;
  name?: string;
  company?: string;
  role?: string;
  hiresPerYear?: number;
  currentTool?: string;
  notes?: string;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const body = (await context.request.json().catch(() => ({}))) as PilotLeadInput;

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || !EMAIL_REGEX.test(email)) {
      return Response.json({ error: 'A valid email is required' }, { status: 400 });
    }

    // Soft requirement: a real work email signals genuine pilot interest.
    // Block free providers with a clear message rather than silently storing them.
    const domain = email.split('@')[1];
    if (FREE_EMAIL_DOMAINS.has(domain)) {
      return Response.json(
        { error: 'Please use your work email so we can route the pilot to your team' },
        { status: 400 },
      );
    }

    const trimOpt = (v: unknown, max = 200) =>
      typeof v === 'string' ? v.trim().slice(0, max) || null : null;

    const hires = typeof body.hiresPerYear === 'number' && Number.isFinite(body.hiresPerYear)
      ? Math.max(0, Math.min(100000, Math.floor(body.hiresPerYear)))
      : null;

    const ip =
      context.request.headers.get('CF-Connecting-IP') ||
      context.request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      null;
    const userAgent = context.request.headers.get('User-Agent')?.slice(0, 500) || null;

    const db = getDb(context.env);
    const id = crypto.randomUUID();

    await db.insert(pilotLeads).values({
      id,
      email,
      name: trimOpt(body.name, 200),
      company: trimOpt(body.company, 200),
      role: trimOpt(body.role, 200),
      hiresPerYear: hires,
      currentTool: trimOpt(body.currentTool, 200),
      notes: trimOpt(body.notes, 2000),
      ip,
      userAgent,
    });

    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    console.error('Pilot lead capture error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
