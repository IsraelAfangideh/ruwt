/**
 * POST /api/webhooks/stripe
 * Verify signature and handle checkout.session.completed (add credits, record transaction).
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
      metadata?: { userId?: string; credits?: string };
      id?: string;
    };
    if (
      session.payment_status === 'paid' &&
      session.metadata?.userId &&
      session.metadata?.credits
    ) {
      const userId = session.metadata.userId;
      const credits = parseInt(session.metadata.credits, 10);
      if (!Number.isFinite(credits) || credits <= 0) {
        return Response.json({ error: 'Invalid credits' }, { status: 400 });
      }
      try {
        const db = getDb(context.env);
        await db
          .update(profiles)
          .set({ credits: sql`${profiles.credits} + ${credits}` })
          .where(eq(profiles.id, userId));

        await db.insert(transactions).values({
          id: crypto.randomUUID(),
          userId,
          type: 'purchase',
          amount: credits,
          stripeId: session.id ?? null,
        });
      } catch (err) {
        console.error('Failed to add credits:', err);
        return Response.json({ error: 'Database error' }, { status: 500 });
      }
    }
  }

  return Response.json({ received: true });
}
