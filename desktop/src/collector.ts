import type { TelemetryEvent } from './event-types.js';
import { classifyCommand, classifyFile, decodeClaudeProjectFolder, repositoryHint } from './classify.js';
import type { FsLike } from './fs.js';
import { isApprovedPath, joinPath } from './fs.js';
import { sha256Hex, uuidFromSeed } from './hash.js';

const ADAPTER_VERSION = '1.1.0';
const SCHEMA_VERSION = 1 as const;
const MAX_FILES = 120;
const MAX_FILE_BYTES = 1_500_000;
const MAX_LINES = 8_000;

export interface SourceStatus {
  id: string;
  label: string;
  files: number;
  events: number;
  detail: string;
}

export interface CollectResult {
  scanned: number;
  accepted: number;
  duplicates: number;
  sources: SourceStatus[];
  events: TelemetryEvent[];
}

export interface Identity {
  orgId: string;
  actorId: string;
  desktopInstallationId: string;
}

interface SessionAcc {
  source: string;
  vendor: string;
  sessionId: string;
  repository?: string;
  startedAt?: string;
  endedAt?: string;
  modelName?: string;
  tools: { name: string; path?: string; command?: string; at?: string }[];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function timestampOf(row: Record<string, unknown>, fallback?: string): string | undefined {
  return asString(row.timestamp) ?? asString(row.ts) ?? asString(row.createdAt) ?? fallback;
}

function collectTools(value: unknown, tools: SessionAcc['tools'], at?: string, depth = 0) {
  if (depth > 8 || !value || typeof value !== 'object') return;
  const row = value as Record<string, unknown>;
  if (row.type === 'tool_use' && typeof row.name === 'string') {
    const input = asRecord(row.input) ?? {};
    tools.push({
      name: row.name.slice(0, 128),
      path: asString(input.file_path) ?? asString(input.path) ?? asString(input.target_file),
      command: asString(input.command),
      at,
    });
  }
  for (const child of Object.values(row)) {
    if (child && typeof child === 'object') collectTools(child, tools, at, depth + 1);
  }
}

function isTranscriptFile(name: string): boolean {
  return /\.(?:jsonl|json)$/i.test(name) && !/\.vscdb$/i.test(name);
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'Cache', 'CachedData', 'GPUCache', 'Code Cache', 'logs', 'blob_storage', 'CachedExtensions', 'Crashpad', 'partitions', 'User']);
const MAX_DEPTH = 6;

async function walkTranscripts(fs: FsLike, home: string, root: string, files: { path: string; source: string }[], source: string, depth = 0) {
  if (files.length >= MAX_FILES || depth > MAX_DEPTH || !isApprovedPath(home, root)) return;
  const entries = await fs.listDir(root);
  for (const entry of entries) {
    if (files.length >= MAX_FILES) return;
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    if (entry.dir) await walkTranscripts(fs, home, entry.path, files, source, depth + 1);
    else if (isTranscriptFile(entry.name)) files.push({ path: entry.path, source });
  }
}

function parseRows(contents: string): Record<string, unknown>[] {
  const trimmed = contents.length > MAX_FILE_BYTES ? contents.slice(0, MAX_FILE_BYTES) : contents;
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return Array.isArray(parsed) ? parsed.map(asRecord).filter((row): row is Record<string, unknown> => Boolean(row)).slice(0, MAX_LINES) : [];
    } catch {
      return [];
    }
  }
  const rows: Record<string, unknown>[] = [];
  for (const line of trimmed.split('\n')) {
    if (rows.length >= MAX_LINES) break;
    const text = line.trim();
    if (!text.startsWith('{')) continue;
    try {
      const row = asRecord(JSON.parse(text));
      if (row) rows.push(row);
    } catch { /* skip malformed transcript lines */ }
  }
  return rows;
}

function parseSession(path: string, source: string, contents: string): SessionAcc | undefined {
  const rows = parseRows(contents);
  if (!rows.length) return undefined;
  const fileName = path.split(/[\\/]/).at(-1)?.replace(/\.(?:jsonl|json)$/i, '') ?? 'session';
  const folder = path.split(/[\\/]/).at(-2) ?? '';
  const project = source === 'claude-code' ? decodeClaudeProjectFolder(folder) : folder;
  const tools: SessionAcc['tools'] = [];
  let startedAt: string | undefined;
  let endedAt: string | undefined;
  let modelName: string | undefined;
  for (const row of rows) {
    const at = timestampOf(row);
    if (at) {
      if (!startedAt || at < startedAt) startedAt = at;
      if (!endedAt || at > endedAt) endedAt = at;
    }
    const message = asRecord(row.message);
    modelName = modelName ?? asString(row.model) ?? asString(message?.model);
    collectTools(row, tools, at);
  }
  if (!startedAt && !tools.length) return undefined;
  return {
    source,
    vendor: source,
    sessionId: fileName.slice(0, 128),
    repository: repositoryHint(project),
    startedAt,
    endedAt: endedAt ?? startedAt,
    modelName: modelName?.slice(0, 128),
    tools,
  };
}

async function eventBase(identity: Identity, session: SessionAcc, seed: string, type: TelemetryEvent['type'], timestamp: string): Promise<TelemetryEvent> {
  return {
    id: await uuidFromSeed(seed),
    schemaVersion: SCHEMA_VERSION,
    timestamp,
    orgId: identity.orgId,
    actorId: identity.actorId,
    sessionId: session.sessionId,
    integrationSource: session.source,
    adapterVersion: ADAPTER_VERSION,
    desktopInstallationId: identity.desktopInstallationId,
    type,
    agentVendor: session.vendor,
    modelName: session.modelName,
    repository: session.repository,
    redactionStatus: 'not_required',
    confidence: 'high',
    metadata: { dataNotice: 'Metadata only. Raw prompts were not stored.' },
  };
}

async function eventsFromSession(identity: Identity, session: SessionAcc, filePath: string): Promise<TelemetryEvent[]> {
  const started = session.startedAt ?? new Date().toISOString();
  const ended = session.endedAt ?? started;
  const durationMs = Math.max(0, new Date(ended).getTime() - new Date(started).getTime());
  const events: TelemetryEvent[] = [];
  events.push(await eventBase(identity, session, `${filePath}:session.started`, 'session.started', started));
  if (session.modelName) {
    const invoked = await eventBase(identity, session, `${filePath}:model.invoked`, 'model.invoked', started);
    invoked.modelProvider = session.vendor === 'claude-code' ? 'anthropic' : session.vendor;
    events.push(invoked);
  }
  let index = 0;
  for (const tool of session.tools) {
    const at = tool.at ?? started;
    const called = await eventBase(identity, session, `${filePath}:tool:${index}:${tool.name}`, 'tool.called', at);
    called.toolName = tool.name;
    events.push(called);
    if (tool.path) {
      const modified = await eventBase(identity, session, `${filePath}:file:${index}:${tool.name}`, /read/i.test(tool.name) ? 'file.read' : 'file.modified', at);
      modified.fileClassification = classifyFile(tool.path);
      modified.toolName = tool.name;
      modified.metadata = { ...modified.metadata, pathHash: (await sha256Hex(tool.path)).slice(0, 16), dataNotice: 'Metadata only. Raw prompts were not stored.' };
      events.push(modified);
    }
    if (tool.command) {
      const classified = classifyCommand(tool.command);
      const executed = await eventBase(identity, session, `${filePath}:cmd:${index}`, 'command.executed', at);
      executed.commandClassification = classified.classification;
      executed.toolName = tool.name;
      executed.metadata = { ...executed.metadata, commandHash: (await sha256Hex(tool.command)).slice(0, 16), dataNotice: 'Metadata only. Raw prompts were not stored.' };
      events.push(executed);
      if (classified.isTest) {
        const test = await eventBase(identity, session, `${filePath}:test:${index}`, 'test.completed', at);
        test.testResult = 'unknown';
        test.commandClassification = 'test';
        events.push(test);
      }
    }
    index += 1;
  }
  const endedEvent = await eventBase(identity, session, `${filePath}:session.ended`, 'session.ended', ended);
  endedEvent.durationMs = Number.isFinite(durationMs) ? Math.min(durationMs, 86_400_000) : undefined;
  endedEvent.outcome = 'unknown';
  events.push(endedEvent);
  return events;
}

const SOURCES: { id: string; label: string; folders: (home: string) => string[] }[] = [
  { id: 'claude-code', label: 'Claude Code', folders: (home) => [joinPath(home, '.claude', 'projects')] },
  { id: 'cursor', label: 'Cursor', folders: (home) => [joinPath(home, '.cursor', 'projects'), joinPath(home, '.cursor', 'chats')] },
  { id: 'codex', label: 'Codex', folders: (home) => [joinPath(home, '.codex')] },
];

export async function collectEvents(fs: FsLike, identity: Identity): Promise<CollectResult> {
  const home = await fs.home();
  const sources: SourceStatus[] = [];
  const events: TelemetryEvent[] = [];
  let scanned = 0;

  for (const source of SOURCES) {
    const files: { path: string; source: string }[] = [];
    for (const folder of source.folders(home)) {
      if (!await fs.exists(folder)) continue;
      await walkTranscripts(fs, home, folder, files, source.id);
    }
    let sourceEvents = 0;
    for (const file of files) {
      scanned += 1;
      let contents = '';
      try { contents = await fs.readFile(file.path); }
      catch { continue; }
      const session = parseSession(file.path, file.source, contents);
      if (!session) continue;
      const produced = await eventsFromSession(identity, session, file.path);
      sourceEvents += produced.length;
      events.push(...produced);
    }
    sources.push({
      id: source.id,
      label: source.label,
      files: files.length,
      events: sourceEvents,
      detail: files.length
        ? `Scanned ${files.length} session file${files.length === 1 ? '' : 's'}. Metadata only.`
        : `No session files in ${source.label} folders.`,
    });
  }

  return { scanned, accepted: events.length, duplicates: 0, sources, events };
}
