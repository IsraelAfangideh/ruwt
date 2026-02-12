/**
 * ONE-TIME migration: grant 50k credits to existing users with 0 credits.
 * DELETE this file after running.
 * POST /api/_migrate-credits?key=ruwt-migrate-2026
 */
export async function onRequestPost(context: { request: Request; env: Env }) {
  const url = new URL(context.request.url);
  if (url.searchParams.get('key') !== 'ruwt-migrate-2026') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = context.env.DB;
  const result = await db.prepare(
    'UPDATE profiles SET credits = 50000 WHERE credits = 0'
  ).run();

  return Response.json({
    success: true,
    changes: result.meta?.changes ?? 0,
    message: `Updated ${result.meta?.changes ?? 0} profiles with 50k credits`,
  });
}
