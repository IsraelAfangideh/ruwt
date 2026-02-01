import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, attempts, challenges, profiles } from '@/drizzle';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

const createAttemptSchema = z.object({
  challengeId: z.string().uuid(),
});

// Create a new attempt
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createAttemptSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { challengeId } = parsed.data;

    // Verify challenge exists
    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Check if user already has an in-progress attempt
    const [existingAttempt] = await db
      .select()
      .from(attempts)
      .where(
        and(
          eq(attempts.userId, user.id),
          eq(attempts.challengeId, challengeId),
          eq(attempts.status, 'in_progress')
        )
      )
      .limit(1);

    if (existingAttempt) {
      // Return the existing attempt
      return NextResponse.json({
        attempt: existingAttempt,
        challenge,
        isExisting: true,
      });
    }

    // Calculate expiration time if challenge has a time limit
    let expiresAt: Date | null = null;
    if (challenge.wallClockLimit) {
      expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + challenge.wallClockLimit);
    }

    // Create new attempt
    const [newAttempt] = await db
      .insert(attempts)
      .values({
        userId: user.id,
        challengeId,
        status: 'in_progress',
        totalCost: 0,
        inputTokens: 0,
        outputTokens: 0,
        passedTests: 0,
        totalTests: (challenge.testCases as Array<unknown>).length,
        expiresAt,
      })
      .returning();

    return NextResponse.json({
      attempt: newAttempt,
      challenge,
      isExisting: false,
    });
  } catch (error) {
    console.error('Create attempt error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get user's attempts
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const challengeId = searchParams.get('challengeId');

    const whereCondition = challengeId
      ? and(eq(attempts.userId, user.id), eq(attempts.challengeId, challengeId))
      : eq(attempts.userId, user.id);

    const results = await db
      .select({
        attempt: attempts,
        challenge: {
          id: challenges.id,
          title: challenges.title,
          difficulty: challenges.difficulty,
        },
      })
      .from(attempts)
      .innerJoin(challenges, eq(attempts.challengeId, challenges.id))
      .where(whereCondition)
      .orderBy(desc(attempts.createdAt))
      .limit(50);

    return NextResponse.json({
      attempts: results.map((r) => ({
        ...r.attempt,
        challenge: r.challenge,
      })),
    });
  } catch (error) {
    console.error('Get attempts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
