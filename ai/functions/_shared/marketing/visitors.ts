const BOT_PATTERN = /bot|crawler|spider|slurp|curl|wget|python-requests|headless|preview|facebookexternalhit|bingpreview|GPTBot|ClaudeBot|anthropic-ai/i;

export type VisitorKind = 'human' | 'bot' | 'unknown';

export function classifyVisitor(userAgent: string | null | undefined): VisitorKind {
  if (!userAgent) return 'unknown';
  return BOT_PATTERN.test(userAgent) ? 'bot' : 'human';
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}
