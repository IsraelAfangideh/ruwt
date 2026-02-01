import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { db, profiles, transactions } from '@/drizzle';
import { eq, sql } from 'drizzle-orm';
import Stripe from 'stripe';

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      
      if (session.payment_status === 'paid' && session.metadata?.userId && session.metadata?.credits) {
        const userId = session.metadata.userId;
        const credits = parseInt(session.metadata.credits, 10);

        try {
          // Add credits to user
          await db
            .update(profiles)
            .set({
              credits: sql`${profiles.credits} + ${credits}`,
            })
            .where(eq(profiles.id, userId));

          // Record transaction
          await db.insert(transactions).values({
            userId,
            type: 'purchase',
            amount: credits,
            stripeId: session.id,
          });

          console.log(`Added ${credits} credits to user ${userId}`);
        } catch (err) {
          console.error('Failed to add credits:', err);
          return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`Payment failed: ${paymentIntent.id}`);
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
