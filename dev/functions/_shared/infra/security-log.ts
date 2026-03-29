/**
 * Log a security event to the error_logs table.
 * Reuses existing infrastructure — fire-and-forget, never blocks the response.
 */
export function logSecurityEvent(
  db: D1Database,
  event: {
    type: 'rate_limit' | 'csrf_reject' | 'auth_failure' | 'suspicious';
    endpoint: string;
    method: string;
    ip: string;
    userId?: string;
    details?: string;
  }
): void {
  try {
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO error_logs (id, level, endpoint, method, user_id, error_message, metadata)
       VALUES (?, 'security', ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        event.endpoint,
        event.method,
        event.userId || null,
        `[${event.type}] ${event.details || event.type}`,
        JSON.stringify({ securityType: event.type, ip: event.ip })
      )
      .run()
      .catch(/* istanbul ignore next -- @preserve */ () => {}); // fire-and-forget
  } catch {
    // Never throw — security logging must not break request handling
  }
}
