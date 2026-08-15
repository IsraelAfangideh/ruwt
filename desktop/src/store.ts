import type { TelemetryEvent } from './event-types.js';
import type { CollectResult, SourceStatus } from './collector.js';
import type { FsLike } from './fs.js';
import { joinPath } from './fs.js';

export type QueueState = 'queued' | 'uploading' | 'retry' | 'rejected';
export interface QueueEntry { event: TelemetryEvent; state: QueueState; attempts: number; nextAttemptAt: string; lastError?: string; }

export interface LastCollect {
  at: string;
  scanned: number;
  accepted: number;
  duplicates: number;
  sources: SourceStatus[];
}

export interface LocalStore {
  version: 1;
  paused: boolean;
  approvedPaths: string[];
  entries: QueueEntry[];
  installationId: string;
  localOrgId: string;
  actorId: string;
  lastRunAt: string | null;
  autostart: boolean;
  lastCollect: LastCollect | null;
}

export const EMPTY_STORE: LocalStore = {
  version: 1,
  paused: false,
  approvedPaths: [],
  entries: [],
  installationId: '',
  localOrgId: '',
  actorId: '',
  lastRunAt: null,
  autostart: false,
  lastCollect: null,
};

export function storePathFor(home: string): string {
  return joinPath(home, '.ruwt', 'queue.json');
}

export async function loadStore(fs: FsLike, storePath: string): Promise<LocalStore> {
  try {
    const parsed = JSON.parse(await fs.readFile(storePath)) as Partial<LocalStore>;
    const store: LocalStore = {
      ...EMPTY_STORE,
      ...parsed,
      version: 1,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      approvedPaths: Array.isArray(parsed.approvedPaths) ? parsed.approvedPaths : [],
    };
    return ensureIdentity(store);
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'ENOENT') return ensureIdentity({ ...EMPTY_STORE, entries: [] });
    throw error;
  }
}

export async function saveStore(fs: FsLike, storePath: string, store: LocalStore) {
  await fs.mkdirp(storePath.replace(/[\\/][^\\/]+$/, ''));
  await fs.writeFile(storePath, JSON.stringify(store));
}

function ensureIdentity(store: LocalStore): LocalStore {
  if (!store.installationId) store.installationId = crypto.randomUUID();
  if (!store.localOrgId) store.localOrgId = crypto.randomUUID();
  if (!store.actorId) store.actorId = `local:${store.installationId.slice(0, 8)}`;
  return store;
}

export function queuedCount(store: LocalStore): number {
  return store.entries.filter((entry) => entry.state === 'queued' || entry.state === 'retry').length;
}

export function storedEvents(store: LocalStore): TelemetryEvent[] {
  return store.entries.map((entry) => entry.event);
}

export function enqueueEvents(store: LocalStore, events: TelemetryEvent[]): { accepted: number; duplicates: number } {
  const existing = new Set(store.entries.map((entry) => entry.event.id));
  let accepted = 0;
  let duplicates = 0;
  const now = new Date().toISOString();
  for (const event of events) {
    if (existing.has(event.id)) { duplicates += 1; continue; }
    if (store.entries.length >= 10_000) break;
    const state: QueueState = 'queued';
    store.entries.push({ event, state, attempts: 0, nextAttemptAt: now });
    existing.add(event.id);
    accepted += 1;
  }
  return { accepted, duplicates };
}

export function recordCollect(store: LocalStore, result: CollectResult): CollectResult {
  const counts = enqueueEvents(store, result.events);
  store.lastRunAt = new Date().toISOString();
  store.lastCollect = {
    at: store.lastRunAt,
    scanned: result.scanned,
    accepted: counts.accepted,
    duplicates: counts.duplicates,
    sources: result.sources,
  };
  return { ...result, ...counts };
}
