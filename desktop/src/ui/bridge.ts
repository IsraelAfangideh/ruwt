import type { FsLike } from '../fs.js';
import { isApprovedPath } from '../fs.js';
import { MANIFEST_URLS, updateAvailable, type DesktopManifest, type ReleaseIdentity } from '../update.js';

type Invoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

export interface AppIdentity extends ReleaseIdentity {
  os: string;
  packaged: boolean;
}

export interface UpdateStatus {
  current_version: string;
  current_commit: string;
  available: boolean;
  version?: string | null;
  commit?: string | null;
  notes?: string | null;
  published_at?: string | null;
  message: string;
}

function tauriInvoke(): Invoke | undefined {
  const host = window as Window & {
    __TAURI__?: { core?: { invoke?: Invoke } };
    __TAURI_INTERNALS__?: { invoke?: Invoke };
  };
  const internals = host.__TAURI_INTERNALS__;
  const core = host.__TAURI__?.core;
  const invoke = internals?.invoke ?? core?.invoke;
  return invoke ? invoke.bind(internals ?? core) : undefined;
}

async function waitForTauriInvoke(): Promise<Invoke | undefined> {
  const deadline = Date.now() + 1500;
  for (;;) {
    const invoke = tauriInvoke();
    if (invoke) return invoke;
    if (Date.now() >= deadline) return undefined;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

export function detectShell(): 'tauri' | 'launcher' | 'none' {
  if ((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ || tauriInvoke()) return 'tauri';
  if (['127.0.0.1', 'localhost'].includes(location.hostname) && location.protocol.startsWith('http')) return 'launcher';
  return 'none';
}

class TauriFs implements FsLike {
  constructor(private readonly invoke: Invoke) {}
  async home() { return this.invoke('home_dir') as Promise<string>; }
  async readFile(path: string) { return this.invoke('read_text_file', { path }) as Promise<string>; }
  async writeFile(path: string, contents: string) { await this.invoke('write_text_file', { path, contents }); }
  async mkdirp(path: string) { await this.invoke('mkdirp', { path }); }
  async exists(path: string) { return this.invoke('path_exists', { path }) as Promise<boolean>; }
  async listDir(path: string) {
    return this.invoke('list_dir', { path }) as Promise<{ name: string; path: string; dir: boolean }[]>;
  }
}

class HttpFs implements FsLike {
  private async call<T>(route: string, body: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch(route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`Local Ruwt service returned ${response.status}.`);
    return response.json() as Promise<T>;
  }
  async home() { return (await this.call<{ home: string }>('/api/fs/home')).home; }
  async readFile(path: string) { return (await this.call<{ contents: string }>('/api/fs/read', { path })).contents; }
  async writeFile(path: string, contents: string) { await this.call('/api/fs/write', { path, contents }); }
  async mkdirp(path: string) { await this.call('/api/fs/mkdirp', { path }); }
  async exists(path: string) { return (await this.call<{ exists: boolean }>('/api/fs/exists', { path })).exists; }
  async listDir(path: string) { return (await this.call<{ entries: { name: string; path: string; dir: boolean }[] }>('/api/fs/list', { path })).entries; }
}

export interface Bridge {
  shell: 'tauri' | 'launcher' | 'none';
  fs: FsLike;
  setAutostart(enabled: boolean): Promise<boolean>;
  appIdentity(): Promise<AppIdentity>;
  checkUpdate(): Promise<UpdateStatus>;
  installUpdate(): Promise<UpdateStatus>;
}

async function fetchManifest(): Promise<DesktopManifest> {
  let last = 'Ruwt could not reach the update service.';
  for (const url of MANIFEST_URLS) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) { last = `The update service returned ${response.status}.`; continue; }
      return await response.json() as DesktopManifest;
    } catch (error) {
      last = error instanceof Error ? error.message : last;
    }
  }
  throw new Error(last);
}

function platformAsset(manifest: DesktopManifest) {
  const darwin = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent);
  const windows = typeof navigator !== 'undefined' && /win/i.test(navigator.platform || navigator.userAgent);
  if (darwin) return manifest.platforms?.darwin;
  if (windows) return manifest.platforms?.windows;
  return undefined;
}

export async function createBridge(): Promise<Bridge> {
  const invoke = await waitForTauriInvoke();
  if (invoke) {
    return {
      shell: 'tauri',
      fs: new TauriFs(invoke),
      async setAutostart(enabled: boolean) { return invoke('autostart_set', { enabled }) as Promise<boolean>; },
      async appIdentity() { return invoke('app_identity') as Promise<AppIdentity>; },
      async checkUpdate() { return invoke('check_update') as Promise<UpdateStatus>; },
      async installUpdate() { return invoke('install_update') as Promise<UpdateStatus>; },
    };
  }
  try {
    const status = await fetch('/api/status');
    if (status.ok) {
      const info = await status.json() as { version?: string };
      const identity: AppIdentity = { version: info.version ?? '0.2.0', commit: 'launcher', os: 'launcher', packaged: false };
      return {
        shell: 'launcher',
        fs: new HttpFs(),
        async setAutostart(enabled: boolean) {
          const response = await fetch('/api/autostart', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled }) });
          const body = await response.json() as { enabled?: boolean };
          return Boolean(body.enabled);
        },
        async appIdentity() { return identity; },
        async checkUpdate() {
          const manifest = await fetchManifest();
          const available = updateAvailable({ version: identity.version, commit: 'launcher-old' }, { version: manifest.version, commit: manifest.commit });
          return {
            current_version: identity.version,
            current_commit: identity.commit,
            available: true,
            version: manifest.version,
            commit: manifest.commit,
            notes: manifest.notes,
            published_at: manifest.publishedAt,
            message: available
              ? `Ruwt ${manifest.version} is the windowed app. Download it to replace this launcher.`
              : 'Download the windowed Ruwt app from ruwt.ai to replace this launcher.',
          };
        },
        async installUpdate() {
          const manifest = await fetchManifest();
          const asset = platformAsset(manifest);
          if (!asset?.url) throw new Error('No installer is published for this system.');
          window.open(asset.url, '_blank', 'noopener');
          return {
            current_version: identity.version,
            current_commit: identity.commit,
            available: true,
            version: manifest.version,
            commit: manifest.commit,
            notes: manifest.notes,
            published_at: manifest.publishedAt,
            message: 'The installer download started. Replace this launcher with the windowed app.',
          };
        },
      };
    }
  } catch { /* file:// or missing local service */ }
  throw new Error('outside-shell');
}

export { isApprovedPath };
