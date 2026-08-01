import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { redactEvent, telemetryBatchSchema, type TelemetryEvent } from '../../dev/src/shared/intelligence/contracts.js';

export type QueueState = 'queued' | 'uploading' | 'retry' | 'rejected';
export interface QueueEntry { event: TelemetryEvent; state: QueueState; attempts: number; nextAttemptAt: string; lastError?: string; }
export interface LocalStore { version: 1; paused: boolean; approvedPaths: string[]; entries: QueueEntry[]; }

const EMPTY_STORE: LocalStore = { version: 1, paused: false, approvedPaths: [], entries: [] };

/**
 * The local service owns collection state, redaction, and synchronization.
 * It stores an atomically replaced, bounded journal until SQLite ships.
 */
export class LocalService {
  constructor(private readonly storePath: string) {}

  private async read(): Promise<LocalStore> {
    try { return { ...EMPTY_STORE, ...JSON.parse(await readFile(this.storePath, 'utf8')) }; }
    catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...EMPTY_STORE, entries: [] }; throw error; }
  }

  private async save(store: LocalStore) {
    await mkdir(dirname(this.storePath), { recursive: true, mode: 0o700 });
    const temporary = `${this.storePath}.next`;
    await writeFile(temporary, JSON.stringify(store), { mode: 0o600 });
    await rename(temporary, this.storePath);
  }

  async status() { const store = await this.read(); return { paused: store.paused, queued: store.entries.filter((entry) => entry.state === 'queued' || entry.state === 'retry').length, rejected: store.entries.filter((entry) => entry.state === 'rejected').length, approvedPaths: store.approvedPaths }; }
  async pause() { const store = await this.read(); store.paused = true; await this.save(store); }
  async resume() { const store = await this.read(); store.paused = false; await this.save(store); }
  async setApprovedPaths(paths: string[]) { const store = await this.read(); store.approvedPaths = paths.map((path) => resolve(path)); await this.save(store); }

  async enqueue(input: unknown) {
    const event = telemetryBatchSchema.parse({ events: [input] }).events[0];
    const store = await this.read();
    if (store.entries.some((entry) => entry.event.id === event.id)) return { duplicate: true };
    if (store.entries.length >= 10_000) throw new Error('The local queue reached its safe storage limit. Sync or export data before collecting more.');
    store.entries.push({ event: redactEvent(event), state: 'queued', attempts: 0, nextAttemptAt: new Date().toISOString() });
    await this.save(store);
    return { duplicate: false };
  }

  async importJson(file: string) {
    const content = JSON.parse(await readFile(file, 'utf8')) as { events?: unknown[] } | unknown[];
    const rawEvents = Array.isArray(content) ? content : content.events;
    if (!rawEvents) throw new Error('The import must contain an event array or an object with an events array.');
    let accepted = 0; let duplicates = 0;
    for (const rawEvent of rawEvents) { const result = await this.enqueue(rawEvent); if (result.duplicate) duplicates += 1; else accepted += 1; }
    return { accepted, duplicates };
  }

  async sync(endpoint: string, key: string) {
    const store = await this.read();
    if (store.paused) return { skipped: 'Collection is paused.' };
    const now = new Date();
    const eligible = store.entries.filter((entry) => (entry.state === 'queued' || entry.state === 'retry') && new Date(entry.nextAttemptAt) <= now);
    const orgId = eligible[0]?.event.orgId;
    const ready = eligible.filter((entry) => entry.event.orgId === orgId).slice(0, 250);
    if (!ready.length) return { accepted: 0, queued: store.entries.length };
    ready.forEach((entry) => { entry.state = 'uploading'; }); await this.save(store);
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ events: ready.map((entry) => entry.event) }) });
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          for (const entry of ready) {
            entry.state = 'rejected';
            entry.lastError = `The cloud service rejected this event batch (${response.status}).`;
          }
          await this.save(store);
          return { accepted: 0, rejected: ready.length, queued: store.entries.length - ready.length };
        }
        throw new Error(`The cloud service returned ${response.status}.`);
      }
      const result = await response.json() as { accepted: number; duplicate: number };
      const ids = new Set(ready.map((entry) => entry.event.id));
      store.entries = store.entries.filter((entry) => !ids.has(entry.event.id));
      await this.save(store);
      return { ...result, queued: store.entries.length };
    } catch (error) {
      for (const entry of ready) {
        entry.attempts += 1;
        entry.state = entry.attempts >= 10 ? 'rejected' : 'retry';
        entry.lastError = 'The sync failed. Ruwt did not store the server response.';
        const delayMs = Math.min(3_600_000, (2 ** entry.attempts) * 1_000) + Math.floor(Math.random() * 500);
        entry.nextAttemptAt = new Date(Date.now() + delayMs).toISOString();
      }
      await this.save(store);
      throw error;
    }
  }

  async export(file: string) { const store = await this.read(); await writeFile(file, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), events: store.entries.map((entry) => entry.event) }, null, 2), { mode: 0o600 }); }
  async deleteLocalData() { await rm(this.storePath, { force: true }); }
}
