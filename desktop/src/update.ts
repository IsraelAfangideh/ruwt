export interface ReleaseIdentity {
  version: string;
  commit: string;
}

export interface DesktopManifest {
  version: string;
  commit: string;
  publishedAt?: string;
  notes?: string;
  platforms?: {
    darwin?: { url: string; filename: string; sha256: string };
    windows?: { url: string; filename: string; sha256: string };
  };
}

export function versionCmp(left: string, right: string): number {
  const a = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const b = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    if (delta) return delta > 0 ? 1 : -1;
  }
  return 0;
}

export function normalizeCommit(commit: string): string {
  return commit.trim().toLowerCase();
}

/** Packaged builds update when the published version or commit is newer. Dev builds do not. */
export function updateAvailable(local: ReleaseIdentity, remote: ReleaseIdentity): boolean {
  if (!remote.version) return false;
  if (!local.commit || local.commit === 'dev') return false;
  if (versionCmp(remote.version, local.version) > 0) return true;
  const localCommit = normalizeCommit(local.commit);
  const remoteCommit = normalizeCommit(remote.commit);
  return versionCmp(remote.version, local.version) === 0 && Boolean(remoteCommit) && remoteCommit !== localCommit;
}

export const MANIFEST_URLS = [
  'https://ruwt.ai/downloads/desktop-latest.json',
  'https://ruwt-ai.pages.dev/downloads/desktop-latest.json',
];
