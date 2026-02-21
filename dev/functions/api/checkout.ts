/**
 * POST /api/checkout
 * Create a Stripe Checkout Session for credit purchase or subscription.
 */
import { eq } from 'drizzle-orm';
import { getUser } from '../_shared/auth';
import { getDb } from '../_shared/db';
import { getUserOrg } from '../_shared/org';
import { organizations } from '../../drizzle/schema.d1';

interface CreditPackage {
  id: string;
  credits: number;
  priceInCents: number;
  label: string;
}

interface SubscriptionPlan {
  id: string;
  priceInCents: number;
  interval: 'month' | 'year';
  label: string;
}

const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'credits-5000', credits: 5000, priceInCents: 499, label: '5,000 Credits' },
  { id: 'credits-25000', credits: 25000, priceInCents: 1499, label: '25,000 Credits' },
  { id: 'credits-100000', credits: 100000, priceInCents: 3999, label: '100,000 Credits' },
];

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { id: 'plan-monthly', priceInCents: 20000, interval: 'month', label: 'Monthly Subscription' },
  { id: 'plan-annual', priceInCents: 180000, interval: 'year', label: 'Annual Subscription' },
];

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await context.request.json().catch(() => ({})) as {
      packageId?: string;
      type?: 'credits' | 'subscription';
    };
    const { packageId, type = 'credits' } = body;

    if (!packageId) {
      return Response.json({ error: 'Missing packageId' }, { status: 400 });
    }

    const stripeKey = (context.env as Record<string, string>).STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return Response.json({ error: 'Payment system not configured' }, { status: 503 });
    }

    const origin = new URL(context.request.url).origin;

    if (type === 'subscription') {
      const plan = SUBSCRIPTION_PLANS.find((p) => p.id === packageId);
      if (!plan) {
        return Response.json({ error: 'Invalid subscription plan' }, { status: 400 });
      }

      const db = getDb(context.env);
      const userOrg = await getUserOrg(db, user.id);

      if (!userOrg) {
        return Response.json(
          { error: 'Create an organization first before subscribing.' },
          { status: 400 }
        );
      }

      // Find or create Stripe Customer
      let stripeCustomerId = userOrg.org.stripeCustomerId;

      if (!stripeCustomerId) {
        const custParams = new URLSearchParams();
        custParams.append('email', user.email);
        custParams.append('metadata[orgId]', userOrg.org.id);
        custParams.append('metadata[userId]', user.id);
        custParams.append('name', userOrg.org.name);

        const custRes = await fetch('https://api.stripe.com/v1/customers', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: custParams.toString(),
        });

        if (!custRes.ok) {
          console.error('Stripe customer creation error:', await custRes.text());
          return Response.json({ error: 'Failed to create billing account' }, { status: 502 });
        }

        const customer = await custRes.json() as { id: string };
        stripeCustomerId = customer.id;

        // Save customer ID to org
        await db
          .update(organizations)
          .set({ stripeCustomerId: customer.id })
          .where(eq(organizations.id, userOrg.org.id));
      }

      // Create subscription Checkout Session
      const params = new URLSearchParams();
      params.append('mode', 'subscription');
      params.append('customer', stripeCustomerId);
      params.append('line_items[0][quantity]', '1');
      params.append('line_items[0][price_data][currency]', 'usd');
      params.append(
        'line_items[0][price_data][product_data][name]',
        `Ruwt.dev ${plan.interval === 'year' ? 'Annual' : 'Monthly'} Subscription`
      );
      params.append('line_items[0][price_data][unit_amount]', String(plan.priceInCents));
      params.append('line_items[0][price_data][recurring][interval]', plan.interval);
      params.append('success_url', `${origin}/org?subscribed=true`);
      params.append('cancel_url', `${origin}/teams`);
      params.append('metadata[userId]', user.id);
      params.append('metadata[orgId]', userOrg.org.id);
      params.append('metadata[type]', 'subscription');
      params.append('metadata[plan]', plan.id);

      const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!stripeRes.ok) {
        const err = await stripeRes.text();
        console.error('Stripe error:', err);
        return Response.json({ error: 'Failed to create checkout session' }, { status: 502 });
      }

      const session = await stripeRes.json() as { url: string };
      return Response.json({ url: session.url });
    }

    // Credit purchase (existing flow)
    const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) {
      return Response.json({ error: 'Invalid package' }, { status: 400 });
    }

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('line_items[0][quantity]', '1');
    params.append('line_items[0][price_data][currency]', 'usd');
    params.append('success_url', `${origin}/settings?purchased=true`);
    params.append('cancel_url', `${origin}/settings`);
    params.append('line_items[0][price_data][product_data][name]', pkg.label);
    params.append(
      'line_items[0][price_data][product_data][description]',
      `${pkg.credits} AI credits for ruwt.dev`
    );
    params.append('line_items[0][price_data][unit_amount]', String(pkg.priceInCents));
    params.append('metadata[userId]', user.id);
    params.append('metadata[type]', 'credits');
    params.append('metadata[credits]', String(pkg.credits));
    params.append('metadata[packageId]', pkg.id);

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!stripeRes.ok) {
      const err = await stripeRes.text();
      console.error('Stripe error:', err);
      return Response.json({ error: 'Failed to create checkout session' }, { status: 502 });
    }

    const session = await stripeRes.json() as { url: string };
    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
