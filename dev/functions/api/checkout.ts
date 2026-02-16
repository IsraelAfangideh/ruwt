/**
 * POST /api/checkout
 * Create a Stripe Checkout Session for credit purchase.
 */
import { getUser } from '../_shared/auth';

interface CreditPackage {
  id: string;
  credits: number;
  priceInCents: number;
  label: string;
}

const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'credits-500', credits: 500, priceInCents: 500, label: '500 Credits' },
  { id: 'credits-2000', credits: 2000, priceInCents: 1500, label: '2,000 Credits' },
  { id: 'credits-5000', credits: 5000, priceInCents: 3000, label: '5,000 Credits' },
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

    const body = await context.request.json().catch(() => ({})) as { packageId?: string };
    const { packageId } = body;

    if (!packageId) {
      return Response.json({ error: 'Missing packageId' }, { status: 400 });
    }

    const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) {
      return Response.json({ error: 'Invalid package' }, { status: 400 });
    }

    const stripeKey = (context.env as Record<string, string>).STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return Response.json({ error: 'Payment system not configured' }, { status: 503 });
    }

    const origin = new URL(context.request.url).origin;

    // Create Stripe Checkout Session via API (no SDK needed in Workers)
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${origin}/settings?purchased=true`);
    params.append('cancel_url', `${origin}/settings`);
    params.append('line_items[0][price_data][currency]', 'usd');
    params.append('line_items[0][price_data][product_data][name]', pkg.label);
    params.append('line_items[0][price_data][product_data][description]', `${pkg.credits} AI credits for ruwt.dev`);
    params.append('line_items[0][price_data][unit_amount]', String(pkg.priceInCents));
    params.append('line_items[0][quantity]', '1');
    params.append('metadata[userId]', user.id);
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
