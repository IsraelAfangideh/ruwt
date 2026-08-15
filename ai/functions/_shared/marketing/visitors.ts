const NAMED_BOT =
  /bot|crawler|spider|slurp|curl|wget|python-requests|headless|preview|facebookexternalhit|bingpreview|gptbot|claudebot|anthropic-ai|playwright|puppeteer|selenium|phantomjs|httpclient|axios\/|go-http-client|libwww|scrapy|bytespider|semrush|ahrefs|petalbot|yandex|applebot|duckduckbot|ia_archiver|uptimerobot|pingdom|statuscake|dataprovider|scan|inspect/i;

/** Chrome 124 is the Playwright 1.44 default UA. Real browsers in 2026 are far newer. */
const STALE_CHROME_MAJOR = 126;

export type VisitorKind = 'human' | 'bot' | 'unknown';

export function chromeMajor(userAgent: string): number | null {
  if (/HeadlessChrome/i.test(userAgent)) return 0;
  const match = userAgent.match(/\bChrome\/(\d+)/);
  return match ? Number(match[1]) : null;
}

export function classifyVisitor(userAgent: string | null | undefined): VisitorKind {
  if (!userAgent) return 'unknown';
  if (NAMED_BOT.test(userAgent)) return 'bot';
  const major = chromeMajor(userAgent);
  if (major !== null && major < STALE_CHROME_MAJOR) return 'bot';
  return 'human';
}

export function kindLabel(kind: VisitorKind): string {
  if (kind === 'human') return 'Likely human';
  if (kind === 'bot') return 'Likely scanner/automation';
  return 'Unknown';
}

export function countryFromRequest(request: Request): string | null {
  const value = request.headers.get('cf-ipcountry');
  if (!value || value === 'XX' || value === 'T1') return null;
  return value.toUpperCase();
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}
