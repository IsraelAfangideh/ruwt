import type { FsLike } from './fs.js';
import { collectEvents, type CollectResult } from './collector.js';
import { calculateOverview, generateInsights, type Insight, type Overview } from './insights.js';
import { loadStore, queuedCount, recordCollect, saveStore, storedEvents, storePathFor, type LocalStore } from './store.js';
import type { TelemetryEvent } from './event-types.js';

export type ShellKind = 'tauri' | 'launcher' | 'none';

export interface Snapshot {
  shell: ShellKind;
  status: 'starting' | 'ready' | 'collecting' | 'paused' | 'error';
  queued: number;
  rejected: number;
  overview: Overview;
  insights: Insight[];
  events: TelemetryEvent[];
  lastRunAt: string | null;
  lastCollect: LocalStore['lastCollect'];
  paused: boolean;
  autostart: boolean;
  approvedPaths: string[];
  installationId: string;
  error?: string;
}

export class Engine {
  constructor(
    private readonly fs: FsLike,
    private readonly storePathOverride?: string,
    private readonly shell: ShellKind = 'none',
  ) {}

  private async path() {
    return this.storePathOverride ?? storePathFor(await this.fs.home());
  }

  private async load(): Promise<{ store: LocalStore; path: string }> {
    const path = await this.path();
    return { store: await loadStore(this.fs, path), path };
  }

  async snapshot(status: Snapshot['status'] = 'ready', error?: string): Promise<Snapshot> {
    const { store } = await this.load();
    const events = storedEvents(store);
    return {
      shell: this.shell,
      status: store.paused ? 'paused' : status,
      queued: queuedCount(store),
      rejected: store.entries.filter((entry) => entry.state === 'rejected').length,
      overview: calculateOverview(events),
      insights: generateInsights(events),
      events: events.slice(-40).reverse(),
      lastRunAt: store.lastRunAt,
      lastCollect: store.lastCollect,
      paused: store.paused,
      autostart: store.autostart,
      approvedPaths: store.approvedPaths,
      installationId: store.installationId,
      error,
    };
  }

  async collect(): Promise<{ result: CollectResult; snapshot: Snapshot }> {
    const { store, path } = await this.load();
    if (store.paused) {
      return { result: { scanned: 0, accepted: 0, duplicates: 0, sources: [], events: [] }, snapshot: await this.snapshot('paused') };
    }
    const identity = {
      orgId: store.localOrgId,
      actorId: store.actorId,
      desktopInstallationId: store.installationId,
    };
    const collected = await collectEvents(this.fs, identity);
    const result = recordCollect(store, collected);
    await saveStore(this.fs, path, store);
    return { result, snapshot: await this.snapshot('ready') };
  }

  async setAutostart(enabled: boolean) {
    const { store, path } = await this.load();
    store.autostart = enabled;
    await saveStore(this.fs, path, store);
    return this.snapshot();
  }

  async setPaused(paused: boolean) {
    const { store, path } = await this.load();
    store.paused = paused;
    await saveStore(this.fs, path, store);
    return this.snapshot();
  }

  async deleteLocalData() {
    const { store, path } = await this.load();
    store.entries = [];
    store.lastCollect = null;
    store.lastRunAt = null;
    await saveStore(this.fs, path, store);
    return this.snapshot();
  }
}
