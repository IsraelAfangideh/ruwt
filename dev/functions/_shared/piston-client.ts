/**
 * Shared client for the Piston code execution service.
 * Used by judge.ts, tool-executor.ts, execute.ts, and health.ts.
 */

export interface PistonEnv {
  PISTON_API_URL?: string;
  EXECUTOR_SECRET?: string;
}

export interface PistonRunResult {
  stdout: string;
  stderr: string;
  code: number;
  signal: string | null;
  output: string;
}

export interface PistonResponse {
  language: string;
  version: string;
  run: PistonRunResult;
  compile?: PistonRunResult;
}

export interface PistonRequest {
  language: string;
  version?: string;
  files: { name?: string; content: string }[];
  stdin?: string;
  run_timeout?: number;
}

const DEFAULT_URL = 'https://ruwt-exec.fly.dev/api/v2/piston';

/** Build auth headers for the executor service. */
export function buildPistonHeaders(env: PistonEnv): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (env.EXECUTOR_SECRET) {
    headers['X-Executor-Secret'] = env.EXECUTOR_SECRET;
  }
  return headers;
}

/** Get the base executor URL from env or default. */
export function getPistonUrl(env: PistonEnv): string {
  return env.PISTON_API_URL || DEFAULT_URL;
}

/**
 * Execute code via the Piston API.
 * Throws on non-OK responses. For graceful handling, catch the error.
 */
export async function pistonExecute(
  env: PistonEnv,
  request: PistonRequest,
  fetchOptions?: { signal?: AbortSignal },
): Promise<PistonResponse> {
  const url = getPistonUrl(env);
  const headers = buildPistonHeaders(env);

  const res = await fetch(`${url}/execute`, {
    /* istanbul ignore next -- @preserve */
    method: 'POST',
    headers,
    body: JSON.stringify({
      language: request.language,
      version: request.version ?? '*',
      files: request.files,
      stdin: request.stdin ?? '',
      run_timeout: request.run_timeout,
    }),
    ...(fetchOptions?.signal ? { signal: fetchOptions.signal } : {}),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Piston API error: ${res.status} - ${err}`);
  }

  return res.json() as Promise<PistonResponse>;
}
