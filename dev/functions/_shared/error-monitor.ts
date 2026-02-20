/**
 * Error monitoring: logs errors to D1 and sends alert emails via Resend.
 * Includes pattern-matching diagnostics that suggest likely fixes.
 *
 * Designed to never throw — swallows its own errors so it never masks
 * the original error that triggered it.
 */
import { sendEmail } from './newsletter/resend';

export interface ErrorInfo {
  endpoint?: string;
  method?: string;
  userId?: string;
  errorMessage: string;
  errorStack?: string;
  requestBody?: string;
  level?: 'error' | 'warn' | 'fatal';
  metadata?: Record<string, unknown>;
}

export interface Diagnosis {
  category: string;
  suggestedFix: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Log an error to D1 and optionally send an alert email.
 *
 * The metadata field is enriched with a `fixContext` object designed
 * to be consumed by an AI engineer agent for auto-fix workflows:
 * {
 *   fixContext: {
 *     category, severity, suggestedFix,
 *     likelyFiles: string[],   // files to investigate
 *     commands: string[],      // CLI commands to run
 *   }
 * }
 */
export async function logError(
  db: D1Database,
  env: { RESEND_API_KEY?: string; ERROR_ALERT_EMAIL?: string },
  info: ErrorInfo,
): Promise<void> {
  const id = crypto.randomUUID();
  const diagnosis = diagnoseError(info);

  // Enrich metadata with structured fix context for AI engineer agents
  const fixContext = buildFixContext(info, diagnosis);
  info.metadata = { ...info.metadata, fixContext };

  // Insert to D1
  try {
    await db.prepare(`
      INSERT INTO error_logs (id, level, endpoint, method, user_id, error_message, error_stack, request_body, suggested_fix, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      info.level || 'error',
      info.endpoint || null,
      info.method || null,
      info.userId || null,
      info.errorMessage,
      info.errorStack || null,
      info.requestBody ? info.requestBody.slice(0, 10000) : null,
      diagnosis.suggestedFix,
      info.metadata ? JSON.stringify(info.metadata) : null,
    ).run();
  } catch (dbErr) {
    console.error('[error-monitor] Failed to log to D1:', dbErr);
  }

  // Send alert email
  const alertEmail = env.ERROR_ALERT_EMAIL;
  if (!alertEmail || !env.RESEND_API_KEY) return;

  try {
    const html = formatErrorEmail(id, info, diagnosis);
    const text = formatErrorText(id, info, diagnosis);
    const subject = `[ruwt.dev ${diagnosis.severity.toUpperCase()}] ${info.endpoint || 'unknown'} — ${info.errorMessage.slice(0, 80)}`;

    await sendEmail(env, {
      to: alertEmail,
      from: 'ruwt.dev alerts <alerts@ruwt.dev>',
      subject,
      html,
      text,
    });

    // Mark email as sent
    try {
      await db.prepare('UPDATE error_logs SET email_sent = 1 WHERE id = ?').bind(id).run();
    } catch { /* non-critical */ }
  } catch (emailErr) {
    console.error('[error-monitor] Failed to send alert email:', emailErr);
  }
}

// ---------------------------------------------------------------------------
// Fix context builder — structured data for AI engineer auto-fix
// ---------------------------------------------------------------------------

interface FixContext {
  category: string;
  severity: string;
  suggestedFix: string;
  likelyFiles: string[];
  commands: string[];
  searchTerms: string[];
}

function buildFixContext(info: ErrorInfo, diagnosis: Diagnosis): FixContext {
  const ctx: FixContext = {
    category: diagnosis.category,
    severity: diagnosis.severity,
    suggestedFix: diagnosis.suggestedFix,
    likelyFiles: [],
    commands: [],
    searchTerms: [],
  };

  // Infer likely files from endpoint
  const ep = info.endpoint || '';
  if (ep.includes('/ai/chat')) {
    ctx.likelyFiles.push('functions/api/ai/chat.ts', 'functions/_shared/ai-stream.ts');
  } else if (ep.includes('/ai/apply')) {
    ctx.likelyFiles.push('functions/api/ai/apply.ts');
  } else if (ep.includes('/execute')) {
    ctx.likelyFiles.push('functions/api/execute.ts', 'functions/_shared/judge.ts');
  } else if (ep.includes('/submissions')) {
    ctx.likelyFiles.push('functions/api/submissions.ts', 'functions/_shared/judge.ts');
  } else if (ep.includes('/webhook') || ep.includes('/stripe')) {
    ctx.likelyFiles.push('functions/api/webhooks/stripe.ts');
  } else if (ep.includes('/profile')) {
    ctx.likelyFiles.push('functions/api/profile.ts');
  } else if (ep.includes('/attempts')) {
    ctx.likelyFiles.push('functions/api/attempts.ts');
  } else if (ep.includes('/assess')) {
    ctx.likelyFiles.push('functions/api/assess/start.ts');
  } else if (ep) {
    // Derive file path from endpoint: /api/foo/bar → functions/api/foo/bar.ts
    ctx.likelyFiles.push(`functions${ep}.ts`);
  }

  // Add relevant infrastructure files based on error category
  switch (diagnosis.category) {
    case 'Database Schema':
      ctx.likelyFiles.push('drizzle/schema.d1.ts', 'drizzle/migrations-d1/');
      ctx.commands.push('npx wrangler d1 migrations apply ruwt-dev --remote');
      ctx.searchTerms.push('CREATE TABLE', 'ALTER TABLE');
      break;
    case 'Database Contention':
    case 'Database Constraint':
      ctx.likelyFiles.push('drizzle/schema.d1.ts');
      ctx.searchTerms.push('unique', 'constraint', 'INSERT');
      break;
    case 'Authentication':
    case 'Supabase':
      ctx.likelyFiles.push('functions/_shared/auth.ts', 'functions/_shared/supabase.ts');
      ctx.commands.push('curl -s https://fzncpdelyfuvdeqmwznx.supabase.co/auth/v1/health');
      break;
    case 'External Service':
      ctx.commands.push('curl -s https://ruwt-exec.fly.dev/api/v2/piston/runtimes');
      break;
    case 'AI Model':
    case 'Cloudflare AI':
      ctx.likelyFiles.push('functions/_shared/ai-pricing.ts', 'functions/_shared/ai-stream.ts');
      ctx.searchTerms.push('fallbackChain', 'MODEL_TIERS');
      break;
    case 'Configuration':
      ctx.likelyFiles.push('functions/_shared/env.d.ts', 'wrangler.toml');
      ctx.commands.push('npx wrangler pages secret list --project-name=ruwt-dev');
      break;
    case 'Stripe':
      ctx.likelyFiles.push('functions/api/webhooks/stripe.ts', 'functions/api/checkout.ts');
      break;
  }

  // Extract search terms from error message
  const fnMatch = info.errorStack?.match(/at\s+(\w+)\s+\(/)?.[1];
  if (fnMatch) ctx.searchTerms.push(fnMatch);

  // Extract line from stack trace for precise location
  const fileLineMatch = info.errorStack?.match(/\/functions\/([^:]+):(\d+)/);
  if (fileLineMatch) {
    ctx.likelyFiles.unshift(`functions/${fileLineMatch[1]}:${fileLineMatch[2]}`);
  }

  return ctx;
}

// ---------------------------------------------------------------------------
// Diagnostics — pattern-match errors to suggest likely fixes
// ---------------------------------------------------------------------------

export function diagnoseError(info: ErrorInfo): Diagnosis {
  const msg = info.errorMessage.toLowerCase();
  const stack = (info.errorStack || '').toLowerCase();
  const endpoint = info.endpoint || '';

  // --- D1 / SQLite ---
  if (msg.includes('d1_error') || msg.includes('no such table') || msg.includes('no such column')) {
    const table = msg.match(/no such table:\s*(\w+)/)?.[1];
    const column = msg.match(/no such column:\s*(\w+)/)?.[1];
    return {
      category: 'Database Schema',
      suggestedFix: table
        ? `Table "${table}" does not exist. Run pending D1 migrations:\n\`npx wrangler d1 migrations apply ruwt-dev --remote\`\n\nIf the table is new, create a migration in drizzle/migrations-d1/.`
        : column
        ? `Column "${column}" missing. A migration may be pending or the schema.d1.ts is out of sync with the DB. Run migrations and verify the schema.`
        : 'D1 database error. Check if migrations are up to date:\n`npx wrangler d1 migrations apply ruwt-dev --remote`',
      severity: 'critical',
    };
  }

  if (msg.includes('database is locked') || msg.includes('busy')) {
    return {
      category: 'Database Contention',
      suggestedFix: 'D1 database is locked/busy. This usually resolves itself. If persistent, check for long-running transactions or batch operations that should be broken into smaller chunks.',
      severity: 'high',
    };
  }

  if (msg.includes('unique constraint') || msg.includes('constraint failed')) {
    return {
      category: 'Database Constraint',
      suggestedFix: 'Unique constraint violation — a duplicate record was inserted. This is usually a race condition (double-click, retried request). Add idempotency checks or use INSERT OR IGNORE.',
      severity: 'medium',
    };
  }

  // --- Auth ---
  if (msg.includes('jwt') || (msg.includes('token') && (msg.includes('expired') || msg.includes('invalid')))) {
    return {
      category: 'Authentication',
      suggestedFix: 'Auth token expired or invalid. If affecting all users, check Supabase project health at https://supabase.com/dashboard (ref: fzncpdelyfuvdeqmwznx). If intermittent, this is normal session expiry.',
      severity: 'medium',
    };
  }

  if (msg.includes('supabase') || stack.includes('supabase')) {
    return {
      category: 'Supabase',
      suggestedFix: 'Supabase service error. Check:\n1. Dashboard for project health (ref: fzncpdelyfuvdeqmwznx)\n2. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in CF Dashboard\n3. Auth redirect URLs include the failing domain',
      severity: 'high',
    };
  }

  // --- External services ---
  if (msg.includes('fetch failed') || msg.includes('network') || msg.includes('econnrefused') || msg.includes('dns')) {
    const service = endpoint.includes('/execute') ? 'Piston (ruwt-exec.fly.dev)'
      : endpoint.includes('/ai/') ? 'Cloudflare Workers AI'
      : 'an external service';
    return {
      category: 'External Service',
      suggestedFix: `Network error connecting to ${service}. Check:\n1. Is the service running? (Fly.io dashboard or CF AI status)\n2. Is the URL correct in env vars? (PISTON_API_URL, CLOUDFLARE_API_TOKEN)\n3. DNS resolution working?`,
      severity: 'high',
    };
  }

  // --- AI models ---
  if (msg.includes('model') && (msg.includes('not found') || msg.includes('404'))) {
    return {
      category: 'AI Model',
      suggestedFix: 'AI model not available on Workers AI. May be deprecated or renamed. Check the fallback chain in ai-pricing.ts and update model IDs.\nhttps://developers.cloudflare.com/workers-ai/models/',
      severity: 'high',
    };
  }

  if (msg.includes('workers ai') || msg.includes('ai gateway') || (msg.includes('cloudflare') && msg.includes('ai'))) {
    return {
      category: 'Cloudflare AI',
      suggestedFix: 'Cloudflare Workers AI error. Check:\n1. CLOUDFLARE_API_TOKEN has Workers AI scope\n2. CLOUDFLARE_ACCOUNT_ID is correct\n3. AI rate limits on your plan\n4. https://www.cloudflarestatus.com/',
      severity: 'high',
    };
  }

  // --- JSON ---
  if (msg.includes('json') && (msg.includes('parse') || msg.includes('unexpected'))) {
    return {
      category: 'JSON Parse',
      suggestedFix: 'Malformed JSON in request or response. If in request body, the client is sending invalid data — check frontend fetch calls. If in a DB field (e.g., testCases), the stored data may be corrupted.',
      severity: 'medium',
    };
  }

  // --- Config ---
  if (msg.includes('binding') || msg.includes('not configured') || msg.includes('env.')) {
    return {
      category: 'Configuration',
      suggestedFix: 'Missing environment variable or Cloudflare binding. Check:\n1. CF Dashboard → Pages → ruwt-dev → Settings → Environment Variables\n2. Do NOT add [vars] to wrangler.toml for vars already in Dashboard\n3. Redeploy after changes to pick up new env vars',
      severity: 'critical',
    };
  }

  // --- Stripe ---
  if (msg.includes('stripe') || endpoint.includes('stripe') || endpoint.includes('webhook')) {
    return {
      category: 'Stripe',
      suggestedFix: 'Stripe webhook or payment error. Check:\n1. STRIPE_WEBHOOK_SECRET matches the active webhook endpoint\n2. Stripe dashboard for failed webhooks\n3. Webhook URL (https://ruwt.dev/api/webhooks/stripe) is accessible',
      severity: 'high',
    };
  }

  // --- Runtime errors ---
  if (msg.includes('undefined') || msg.includes('null') || msg.includes('typeerror') || msg.includes('cannot read prop')) {
    return {
      category: 'Runtime Error',
      suggestedFix: `Null/undefined reference error at ${endpoint}. This is a bug — a value assumed to exist is missing. Check the stack trace for the exact location and add a null check. The request body may reveal which input caused it.`,
      severity: 'high',
    };
  }

  // --- Resource limits ---
  if (msg.includes('memory') || msg.includes('payload too large') || msg.includes('body exceed')) {
    return {
      category: 'Resource Limit',
      suggestedFix: 'Request/response too large. CF Workers have body size limits. If user code is too large, add client-side validation. If AI response is too large, reduce max_tokens.',
      severity: 'medium',
    };
  }

  // --- Code execution ---
  if (msg.includes('execution') && (msg.includes('timeout') || msg.includes('killed'))) {
    return {
      category: 'Code Execution',
      suggestedFix: 'Code execution timed out or was killed. Usually a user\'s infinite loop or memory-heavy solution. If all executions fail, check if ruwt-exec.fly.dev is healthy.',
      severity: 'low',
    };
  }

  // --- Default ---
  return {
    category: 'Unknown',
    suggestedFix: `Unrecognized error pattern. Debug steps:\n1. Check the stack trace for the exact file and line\n2. Look at the request body for unusual input\n3. Reproduce locally with \`wrangler pages dev\`\n4. Check CF dashboard logs for additional context`,
    severity: 'high',
  };
}

// ---------------------------------------------------------------------------
// Email formatting
// ---------------------------------------------------------------------------

function formatErrorEmail(id: string, info: ErrorInfo, diagnosis: Diagnosis): string {
  const severityColor: Record<string, string> = {
    low: '#3fb950', medium: '#d29922', high: '#f85149', critical: '#ff0000',
  };
  const color = severityColor[diagnosis.severity] || '#f85149';
  const timestamp = new Date().toISOString();
  const esc = escapeHtml;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; padding: 24px; margin: 0;">
  <div style="max-width: 700px; margin: 0 auto;">
    <div style="margin-bottom: 24px;">
      <span style="font-size: 24px; font-weight: 700; color: #c9a84c;">ruwt.dev</span>
      <span style="background: ${color}; color: #0d1117; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-left: 12px;">${diagnosis.severity}</span>
      <span style="color: #8b949e; font-size: 12px; margin-left: 8px;">${esc(diagnosis.category)}</span>
    </div>

    <div style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
      <div style="color: #8b949e; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Error</div>
      <div style="color: #f85149; font-size: 15px; font-family: Menlo, Monaco, monospace; word-break: break-all;">${esc(info.errorMessage)}</div>
    </div>

    <div style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
      <div style="color: #8b949e; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Likely Fix</div>
      <div style="color: #3fb950; font-size: 13px; white-space: pre-wrap; font-family: Menlo, Monaco, monospace;">${esc(diagnosis.suggestedFix)}</div>
    </div>

    <table style="width: 100%; border-collapse: separate; border-spacing: 8px 0; margin-bottom: 16px;">
      <tr>
        <td style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 12px;">
          <div style="color: #8b949e; font-size: 11px; text-transform: uppercase;">Endpoint</div>
          <div style="color: #c9d1d9; font-size: 13px; font-family: Menlo, Monaco, monospace;">${esc(info.method || 'GET')} ${esc(info.endpoint || 'unknown')}</div>
        </td>
        <td style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 12px;">
          <div style="color: #8b949e; font-size: 11px; text-transform: uppercase;">User</div>
          <div style="color: #c9d1d9; font-size: 13px; font-family: Menlo, Monaco, monospace;">${esc(info.userId || 'anonymous')}</div>
        </td>
      </tr>
    </table>

    <table style="width: 100%; border-collapse: separate; border-spacing: 8px 0; margin-bottom: 16px;">
      <tr>
        <td style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 12px;">
          <div style="color: #8b949e; font-size: 11px; text-transform: uppercase;">Time</div>
          <div style="color: #c9d1d9; font-size: 13px;">${timestamp}</div>
        </td>
        <td style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 12px;">
          <div style="color: #8b949e; font-size: 11px; text-transform: uppercase;">Error ID</div>
          <div style="color: #c9d1d9; font-size: 11px; font-family: Menlo, Monaco, monospace;">${id}</div>
        </td>
      </tr>
    </table>

    <div style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; margin-bottom: 16px;">
      <div style="padding: 12px; color: #8b949e; font-size: 12px; border-bottom: 1px solid #30363d;">Stack Trace</div>
      <pre style="padding: 12px; margin: 0; font-size: 11px; color: #8b949e; overflow-x: auto; white-space: pre-wrap; word-break: break-all;">${info.errorStack ? esc(info.errorStack) : '<em>No stack trace</em>'}</pre>
    </div>

    <div style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; margin-bottom: 16px;">
      <div style="padding: 12px; color: #8b949e; font-size: 12px; border-bottom: 1px solid #30363d;">Request Body</div>
      <pre style="padding: 12px; margin: 0; font-size: 11px; color: #8b949e; overflow-x: auto; white-space: pre-wrap; word-break: break-all;">${info.requestBody ? esc(info.requestBody.slice(0, 5000)) : '<em>No body</em>'}</pre>
    </div>

${info.metadata ? `    <div style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; margin-bottom: 16px;">
      <div style="padding: 12px; color: #8b949e; font-size: 12px; border-bottom: 1px solid #30363d;">Additional Context</div>
      <pre style="padding: 12px; margin: 0; font-size: 11px; color: #8b949e; overflow-x: auto; white-space: pre-wrap;">${esc(JSON.stringify(info.metadata, null, 2))}</pre>
    </div>` : ''}

    <div style="text-align: center; padding: 16px; color: #484f58; font-size: 11px;">
      ruwt.dev error monitoring
    </div>
  </div>
</body>
</html>`;
}

function formatErrorText(id: string, info: ErrorInfo, diagnosis: Diagnosis): string {
  return `[ruwt.dev ${diagnosis.severity.toUpperCase()}] ${diagnosis.category}

ERROR: ${info.errorMessage}

LIKELY FIX:
${diagnosis.suggestedFix}

DETAILS:
- Endpoint: ${info.method || 'GET'} ${info.endpoint || 'unknown'}
- User: ${info.userId || 'anonymous'}
- Time: ${new Date().toISOString()}
- Error ID: ${id}

STACK TRACE:
${info.errorStack || 'No stack trace'}

REQUEST BODY:
${info.requestBody?.slice(0, 5000) || 'No body'}${info.metadata ? `\n\nMETADATA:\n${JSON.stringify(info.metadata, null, 2)}` : ''}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
