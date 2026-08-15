const VISITOR_KEY = 'ruwt-ai-vid';

export function getVisitorId(): string {
  if (typeof window === 'undefined') return 'server';
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

export async function trackVisit(path: string): Promise<void> {
  try {
    await fetch('/api/marketing/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId: getVisitorId(),
        path,
        referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
      }),
    });
  } catch {
    // Non-blocking analytics
  }
}

export type DownloadSource = 'header' | 'landing' | 'download-page';
export type DownloadPlatform = 'macos' | 'windows' | 'linux' | 'unknown';

export function detectPlatform(): DownloadPlatform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('win')) return 'windows';
  if (ua.includes('linux')) return 'linux';
  return 'unknown';
}

export async function trackDownload(
  source: DownloadSource,
  platform: DownloadPlatform = detectPlatform(),
): Promise<{ installCommand: string; repoUrl: string } | null> {
  try {
    const res = await fetch('/api/marketing/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId: getVisitorId(),
        platform,
        source,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { installCommand: string; repoUrl: string };
    return data;
  } catch {
    return null;
  }
}

export async function copyInstallCommand(source: DownloadSource): Promise<string> {
  const tracked = await trackDownload(source);
  const command = tracked?.installCommand ?? 'curl -fsSL https://ruwt.ai/install.sh | bash';
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(command);
  }
  return command;
}
