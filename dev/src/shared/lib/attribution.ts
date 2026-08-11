/**
 * First-touch acquisition capture.
 *
 * Why first-touch, and why localStorage: signing in through GitHub sends the
 * visitor to github.com and back, which replaces document.referrer. By the
 * time a profile row exists, every user looks like they came from GitHub. So
 * the real source has to be recorded on the very first page load and kept
 * until there is an account to attach it to.
 *
 * The record is written once. A later visit never overwrites it, so an
 * internal link or a second session cannot bury where someone actually
 * arrived from.
 */

const STORAGE_KEY = 'ruwt_attribution';

export interface Attribution {
  /** Referring host, 'direct' when there was none. Never a full URL. */
  referrer: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  /** Path only — query and hash are dropped, so no PII rides along. */
  landingPath: string;
}

/** Host of a referrer URL, or null when it is absent, same-site, or unparsable. */
function referrerHost(rawReferrer: string, currentHost: string): string | null {
  if (!rawReferrer) return null;
  try {
    const host = new URL(rawReferrer).host;
    // A same-site referrer means an internal navigation, not an arrival.
    return host && host !== currentHost ? host : null;
  } catch {
    return null;
  }
}

/**
 * Records how this visitor arrived, unless it is already recorded.
 * Safe to call on every load, and safe where storage is unavailable.
 */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.localStorage.getItem(STORAGE_KEY)) return;

    const params = new URLSearchParams(window.location.search);
    const host = referrerHost(document.referrer, window.location.host);

    const record: Attribution = {
      referrer: host ?? 'direct',
      utmSource: params.get('utm_source'),
      utmMedium: params.get('utm_medium'),
      utmCampaign: params.get('utm_campaign'),
      landingPath: window.location.pathname,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage blocked or full. Attribution is nice to have, never required.
  }
}

/** The stored record, or null when nothing was captured. */
export function getAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as Attribution : null;
  } catch {
    return null;
  }
}

/**
 * Sends the stored record to the server, which keeps the first one it
 * receives. Fire and forget: a failure must never block a sign-in.
 *
 * On success the record is dropped. Without that, every page load of every
 * signed-in user posts the same value forever — and each of those costs an
 * auth round trip and three D1 queries to write nothing. A non-2xx keeps the
 * record so a later visit can retry.
 */
export async function reportAttribution(): Promise<void> {
  const record = getAttribution();
  if (!record) return;
  try {
    const res = await fetch('/api/attribution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    // 200 settles it either way: recorded, or the server already had a source.
    if (res.ok) clearAttribution();
  } catch {
    // Offline or blocked. The record stays in storage for the next attempt.
  }
}

/** Drops the stored record. Exported for tests and for the report path. */
export function clearAttribution(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do; a stale record only costs one extra request.
  }
}
