/**
 * GET /api/certificates - List user's certificates
 * POST /api/certificates/check - Check and auto-award certificates
 */
import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '../_shared/db';
import { getUser } from '../_shared/auth';
import { certificates, attempts, challenges, profiles } from '../../drizzle/schema.d1';

// Track definitions: which challenges must be completed for each certificate
const TRACKS: Record<string, { title: string; type: string; challengeIds?: string[]; filter?: { category?: string; language?: string } }> = {
  qa_master: {
    title: 'QA Testing Master',
    type: 'track_completion',
    filter: { category: 'qa_testing' },
  },
  python_proficiency: {
    title: 'Python Proficiency',
    type: 'track_completion',
    filter: { language: 'python' },
  },
  frontend_engineer: {
    title: 'Frontend Engineering',
    type: 'track_completion',
    filter: { category: 'frontend' },
  },
  backend_engineer: {
    title: 'Backend API Engineering',
    type: 'track_completion',
    filter: { category: 'backend_api' },
  },
  data_engineer: {
    title: 'Data Engineering',
    type: 'track_completion',
    filter: { category: 'data_engineering' },
  },
  devops_engineer: {
    title: 'DevOps Engineering',
    type: 'track_completion',
    filter: { category: 'devops' },
  },
};

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb(context.env);
    const certs = await db
      .select()
      .from(certificates)
      .where(eq(certificates.userId, user.id))
      .orderBy(certificates.earnedAt);

    return Response.json({
      certificates: certs.map((c) => ({
        ...c,
        metadata: c.metadata ? (() => { try { return JSON.parse(c.metadata); } catch { return null; } })() : null,
      })),
    });
  } catch (error) {
    console.error('Certificates list error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb(context.env);
    const awarded: string[] = [];

    // Get all challenges the user has passed
    const passedAttempts = await db
      .select({
        challengeId: attempts.challengeId,
        totalCost: attempts.totalCost,
      })
      .from(attempts)
      .where(and(eq(attempts.userId, user.id), eq(attempts.status, 'passed')));

    const passedChallengeIds = new Set(passedAttempts.map((a) => a.challengeId));

    // Get all challenges to match against track filters
    const allChallenges = await db
      .select({
        id: challenges.id,
        category: challenges.category,
        language: challenges.language,
      })
      .from(challenges);

    // Check each track
    for (const [trackKey, track] of Object.entries(TRACKS)) {
      // Check if user already has this certificate
      const existing = await db
        .select({ id: certificates.id })
        .from(certificates)
        .where(and(
          eq(certificates.userId, user.id),
          eq(certificates.title, track.title),
        ))
        .limit(1);

      if (existing.length > 0) continue;

      // Find challenges in this track
      let trackChallenges: string[];
      /* istanbul ignore next -- @preserve */
      if (track.challengeIds) {
        /* istanbul ignore next -- @preserve */
        trackChallenges = track.challengeIds;
      } else if (track.filter) {
        trackChallenges = allChallenges
          .filter((c) => {
            if (track.filter!.category && c.category !== track.filter!.category) return false;
            /* istanbul ignore next -- @preserve */
            if (track.filter!.language && (c.language || 'javascript') !== track.filter!.language) return false;
            return true;
          })
          .map((c) => c.id);
      /* istanbul ignore next -- @preserve */
      } else {
        /* istanbul ignore next -- @preserve */
        continue;
      }

      // Skip tracks with no challenges yet
      if (trackChallenges.length === 0) continue;

      // Check if user has passed all challenges in the track
      const allPassed = trackChallenges.every((id) => passedChallengeIds.has(id));
      if (!allPassed) continue;

      // Calculate avg cost for this track
      const trackAttempts = passedAttempts.filter((a) => trackChallenges.includes(a.challengeId));
      const avgCost = trackAttempts.reduce((sum, a) => sum + a.totalCost, 0) / trackAttempts.length;

      // Award certificate
      const certId = crypto.randomUUID();
      const shareToken = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

      await db.insert(certificates).values({
        id: certId,
        userId: user.id,
        type: track.type,
        title: track.title,
        metadata: JSON.stringify({
          track: trackKey,
          challengesSolved: trackChallenges.length,
          avgCost: Math.round(avgCost),
        }),
        shareToken,
      });

      awarded.push(track.title);
    }

    return Response.json({ awarded, checked: Object.keys(TRACKS).length });
  } catch (error) {
    console.error('Certificate check error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
