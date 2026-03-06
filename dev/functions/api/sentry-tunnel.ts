/**
 * POST /api/sentry-tunnel
 * Proxies Sentry error envelopes to Sentry's ingest endpoint.
 * Hides the Sentry ingest URL from client-side code and bypasses ad blockers.
 * The CSP blocks direct connections to *.sentry.io, so all events must go
 * through this tunnel — preventing DSN abuse from the browser.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const dsn = context.env.SENTRY_DSN;
  if (!dsn) {
    return new Response('', { status: 200 });
  }

  try {
    // Parse server-side DSN to construct ingest URL
    const parsed = new URL(dsn);
    const projectId = parsed.pathname.replace(/\//g, '');
    const ingestUrl = `${parsed.protocol}//${parsed.host}/api/${projectId}/envelope/?sentry_key=${parsed.username}&sentry_version=7`;

    // Stream body directly — replay envelopes contain compressed binary data
    // that gets corrupted if read as .text()
    const res = await fetch(ingestUrl, {
      method: 'POST',
      body: context.request.body,
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
    });

    return new Response('', { status: res.ok ? 200 : 502 });
  } catch {
    // Monitoring should never break the app
    return new Response('', { status: 200 });
  }
};
