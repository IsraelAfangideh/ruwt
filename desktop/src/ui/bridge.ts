import type { FsLike } from '../fs.js';
import { isApprovedPath } from '../fs.js';

type Invoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

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
}

export async function createBridge(): Promise<Bridge> {
  const invoke = await waitForTauriInvoke();
  if (invoke) {
    return {
      shell: 'tauri',
      fs: new TauriFs(invoke),
      async setAutostart(enabled: boolean) { return invoke('autostart_set', { enabled }) as Promise<boolean>; },
    };
  }
  try {
    const status = await fetch('/api/status');
    if (status.ok) {
      return {
        shell: 'launcher',
        fs: new HttpFs(),
        async setAutostart(enabled: boolean) {
          const response = await fetch('/api/autostart', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled }) });
          const body = await response.json() as { enabled?: boolean };
          return Boolean(body.enabled);
        },
      };
    }
  } catch { /* file:// or missing local service */ }
  throw new Error('outside-shell');
}

export { isApprovedPath };
