/**
 * Proxy code execution requests to our self-hosted executor.
 * Replaces direct calls to the now-defunct public Piston API.
 * POST /api/execute — Piston-compatible request/response format.
 * Requires authentication to prevent abuse.
 */
import { z } from 'zod';
import { getUser } from '../_shared/auth';
import { logError } from '../_shared/error-monitor';

const executeSchema = z.object({
  language: z.string().min(1),
  version: z.string().default('*'),
  files: z.array(z.object({
    name: z.string().optional(),
    content: z.string().max(1_000_000, 'Code exceeds 1MB limit'),
  })).min(1),
  stdin: z.string().optional().default(''),
  args: z.array(z.string()).optional().default([]),
  compile_timeout: z.number().optional(),
  run_timeout: z.number().max(30000).optional(),
  compile_memory_limit: z.number().optional(),
  run_memory_limit: z.number().optional(),
});

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getUser(context.request, context.env);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const execUrl = context.env.PISTON_API_URL || 'https://ruwt-exec.fly.dev/api/v2/piston';

  try {
    const body = await context.request.json().catch(() => ({}));
    const parsed = executeSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (context.env.EXECUTOR_SECRET) {
      headers['X-Executor-Secret'] = context.env.EXECUTOR_SECRET;
    }

    const res = await fetch(`${execUrl}/execute`, {
      method: 'POST',
      headers,
      body: JSON.stringify(parsed.data),
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
    const error = err instanceof Error ? err : new Error(String(err));

    logError(context.env.DB, context.env, {
      endpoint: '/api/execute',
      method: 'POST',
      userId: user.id,
      errorMessage: error.message,
      errorStack: error.stack,
      level: 'error',
    }).catch(() => {});

    return new Response(
      JSON.stringify({
        language: 'unknown',
        version: '*',
        run: {
          stdout: '',
          stderr: `Execution service error: ${error.message}`,
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
