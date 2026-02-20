/**
 * Proxy code execution requests to our self-hosted executor.
 * Replaces direct calls to the now-defunct public Piston API.
 * POST /api/execute — Piston-compatible request/response format.
 * Requires authentication to prevent abuse.
 */
import { getUser } from '../_shared/auth';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  // Require authentication to prevent unauthenticated code execution
  const user = await getUser(context.request, context.env);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const execUrl = context.env.PISTON_API_URL || 'https://ruwt-exec.fly.dev/api/v2/piston';

  try {
    const body = await context.request.text();

    const res = await fetch(`${execUrl}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const data = await res.text();

    return new Response(data, {
      status: res.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': getAllowedOrigin(context.request),
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        language: 'unknown',
        version: '*',
        run: {
          stdout: '',
          stderr: `Execution service error: ${err instanceof Error ? err.message : 'unavailable'}`,
          code: 1,
          signal: null,
          output: '',
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

const ALLOWED_ORIGINS = ['https://ruwt.dev', 'https://ruwt-dev.pages.dev', 'http://localhost:5173'];

function getAllowedOrigin(request: Request): string {
  const origin = request.headers.get('Origin') || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

export const onRequestOptions: PagesFunction = async (context) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': getAllowedOrigin(context.request),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
