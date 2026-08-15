import { desc, eq, sql } from 'drizzle-orm';
import { downloadClicks, siteStats, siteVisits } from '../../../drizzle/schema.d1';
import type { Db } from '../db';

function asCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export type MarketingSnapshot = {
  totals: { visits: number; uniqueVisitors: number; downloads: number };
  today: {
    visits: number;
    newVisitors: number;
    downloads: number;
    humanVisits: number;
    botVisits: number;
  };
  recentVisits: Array<{
    id: string;
    path: string;
    referrer: string | null;
    visitorKind: string;
    isNewVisitor: boolean;
    createdAt: string;
  }>;
  recentDownloads: Array<{
    id: string;
    platform: string;
    source: string;
    createdAt: string;
  }>;
};

export async function getMarketingSnapshot(db: Db): Promise<MarketingSnapshot> {
  const [totals] = await db.select().from(siteStats).where(eq(siteStats.id, 'global')).limit(1);

  const today = sql`date(${siteVisits.createdAt}) = date('now')`;
  const todayDl = sql`date(${downloadClicks.createdAt}) = date('now')`;

  const [visitRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(siteVisits)
    .where(today);
  const [newRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(siteVisits)
    .where(sql`date(${siteVisits.createdAt}) = date('now') AND ${siteVisits.isNewVisitor} = 1`);
  const [dlRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(downloadClicks)
    .where(todayDl);
  const kindRows = await db
    .select({
      kind: siteVisits.visitorKind,
      n: sql<number>`count(*)`,
    })
    .from(siteVisits)
    .where(today)
    .groupBy(siteVisits.visitorKind);

  const kinds = Object.fromEntries(kindRows.map((row) => [row.kind, asCount(row.n)]));

  const visits = await db.select().from(siteVisits).orderBy(desc(siteVisits.createdAt)).limit(40);
  const downloads = await db
    .select()
    .from(downloadClicks)
    .orderBy(desc(downloadClicks.createdAt))
    .limit(20);

  return {
    totals: {
      visits: totals?.totalVisits ?? 0,
      uniqueVisitors: totals?.uniqueVisitors ?? 0,
      downloads: totals?.totalDownloadClicks ?? 0,
    },
    today: {
      visits: asCount(visitRow?.n),
      newVisitors: asCount(newRow?.n),
      downloads: asCount(dlRow?.n),
      humanVisits: kinds.human ?? 0,
      botVisits: kinds.bot ?? 0,
    },
    recentVisits: visits.map((row) => ({
      id: row.id,
      path: row.path,
      referrer: row.referrer,
      visitorKind: row.visitorKind,
      isNewVisitor: row.isNewVisitor === 1,
      createdAt: row.createdAt,
    })),
    recentDownloads: downloads.map((row) => ({
      id: row.id,
      platform: row.platform,
      source: row.source,
      createdAt: row.createdAt,
    })),
  };
}

export function snapshotEmailLines(snap: MarketingSnapshot): string[] {
  const { totals, today } = snap;
  return [
    `<p><strong>Site:</strong> ${totals.visits} visits · ${totals.uniqueVisitors} unique · ${totals.downloads} downloads</p>`,
    `<p><strong>Today:</strong> ${today.visits} visits · ${today.newVisitors} new · ${today.downloads} downloads · ${today.humanVisits} human / ${today.botVisits} bot</p>`,
  ];
}
