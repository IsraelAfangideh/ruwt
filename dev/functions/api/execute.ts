/**
 * Proxy code execution requests to our self-hosted executor.
 * Replaces direct calls to the now-defunct public Piston API.
 * POST /api/execute — Piston-compatible request/response format.
 */
interface Env {
  PISTON_API_URL?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
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
        'Access-Control-Allow-Origin': '*',
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

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
