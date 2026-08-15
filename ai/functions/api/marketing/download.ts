import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { downloadClicks, siteStats } from '../../../drizzle/schema.d1';
import { sendEmail } from '../../_shared/email/resend';
import type { Env } from '../../_shared/env';
import { getDb } from '../../_shared/db';
import { classifyVisitor, escapeHtml, kindLabel, newId } from '../../_shared/marketing/visitors';
import { getMarketingSnapshot, snapshotEmailLines } from '../../_shared/marketing/stats';

const downloadSchema = z.object({
  visitorId: z.string().min(8).max(64).optional(),
  platform: z.enum(['macos', 'windows', 'linux', 'unknown']),
  source: z.enum(['header', 'landing', 'download-page']).default('header'),
});

const INSTALL_COMMAND = 'curl -fsSL https://ruwt.ai/install.sh | bash';
const ARTIFACTS: Record<string, { url: string; filename: string }> = {
  macos: { url: '/downloads/Ruwt.dmg', filename: 'Ruwt.dmg' },
  windows: { url: '/downloads/Ruwt-Setup.exe', filename: 'Ruwt-Setup.exe' },
  linux: { url: '/downloads/ruwt-linux-amd64', filename: 'ruwt-linux-amd64' },
  unknown: { url: '/downloads/Ruwt.dmg', filename: 'Ruwt.dmg' },
};

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const parsed = downloadSchema.safeParse(await context.request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { visitorId, platform, source } = parsed.data;
    const userAgent = context.request.headers.get('user-agent');
    const db = getDb(context.env);
    const clickId = newId('dl');
    const artifact = ARTIFACTS[platform] ?? ARTIFACTS.macos;

    await db.insert(downloadClicks).values({
      id: clickId,
      visitorId: visitorId ?? null,
      platform,
      source,
      userAgent: userAgent ?? null,
    });

    await db
      .update(siteStats)
      .set({
        totalDownloadClicks: sql`${siteStats.totalDownloadClicks} + 1`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(siteStats.id, 'global'));

    const alertEmail = context.env.ERROR_ALERT_EMAIL;
    if (alertEmail) {
      const kind = classifyVisitor(userAgent);
      const snap = await getMarketingSnapshot(db);
      await sendEmail(context.env, {
        to: alertEmail,
        subject: `[ruwt.ai] Download click #${snap.totals.downloads} (${platform})`,
        html: [
          '<h2>ruwt.ai download click</h2>',
          ...snapshotEmailLines(snap),
          `<p><strong>Platform:</strong> ${escapeHtml(platform)}</p>`,
          `<p><strong>Source:</strong> ${escapeHtml(source)}</p>`,
          `<p><strong>Visitor kind:</strong> ${escapeHtml(kindLabel(kind))}</p>`,
          `<p><strong>Visitor ID:</strong> ${escapeHtml(visitorId || 'anonymous')}</p>`,
        ].join('\n'),
      });
    }

    const [stats] = await db.select().from(siteStats).where(eq(siteStats.id, 'global')).limit(1);

    return Response.json({
      ok: true,
      url: artifact.url,
      filename: artifact.filename,
      installCommand: INSTALL_COMMAND,
      stats: {
        totalDownloadClicks: stats?.totalDownloadClicks ?? 0,
      },
    });
  } catch (error) {
    console.error('Download tracking error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
