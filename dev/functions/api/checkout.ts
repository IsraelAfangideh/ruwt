/**
 * POST /api/checkout
 * Create a Stripe Checkout Session for credit or assessment pack purchase.
 */
import { getUser } from '../_shared/auth';

interface CreditPackage {
  id: string;
  credits: number;
  priceInCents: number;
  label: string;
}

interface AssessmentPack {
  id: string;
  assessments: number;
  priceInCents: number;
  label: string;
}

const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'credits-5000', credits: 5000, priceInCents: 499, label: '5,000 Credits' },
  { id: 'credits-25000', credits: 25000, priceInCents: 1499, label: '25,000 Credits' },
  { id: 'credits-100000', credits: 100000, priceInCents: 3999, label: '100,000 Credits' },
];

const ASSESSMENT_PACKS: AssessmentPack[] = [
  { id: 'pack-10', assessments: 10, priceInCents: 9900, label: '10 Assessments' },
  { id: 'pack-50', assessments: 50, priceInCents: 39900, label: '50 Assessments' },
  { id: 'pack-200', assessments: 200, priceInCents: 99900, label: '200 Assessments' },
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
      type?: 'credits' | 'assessment';
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
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('line_items[0][quantity]', '1');
    params.append('line_items[0][price_data][currency]', 'usd');

    if (type === 'assessment') {
      const pack = ASSESSMENT_PACKS.find((p) => p.id === packageId);
      if (!pack) {
        return Response.json({ error: 'Invalid assessment pack' }, { status: 400 });
      }
      params.append('success_url', `${origin}/assessments?purchased=true`);
      params.append('cancel_url', `${origin}/teams`);
      params.append('line_items[0][price_data][product_data][name]', pack.label);
      params.append('line_items[0][price_data][product_data][description]', `${pack.assessments} candidate assessments on ruwt.dev`);
      params.append('line_items[0][price_data][unit_amount]', String(pack.priceInCents));
      params.append('metadata[userId]', user.id);
      params.append('metadata[type]', 'assessment');
      params.append('metadata[assessments]', String(pack.assessments));
      params.append('metadata[packageId]', pack.id);
    } else {
      const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
      if (!pkg) {
        return Response.json({ error: 'Invalid package' }, { status: 400 });
      }
      params.append('success_url', `${origin}/settings?purchased=true`);
      params.append('cancel_url', `${origin}/settings`);
      params.append('line_items[0][price_data][product_data][name]', pkg.label);
      params.append('line_items[0][price_data][product_data][description]', `${pkg.credits} AI credits for ruwt.dev`);
      params.append('line_items[0][price_data][unit_amount]', String(pkg.priceInCents));
      params.append('metadata[userId]', user.id);
      params.append('metadata[type]', 'credits');
      params.append('metadata[credits]', String(pkg.credits));
      params.append('metadata[packageId]', pkg.id);
    }

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
