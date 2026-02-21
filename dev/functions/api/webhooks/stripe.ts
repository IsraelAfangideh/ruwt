/**
 * POST /api/webhooks/stripe
 * Verify signature and handle checkout.session.completed.
 * Fulfills both credit purchases and assessment pack purchases.
 */
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../_shared/db';
import { profiles, transactions } from '../../../drizzle/schema.d1';

async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const parts = signature.split(',');
  const v1Part = parts.find((p) => p.startsWith('v1='));
  if (!v1Part) return false;
  const expectedSig = v1Part.slice(3);
  const tPart = parts.find((p) => p.startsWith('t='));
  if (!tPart) return false;
  const timestamp = tPart.slice(2);
  const signedPayload = `${timestamp}.${payload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signedPayload)
  );
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex === expectedSig;
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const signature = context.request.headers.get('stripe-signature');
  if (!signature) {
    return Response.json({ error: 'Missing signature' }, { status: 400 });
  }

  const secret = context.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET not set');
    return Response.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const body = await context.request.text();
  const valid = await verifyStripeSignature(body, signature, secret);
  if (!valid) {
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(body) as {
      type: string;
      data: { object: Record<string, unknown> };
    };
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as {
      payment_status?: string;
      metadata?: {
        userId?: string;
        type?: string;
        credits?: string;
        assessments?: string;
        packageId?: string;
      };
      id?: string;
    };

    if (session.payment_status !== 'paid' || !session.metadata?.userId) {
      return Response.json({ received: true });
    }

    const { userId, type: purchaseType } = session.metadata;
    const stripeSessionId = session.id ?? null;

    try {
      const db = getDb(context.env);

      // Idempotency check
      if (stripeSessionId) {
        const [existing] = await db
          .select({ id: transactions.id })
          .from(transactions)
          .where(eq(transactions.stripeId, stripeSessionId))
          .limit(1);
        if (existing) {
          return Response.json({ received: true, note: 'already processed' });
        }
      }

      if (purchaseType === 'assessment' && session.metadata.assessments) {
        const assessmentCredits = parseInt(session.metadata.assessments, 10);
        if (!Number.isFinite(assessmentCredits) || assessmentCredits <= 0) {
          return Response.json({ error: 'Invalid assessment credits' }, { status: 400 });
        }

        await db.insert(transactions).values({
          id: crypto.randomUUID(),
          userId: userId!,
          type: 'assessment_purchase',
          amount: assessmentCredits,
          stripeId: stripeSessionId,
        });

        await db
          .update(profiles)
          .set({
            assessmentCredits: sql`${profiles.assessmentCredits} + ${assessmentCredits}`,
            accountType: 'team',
          })
          .where(eq(profiles.id, userId!));
      } else if (session.metadata.credits) {
        const credits = parseInt(session.metadata.credits, 10);
        if (!Number.isFinite(credits) || credits <= 0) {
          return Response.json({ error: 'Invalid credits' }, { status: 400 });
        }

        await db.insert(transactions).values({
          id: crypto.randomUUID(),
          userId: userId!,
          type: 'purchase',
          amount: credits,
          stripeId: stripeSessionId,
        });

        await db
          .update(profiles)
          .set({ credits: sql`${profiles.credits} + ${credits}` })
          .where(eq(profiles.id, userId!));
      }
    } catch (err) {
      console.error('Failed to fulfill purchase:', err);
      return Response.json({ error: 'Database error' }, { status: 500 });
    }
  }

  return Response.json({ received: true });
}
