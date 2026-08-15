import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { downloadClicks, siteStats, siteVisitors, siteVisits } from '../../../drizzle/schema.d1';
import { sendEmail } from '../../_shared/email/resend';
import type { Env } from '../../_shared/env';
import { getDb } from '../../_shared/db';
import { classifyVisitor, escapeHtml, newId } from '../../_shared/marketing/visitors';

const visitSchema = z.object({
  visitorId: z.string().min(8).max(64),
  path: z.string().max(500).optional(),
  referrer: z.string().max(2000).optional(),
});

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const parsed = visitSchema.safeParse(await context.request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { visitorId, path = '/', referrer } = parsed.data;
    const userAgent = context.request.headers.get('user-agent');
    const visitorKind = classifyVisitor(userAgent);
    const db = getDb(context.env);

    const [existing] = await db
      .select()
      .from(siteVisitors)
      .where(eq(siteVisitors.id, visitorId))
      .limit(1);

    const isNewVisitor = !existing;
    const visitId = newId('visit');

    if (isNewVisitor) {
      await db.insert(siteVisitors).values({
        id: visitorId,
        firstReferrer: referrer ?? null,
        firstUserAgent: userAgent ?? null,
        visitorKind,
      });
      await db
        .update(siteStats)
        .set({
          totalVisits: sql`${siteStats.totalVisits} + 1`,
          uniqueVisitors: sql`${siteStats.uniqueVisitors} + 1`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(siteStats.id, 'global'));
    } else {
      await db
        .update(siteVisitors)
        .set({
          lastSeenAt: new Date().toISOString(),
          visitCount: sql`${siteVisitors.visitCount} + 1`,
        })
        .where(eq(siteVisitors.id, visitorId));
      await db
        .update(siteStats)
        .set({
          totalVisits: sql`${siteStats.totalVisits} + 1`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(siteStats.id, 'global'));
    }

    await db.insert(siteVisits).values({
      id: visitId,
      visitorId,
      path,
      referrer: referrer ?? null,
      userAgent: userAgent ?? null,
      visitorKind,
      isNewVisitor: isNewVisitor ? 1 : 0,
    });

    if (isNewVisitor) {
      const alertEmail = context.env.ERROR_ALERT_EMAIL;
      if (alertEmail) {
        const kindLabel = visitorKind === 'human' ? 'Likely human' : visitorKind === 'bot' ? 'Likely bot/agent' : 'Unknown';
        await sendEmail(context.env, {
          to: alertEmail,
          subject: `[ruwt.ai] New visitor (${kindLabel})`,
          html: [
            '<h2>New ruwt.ai visitor</h2>',
            `<p><strong>Kind:</strong> ${escapeHtml(kindLabel)}</p>`,
            `<p><strong>Path:</strong> ${escapeHtml(path)}</p>`,
            `<p><strong>Referrer:</strong> ${escapeHtml(referrer || 'Direct')}</p>`,
            `<p><strong>User agent:</strong> ${escapeHtml(userAgent || 'Unknown')}</p>`,
            `<p><strong>Visitor ID:</strong> <code>${escapeHtml(visitorId)}</code></p>`,
          ].join('\n'),
        });
      }
    }

    const [stats] = await db.select().from(siteStats).where(eq(siteStats.id, 'global')).limit(1);

    return Response.json({
      ok: true,
      isNewVisitor,
      visitorKind,
      stats: {
        totalVisits: stats?.totalVisits ?? 0,
        uniqueVisitors: stats?.uniqueVisitors ?? 0,
      },
    });
  } catch (error) {
    console.error('Visit tracking error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
