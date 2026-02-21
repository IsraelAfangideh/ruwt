/**
 * POST /api/webhooks/stripe
 * Verify signature and handle Stripe events.
 * Fulfills credit purchases and manages subscription lifecycle.
 */
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../_shared/db';
import { profiles, transactions, organizations } from '../../../drizzle/schema.d1';

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

  const db = getDb(context.env);

  // --- checkout.session.completed ---
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as {
      payment_status?: string;
      metadata?: {
        userId?: string;
        type?: string;
        credits?: string;
        assessments?: string;
        packageId?: string;
        orgId?: string;
        plan?: string;
      };
      id?: string;
      subscription?: string;
      customer?: string;
    };

    if (session.payment_status !== 'paid' || !session.metadata?.userId) {
      return Response.json({ received: true });
    }

    const { userId, type: purchaseType } = session.metadata;
    const stripeSessionId = session.id ?? null;

    try {
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

      if (purchaseType === 'subscription' && session.metadata.orgId) {
        // Subscription checkout completed
        const orgId = session.metadata.orgId;
        const planId = session.metadata.plan ?? 'plan-monthly';
        const subscriptionPlan = planId === 'plan-annual' ? 'annual' : 'monthly';

        await db
          .update(organizations)
          .set({
            stripeSubscriptionId: session.subscription ?? null,
            stripeCustomerId: (session.customer as string) ?? null,
            subscriptionStatus: 'active',
            subscriptionPlan,
          })
          .where(eq(organizations.id, orgId));

        // Log transaction
        await db.insert(transactions).values({
          id: crypto.randomUUID(),
          userId: userId!,
          type: 'subscription_start',
          amount: 0,
          stripeId: stripeSessionId,
        });
      } else if (purchaseType === 'assessment' && session.metadata.assessments) {
        // Legacy assessment pack purchase (backward compat)
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
        // Credit purchase
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

  // --- customer.subscription.updated ---
  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as {
      id?: string;
      status?: string;
      cancel_at_period_end?: boolean;
      current_period_end?: number;
    };

    if (sub.id) {
      const [org] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.stripeSubscriptionId, sub.id))
        .limit(1);

      if (org) {
        let subscriptionStatus: string;
        if (sub.cancel_at_period_end) {
          subscriptionStatus = 'canceled';
        } else if (sub.status === 'active') {
          subscriptionStatus = 'active';
        } else if (sub.status === 'past_due') {
          subscriptionStatus = 'past_due';
        } else {
          subscriptionStatus = sub.status ?? 'none';
        }

        await db
          .update(organizations)
          .set({
            subscriptionStatus,
            subscriptionEndsAt: sub.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString()
              : null,
          })
          .where(eq(organizations.id, org.id));
      }
    }
  }

  // --- customer.subscription.deleted ---
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as { id?: string };

    if (sub.id) {
      await db
        .update(organizations)
        .set({
          subscriptionStatus: 'canceled',
          subscriptionEndsAt: new Date().toISOString(),
        })
        .where(eq(organizations.stripeSubscriptionId, sub.id));
    }
  }

  // --- invoice.payment_succeeded ---
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as {
      subscription?: string;
      lines?: { data?: Array<{ period?: { end?: number } }> };
    };

    if (invoice.subscription) {
      const [org] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.stripeSubscriptionId, invoice.subscription))
        .limit(1);

      if (org) {
        const periodEnd = invoice.lines?.data?.[0]?.period?.end;
        await db
          .update(organizations)
          .set({
            subscriptionStatus: 'active',
            subscriptionEndsAt: periodEnd
              ? new Date(periodEnd * 1000).toISOString()
              : null,
          })
          .where(eq(organizations.id, org.id));
      }
    }
  }

  // --- invoice.payment_failed ---
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as { subscription?: string };

    if (invoice.subscription) {
      await db
        .update(organizations)
        .set({ subscriptionStatus: 'past_due' })
        .where(eq(organizations.stripeSubscriptionId, invoice.subscription));
    }
  }

  return Response.json({ received: true });
}
