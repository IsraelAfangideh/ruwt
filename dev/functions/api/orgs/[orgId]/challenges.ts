/**
 * GET  /api/orgs/:orgId/challenges — List org's custom challenges (any member)
 * POST /api/orgs/:orgId/challenges — Create custom challenge manually (admin/owner)
 * Auth required for all.
 */
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../_shared/db';
import { getUser } from '../../../_shared/auth';
import { requireOrgAccess } from '../../../_shared/org';
import { customChallenges } from '../../../../drizzle/schema.d1';

const createChallengeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(10000),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  category: z.string().max(100).optional().default('practice'),
  skillTested: z.string().max(500).optional(),
  language: z.enum(['javascript', 'typescript', 'python']).optional().default('javascript'),
  starterCode: z.string().max(50000).optional(),
  testCases: z.string().max(50000),
  hiddenTestCases: z.string().max(50000).optional(),
  testHarness: z.string().max(50000).optional(),
  tags: z.string().max(2000).optional(),
});

export async function onRequestGet(context: { request: Request; env: Env; params: { orgId: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    const orgId = context.params.orgId;

    // Any org member can list challenges
    const role = await requireOrgAccess(db, user.id, orgId, 'viewer');
    if (!role) {
      return Response.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    const challenges = await db
      .select()
      .from(customChallenges)
      .where(eq(customChallenges.orgId, orgId))
      .orderBy(desc(customChallenges.createdAt));

    return Response.json(challenges);
  } catch (error) {
    console.error('List custom challenges error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function onRequestPost(context: { request: Request; env: Env; params: { orgId: string } }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    const orgId = context.params.orgId;

    // Admin or owner required to create challenges
    const callerRole = await requireOrgAccess(db, user.id, orgId, 'admin');
    if (!callerRole) {
      return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await context.request.json().catch(() => ({}));
    const parsed = createChallengeSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const challengeId = `custom-${crypto.randomUUID().slice(0, 8)}`;

    await db.insert(customChallenges).values({
      id: challengeId,
      orgId,
      title: data.title,
      description: data.description,
      difficulty: data.difficulty,
      category: data.category,
      skillTested: data.skillTested,
      language: data.language,
      starterCode: data.starterCode,
      testCases: data.testCases,
      hiddenTestCases: data.hiddenTestCases,
      testHarness: data.testHarness,
      tags: data.tags,
      status: 'draft',
      aiGenerated: 0,
      createdBy: user.id,
    });

    const [created] = await db
      .select()
      .from(customChallenges)
      .where(eq(customChallenges.id, challengeId))
      .limit(1);

    return Response.json(created, { status: 201 });
  } catch (error) {
    console.error('Create custom challenge error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
