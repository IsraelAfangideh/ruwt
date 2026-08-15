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

type Artifact = { url: string; filename: string };

const DEFAULT_ARTIFACTS: Record<DownloadPlatform, Artifact> = {
  macos: { url: '/downloads/Ruwt.dmg', filename: 'Ruwt.dmg' },
  windows: { url: '/downloads/Ruwt-Setup.exe', filename: 'Ruwt-Setup.exe' },
  linux: { url: '/downloads/ruwt-linux-amd64', filename: 'ruwt-linux-amd64' },
  unknown: { url: '/downloads/Ruwt.dmg', filename: 'Ruwt.dmg' },
};

const MAC_FALLBACK: Artifact = { url: '/downloads/Ruwt-macOS.zip', filename: 'Ruwt-macOS.zip' };

async function resolveArtifact(platform: DownloadPlatform, preferred: Artifact): Promise<Artifact> {
  if (typeof fetch === 'undefined') return preferred;
  try {
    const head = await fetch(preferred.url, { method: 'HEAD' });
    if (head.ok) return preferred;
  } catch {
    // Fall through to zip while the Tauri DMG is still building.
  }
  if (platform === 'macos') return MAC_FALLBACK;
  return preferred;
}

export async function trackDownload(
  source: DownloadSource,
  platform: DownloadPlatform = detectPlatform(),
): Promise<Artifact> {
  let artifact = await resolveArtifact(platform, DEFAULT_ARTIFACTS[platform]);
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
    if (res.ok) {
      const data = (await res.json()) as { url?: string; filename?: string };
      if (data.url && data.filename) {
        artifact = await resolveArtifact(platform, { url: data.url, filename: data.filename });
      }
    }
  } catch {
    // Use the static artifact map.
  }
  return artifact;
}

export function triggerFileDownload(artifact: Artifact): void {
  const link = document.createElement('a');
  link.href = artifact.url;
  link.download = artifact.filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function startLauncherDownload(
  source: DownloadSource,
  platform: DownloadPlatform = detectPlatform(),
): Promise<Artifact> {
  const artifact = await trackDownload(source, platform);
  triggerFileDownload(artifact);
  return artifact;
}
