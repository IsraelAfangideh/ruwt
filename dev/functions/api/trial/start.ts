/**
 * POST /api/trial/start
 * Start a 30-day free trial by redirecting to Stripe Checkout.
 * Stripe collects CC and creates a subscription with trial_period_days=30.
 * Org creation + trial activation happens in the webhook on checkout.session.completed.
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../../_shared/db';
import { getUser } from '../../_shared/auth';
import { canStartTrial, getUserOrg } from '../../_shared/org';
import { organizations } from '../../../drizzle/schema.d1';

// Personal email domains where we should NOT derive org name from domain
const PERSONAL_DOMAINS = new Set([
  'gmail', 'yahoo', 'hotmail', 'outlook', 'aol', 'icloud', 'protonmail',
  'mail', 'live', 'msn', 'pm', 'hey', 'fastmail', 'zoho', 'yandex',
  'gmx', 'tutanota', 'proton',
]);

export function deriveOrgName(email: string): string {
  /* istanbul ignore next -- @preserve */
  if (!email.includes('@')) return 'My Team';
  const domain = email.split('@')[1].split('.')[0].toLowerCase();
  if (PERSONAL_DOMAINS.has(domain)) return 'My Team';
  return `${domain.charAt(0).toUpperCase() + domain.slice(1)} Team`;
}

export async function onRequestPost(context: { request: Request; env: Env; waitUntil?: (p: Promise<unknown>) => void }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);

    const eligibility = await canStartTrial(db, user.id);
    if (!eligibility.eligible) {
      /* istanbul ignore next -- @preserve */
      return Response.json(
        { error: eligibility.reason || 'Not eligible for trial', code: 'TRIAL_NOT_ELIGIBLE' },
        { status: 403 },
      );
    }

    const stripeKey = (context.env as Record<string, string>).STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return Response.json({ error: 'Payment system not configured' }, { status: 503 });
    }

    const origin = new URL(context.request.url).origin;
    const userEmail = user.email || '';
    const userName = (user.user_metadata?.full_name ?? user.user_metadata?.name) as string | null ?? null;

    // Check for existing org (owner/admin can start trial on it)
    const userOrg = await getUserOrg(db, user.id);
    if (userOrg && userOrg.role !== 'owner' && userOrg.role !== 'admin') {
      return Response.json(
        { error: 'Only org owners can start a trial', code: 'TRIAL_NOT_ELIGIBLE' },
        { status: 403 },
      );
    }

    // Find or create Stripe Customer
    let stripeCustomerId = userOrg?.org.stripeCustomerId ?? null;
    const orgName = userOrg?.org.name ?? deriveOrgName(userEmail);

    if (!stripeCustomerId) {
      const custParams = new URLSearchParams();
      custParams.append('email', userEmail);
      custParams.append('metadata[userId]', user.id);
      if (userName) custParams.append('name', userName);

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

      // Save customer ID to existing org if applicable
      if (userOrg) {
        await db.update(organizations)
          .set({ stripeCustomerId: customer.id })
          .where(eq(organizations.id, userOrg.org.id));
      }
    }

    // Create Stripe Checkout Session with 30-day trial on monthly subscription
    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('customer', stripeCustomerId);
    params.append('line_items[0][quantity]', '1');
    params.append('line_items[0][price_data][currency]', 'usd');
    params.append('line_items[0][price_data][product_data][name]', 'Ruwt.dev Monthly Subscription');
    params.append('line_items[0][price_data][unit_amount]', '20000');
    params.append('line_items[0][price_data][recurring][interval]', 'month');
    params.append('subscription_data[trial_period_days]', '30');
    params.append('success_url', `${origin}/org?trial_started=true`);
    params.append('cancel_url', `${origin}/teams`);
    params.append('metadata[userId]', user.id);
    params.append('metadata[type]', 'trial_subscription');
    params.append('metadata[orgName]', orgName);
    params.append('metadata[userEmail]', userEmail);
    if (userName) params.append('metadata[userName]', userName);
    if (userOrg) params.append('metadata[orgId]', userOrg.org.id);

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
      console.error('Stripe checkout error:', err);
      return Response.json({ error: 'Failed to create checkout session' }, { status: 502 });
    }

    const session = await stripeRes.json() as { url: string };
    return Response.json({ url: session.url });
  } catch (error) {
    /* istanbul ignore next -- @preserve */
    console.error('Trial start error:', error);
    /* istanbul ignore next -- @preserve */
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
