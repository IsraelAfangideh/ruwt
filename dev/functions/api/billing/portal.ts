/**
 * POST /api/billing/portal
 * Create a Stripe Billing Portal session for subscription management.
 * Redirects user to Stripe-hosted portal to manage/cancel subscription.
 */
import { getUser } from '../../_shared/infra/auth';
import { getDb } from '../../_shared/infra/db';
import { getUserOrg } from '../../_shared/org';

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stripeKey = (context.env as Record<string, string>).STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return Response.json({ error: 'Billing not configured' }, { status: 503 });
    }

    const db = getDb(context.env);
    const userOrg = await getUserOrg(db, user.id);

    if (!userOrg?.org.stripeCustomerId) {
      return Response.json({ error: 'No billing account found' }, { status: 404 });
    }

    const origin = new URL(context.request.url).origin;
    const params = new URLSearchParams();
    params.append('customer', userOrg.org.stripeCustomerId);
    params.append('return_url', `${origin}/org`);

    const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      console.error('Portal error:', await res.text());
      return Response.json({ error: 'Failed to create portal session' }, { status: 502 });
    }

    const session = await res.json() as { url: string };
    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Billing portal error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
