// src/classify.ts
var credential = /(?:^|[\\/])(?:\.env(?:\..+)?|credentials(?:\..+)?|id_rsa|id_ed25519|\.netrc|auth\.json)$|\.(?:pem|p12|pfx|key)$|secret/i;
var sensitive = /(?:^|[\\/])(?:\.ssh|\.gnupg|wallet|keystore|passwords?)(?:$|[\\/])/i;
var source = /\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|rb|c|h|cc|cpp|cs|swift|sql|md|json|yml|yaml|toml)$/i;
var testCommand = /\b(?:pytest|vitest|jest|mocha|phpunit|rspec|npx test|npm test|pnpm test|yarn test|cargo test|go test)\b/i;
var dangerousCommand = /\brm\s+-rf\b|\bsudo\b|\bchmod\s+777\b|\bcurl\b.+\|\s*(?:ba)?sh\b/i;
function classifyFile(path) {
  if (credential.test(path)) return "credential";
  if (sensitive.test(path)) return "sensitive";
  if (source.test(path)) return "source";
  return "unknown";
}
function classifyCommand(command) {
  if (testCommand.test(command)) return { classification: "test", isTest: true };
  if (dangerousCommand.test(command)) return { classification: "dangerous", isTest: false };
  return { classification: "command", isTest: false };
}
function decodeClaudeProjectFolder(name) {
  if (!name.startsWith("-")) return name.replace(/-/g, "/");
  return name.slice(1).replace(/-/g, "/");
}
function repositoryHint(projectPath) {
  const parts = projectPath.split(/[\\/]/).filter(Boolean);
  const last = parts.at(-1);
  return last && last.length <= 256 ? last : void 0;
}

// src/fs.ts
function pathSep(home) {
  return home.includes("\\") ? "\\" : "/";
}
function joinPath(home, ...parts) {
  const sep = pathSep(home);
  return [home.replace(/[\\/]+$/, ""), ...parts].join(sep);
}
function readRoots(home) {
  return [
    joinPath(home, ".ruwt"),
    joinPath(home, ".claude"),
    joinPath(home, ".cursor"),
    joinPath(home, ".codex"),
    joinPath(home, "Library", "Application Support", "Cursor"),
    joinPath(home, "AppData", "Roaming", "Cursor"),
    joinPath(home, ".config", "Cursor")
  ];
}
function writeRoot(home) {
  return joinPath(home, ".ruwt");
}
function isApprovedPath(home, target, write = false) {
  if (!target || target.split(/[\\/]/).includes("..")) return false;
  const sep = pathSep(home);
  const normalize = (value) => value.replace(/[\\/]+/g, sep);
  const resolved = normalize(target);
  const ruwt = normalize(writeRoot(home));
  if (write) return resolved === ruwt || resolved.startsWith(ruwt + sep);
  return readRoots(home).some((root) => {
    const prefix = normalize(root);
    return resolved === prefix || resolved.startsWith(prefix + sep);
  });
}

// src/hash.ts
async function sha256Hex(input) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function uuidFromSeed(seed) {
  const hex = await sha256Hex(seed);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// src/collector.ts
var ADAPTER_VERSION = "1.1.0";
var SCHEMA_VERSION = 1;
var MAX_FILES = 120;
var MAX_FILE_BYTES = 15e5;
var MAX_LINES = 8e3;
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function asString(value) {
  return typeof value === "string" && value.trim() ? value : void 0;
}
function timestampOf(row, fallback) {
  return asString(row.timestamp) ?? asString(row.ts) ?? asString(row.createdAt) ?? fallback;
}
function collectTools(value, tools, at, depth = 0) {
  if (depth > 8 || !value || typeof value !== "object") return;
  const row = value;
  if (row.type === "tool_use" && typeof row.name === "string") {
    const input = asRecord(row.input) ?? {};
    tools.push({
      name: row.name.slice(0, 128),
      path: asString(input.file_path) ?? asString(input.path) ?? asString(input.target_file),
      command: asString(input.command),
      at
    });
  }
  for (const child of Object.values(row)) {
    if (child && typeof child === "object") collectTools(child, tools, at, depth + 1);
  }
}
var SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", "Cache", "CachedData", "GPUCache", "Code Cache", "logs", "blob_storage", "CachedExtensions", "Crashpad", "partitions", "User", "canvases", "terminals", "skills-cursor", "agent-hooks", "sandbox-policies", "bin"]);
var MAX_DEPTH = 6;
function isTranscriptFile(name) {
  if (/\.jsonl$/i.test(name)) return true;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/i.test(name);
}
async function walkTranscripts(fs, home, root, files, source2, depth = 0) {
  if (files.length >= MAX_FILES || depth > MAX_DEPTH || !isApprovedPath(home, root)) return;
  const entries = await fs.listDir(root);
  for (const entry of entries) {
    if (files.length >= MAX_FILES) return;
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    if (entry.dir) await walkTranscripts(fs, home, entry.path, files, source2, depth + 1);
    else if (isTranscriptFile(entry.name)) files.push({ path: entry.path, source: source2 });
  }
}
function parseRows(contents) {
  const trimmed = contents.length > MAX_FILE_BYTES ? contents.slice(0, MAX_FILE_BYTES) : contents;
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.map(asRecord).filter((row) => Boolean(row)).slice(0, MAX_LINES) : [];
    } catch {
      return [];
    }
  }
  const rows = [];
  for (const line of trimmed.split("\n")) {
    if (rows.length >= MAX_LINES) break;
    const text = line.trim();
    if (!text.startsWith("{")) continue;
    try {
      const row = asRecord(JSON.parse(text));
      if (row) rows.push(row);
    } catch {
    }
  }
  return rows;
}
function parseSession(path, source2, contents) {
  const rows = parseRows(contents);
  if (!rows.length) return void 0;
  const fileName = path.split(/[\\/]/).at(-1)?.replace(/\.(?:jsonl|json)$/i, "") ?? "session";
  const folder = path.split(/[\\/]/).at(-2) ?? "";
  const project = source2 === "claude-code" ? decodeClaudeProjectFolder(folder) : folder;
  const tools = [];
  let startedAt;
  let endedAt;
  let modelName;
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
  if (!startedAt && !tools.length) return void 0;
  return {
    source: source2,
    vendor: source2,
    sessionId: fileName.slice(0, 128),
    repository: repositoryHint(project),
    startedAt,
    endedAt: endedAt ?? startedAt,
    modelName: modelName?.slice(0, 128),
    tools
  };
}
async function eventBase(identity, session, seed, type, timestamp) {
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
    redactionStatus: "not_required",
    confidence: "high",
    metadata: { dataNotice: "Metadata only. Raw prompts were not stored." }
  };
}
async function eventsFromSession(identity, session, filePath) {
  const started = session.startedAt ?? (/* @__PURE__ */ new Date()).toISOString();
  const ended = session.endedAt ?? started;
  const durationMs = Math.max(0, new Date(ended).getTime() - new Date(started).getTime());
  const events = [];
  events.push(await eventBase(identity, session, `${filePath}:session.started`, "session.started", started));
  if (session.modelName) {
    const invoked = await eventBase(identity, session, `${filePath}:model.invoked`, "model.invoked", started);
    invoked.modelProvider = session.vendor === "claude-code" ? "anthropic" : session.vendor;
    events.push(invoked);
  }
  let index = 0;
  for (const tool of session.tools) {
    const at = tool.at ?? started;
    const called = await eventBase(identity, session, `${filePath}:tool:${index}:${tool.name}`, "tool.called", at);
    called.toolName = tool.name;
    events.push(called);
    if (tool.path) {
      const modified = await eventBase(identity, session, `${filePath}:file:${index}:${tool.name}`, /read/i.test(tool.name) ? "file.read" : "file.modified", at);
      modified.fileClassification = classifyFile(tool.path);
      modified.toolName = tool.name;
      modified.metadata = { ...modified.metadata, pathHash: (await sha256Hex(tool.path)).slice(0, 16), dataNotice: "Metadata only. Raw prompts were not stored." };
      events.push(modified);
    }
    if (tool.command) {
      const classified = classifyCommand(tool.command);
      const executed = await eventBase(identity, session, `${filePath}:cmd:${index}`, "command.executed", at);
      executed.commandClassification = classified.classification;
      executed.toolName = tool.name;
      executed.metadata = { ...executed.metadata, commandHash: (await sha256Hex(tool.command)).slice(0, 16), dataNotice: "Metadata only. Raw prompts were not stored." };
      events.push(executed);
      if (classified.isTest) {
        const test = await eventBase(identity, session, `${filePath}:test:${index}`, "test.completed", at);
        test.testResult = "unknown";
        test.commandClassification = "test";
        events.push(test);
      }
    }
    index += 1;
  }
  const endedEvent = await eventBase(identity, session, `${filePath}:session.ended`, "session.ended", ended);
  endedEvent.durationMs = Number.isFinite(durationMs) ? Math.min(durationMs, 864e5) : void 0;
  endedEvent.outcome = "unknown";
  events.push(endedEvent);
  return events;
}
var SOURCES = [
  { id: "claude-code", label: "Claude Code", folders: (home) => [joinPath(home, ".claude", "projects")] },
  { id: "cursor", label: "Cursor", folders: (home) => [joinPath(home, ".cursor", "projects"), joinPath(home, ".cursor", "chats")] },
  { id: "codex", label: "Codex", folders: (home) => [joinPath(home, ".codex")] }
];
async function collectEvents(fs, identity) {
  const home = await fs.home();
  const sources = [];
  const events = [];
  let scanned = 0;
  for (const source2 of SOURCES) {
    const files = [];
    for (const folder of source2.folders(home)) {
      if (!await fs.exists(folder)) continue;
      await walkTranscripts(fs, home, folder, files, source2.id);
    }
    let sourceEvents = 0;
    for (const file of files) {
      scanned += 1;
      let contents = "";
      try {
        contents = await fs.readFile(file.path);
      } catch {
        continue;
      }
      const session = parseSession(file.path, file.source, contents);
      if (!session) continue;
      const produced = await eventsFromSession(identity, session, file.path);
      sourceEvents += produced.length;
      events.push(...produced);
    }
    sources.push({
      id: source2.id,
      label: source2.label,
      files: files.length,
      events: sourceEvents,
      detail: files.length ? `Scanned ${files.length} session file${files.length === 1 ? "" : "s"}. Metadata only.` : `No session files in ${source2.label} folders.`
    });
  }
  return { scanned, accepted: events.length, duplicates: 0, sources, events };
}

// src/insights.ts
var percent = (part, whole) => whole ? Math.round(part / whole * 100) : 0;
var sessionIds = (events) => [...new Set(events.flatMap((event) => event.sessionId ? [event.sessionId] : []))];
function calculateOverview(events) {
  const tests = events.filter((event) => event.type === "test.completed");
  const passed = tests.filter((event) => event.testResult === "passed");
  const knownFields = events.filter((event) => event.actorId && event.repository && event.agentVendor).length;
  return {
    activeAgents: new Set(events.map((event) => event.agentVendor).filter(Boolean)).size,
    sessions: sessionIds(events).length,
    events: events.length,
    totalCostMicros: events.reduce((sum, event) => sum + (event.estimatedCostMicros ?? 0), 0),
    firstPassTestRate: percent(passed.length, tests.length),
    mergedPullRequests: events.filter((event) => event.type === "pull_request.merged").length,
    coverage: percent(knownFields, events.length)
  };
}
function generateInsights(events) {
  if (!events.length) return [];
  const result = [];
  const overview = calculateOverview(events);
  const completedTests = events.filter((event) => event.type === "test.completed");
  const modified = events.filter((event) => event.type === "file.modified");
  const sessionsWithTests = new Set(completedTests.map((event) => event.sessionId).filter(Boolean));
  const costEvents = events.filter((event) => (event.estimatedCostMicros ?? 0) > 0);
  const meanCost = costEvents.reduce((total, event) => total + (event.estimatedCostMicros ?? 0), 0) / Math.max(costEvents.length, 1);
  const highCostFailures = costEvents.filter((event) => event.outcome === "failure" && (event.estimatedCostMicros ?? 0) > meanCost * 2);
  const sensitive2 = events.filter((event) => event.fileClassification === "sensitive" || event.fileClassification === "credential");
  const unknownActors = events.filter((event) => !event.actorId);
  const outdated = events.filter((event) => /(?:^|\.)0(?:\.|$)|deprecated/i.test(event.adapterVersion));
  const rework = events.filter((event) => event.outcome === "rework" || event.type === "incident.created");
  const abandonedLong = events.filter((event) => event.outcome === "abandoned" && (event.durationMs ?? 0) >= 27e5);
  const tools = events.filter((event) => event.type === "tool.called" || event.type === "tool.completed");
  const byAgent = /* @__PURE__ */ new Map();
  for (const event of completedTests) {
    if (event.agentVendor) byAgent.set(event.agentVendor, [...byAgent.get(event.agentVendor) ?? [], event]);
  }
  const add = (insight, active) => {
    if (active) result.push(insight);
  };
  add({
    ruleId: "activity_summary",
    title: "Observed activity on this machine",
    summary: `${overview.sessions} agent session${overview.sessions === 1 ? "" : "s"} produced ${overview.events} redacted events across ${overview.activeAgents || 0} agent${overview.activeAgents === 1 ? "" : "s"}.`,
    confidence: overview.events >= 20 ? "high" : "medium",
    coverage: overview.coverage,
    sampleSize: overview.events,
    recommendation: "Use the other rules below for exceptions. This card is a count, not a judgment.",
    limitations: "Only approved local session files are visible. Live hooks are not required."
  }, true);
  add({
    ruleId: "tool_activity",
    title: "Tool use is visible",
    summary: `${tools.length} tool events were recorded without storing prompts or file contents.`,
    confidence: "high",
    coverage: overview.coverage,
    sampleSize: tools.length,
    recommendation: "Open Activity to inspect vendors, repositories, and redaction state.",
    limitations: "Tool names are kept. Arguments, diffs, and command text are not."
  }, tools.length > 0);
  add({
    ruleId: "high_cost_unsuccessful_sessions",
    title: "High-cost sessions need review",
    summary: `${highCostFailures.length} failed events cost more than twice the observed average.`,
    confidence: highCostFailures.length >= 5 ? "high" : "medium",
    coverage: overview.coverage,
    sampleSize: costEvents.length,
    recommendation: "Review task framing and model choice before another attempt.",
    limitations: "Costs are estimates from available adapter metadata."
  }, highCostFailures.length > 0);
  add({
    ruleId: "tests_missing_after_change",
    title: "Agent changes lack observed tests",
    summary: `${modified.filter((event) => !sessionsWithTests.has(event.sessionId)).length} file changes have no completed test in the same session.`,
    confidence: "medium",
    coverage: overview.coverage,
    sampleSize: modified.length,
    recommendation: "Add a test step to the affected workflow.",
    limitations: "Tests run outside supported sources are not visible."
  }, modified.some((event) => event.sessionId && !sessionsWithTests.has(event.sessionId)));
  add({
    ruleId: "sensitive_file_access",
    title: "Sensitive file access occurred",
    summary: `${sensitive2.length} events accessed a sensitive file classification.`,
    confidence: "high",
    coverage: overview.coverage,
    sampleSize: sensitive2.length,
    recommendation: "Review the path policy and adapter access scope.",
    limitations: "Ruwt stores classifications, not file contents."
  }, sensitive2.length > 0);
  add({
    ruleId: "missing_actor_attribution",
    title: "Actor attribution is incomplete",
    summary: `${percent(unknownActors.length, events.length)}% of events have no actor identifier.`,
    confidence: "high",
    coverage: overview.coverage,
    sampleSize: events.length,
    recommendation: "Repair desktop sign-in or the affected integration.",
    limitations: "Pseudonymous actor settings can reduce attribution intentionally."
  }, unknownActors.length > 0);
  add({
    ruleId: "outdated_adapter",
    title: "An adapter needs attention",
    summary: `${outdated.length} events came from an outdated or initial adapter version.`,
    confidence: "medium",
    coverage: overview.coverage,
    sampleSize: outdated.length,
    recommendation: "Update the desktop application before using this data for decisions.",
    limitations: "Version age does not prove data loss."
  }, outdated.length > 0);
  add({
    ruleId: "rework_signal",
    title: "Rework signal detected",
    summary: `${rework.length} events indicate rework or a related incident.`,
    confidence: rework.length >= 3 ? "medium" : "low",
    coverage: overview.coverage,
    sampleSize: events.length,
    recommendation: "Inspect linked activity before changing team process.",
    limitations: "Ruwt does not infer that the agent caused the rework."
  }, rework.length > 0);
  add({
    ruleId: "long_session_abandonment",
    title: "Long sessions end without an outcome",
    summary: `${abandonedLong.length} sessions ran for at least 45 minutes before abandonment.`,
    confidence: abandonedLong.length >= 3 ? "medium" : "low",
    coverage: overview.coverage,
    sampleSize: events.length,
    recommendation: "Split large tasks into smaller, testable steps.",
    limitations: "Duration can include time away from the editor."
  }, abandonedLong.length > 0);
  for (const [agent, agentTests] of byAgent) {
    if (agentTests.length < 5) continue;
    const rate = percent(agentTests.filter((event) => event.testResult === "passed").length, agentTests.length);
    const others = completedTests.filter((event) => event.agentVendor !== agent);
    const otherRate = percent(others.filter((event) => event.testResult === "passed").length, others.length);
    if (Math.abs(rate - otherRate) >= 20) {
      add({
        ruleId: "agent_task_outcome_difference",
        title: `${agent} shows a different test outcome`,
        summary: `${agent} has a ${rate}% observed test pass rate, compared with ${otherRate}% for other recorded agents.`,
        confidence: agentTests.length >= 20 ? "high" : "medium",
        coverage: overview.coverage,
        sampleSize: agentTests.length,
        recommendation: "Compare the tools within the same task category before standardizing.",
        limitations: "This comparison shows correlation, not causation."
      }, true);
    }
  }
  return result.slice(0, 12);
}

// src/store.ts
var EMPTY_STORE = {
  version: 1,
  paused: false,
  approvedPaths: [],
  entries: [],
  installationId: "",
  localOrgId: "",
  actorId: "",
  lastRunAt: null,
  autostart: false,
  lastCollect: null
};
function storePathFor(home) {
  return joinPath(home, ".ruwt", "queue.json");
}
async function loadStore(fs, storePath) {
  try {
    const parsed = JSON.parse(await fs.readFile(storePath));
    const store = {
      ...EMPTY_STORE,
      ...parsed,
      version: 1,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      approvedPaths: Array.isArray(parsed.approvedPaths) ? parsed.approvedPaths : []
    };
    return ensureIdentity(store);
  } catch (error) {
    if (error.code === "ENOENT") return ensureIdentity({ ...EMPTY_STORE, entries: [] });
    throw error;
  }
}
async function saveStore(fs, storePath, store) {
  await fs.mkdirp(storePath.replace(/[\\/][^\\/]+$/, ""));
  await fs.writeFile(storePath, JSON.stringify(store));
}
function ensureIdentity(store) {
  if (!store.installationId) store.installationId = crypto.randomUUID();
  if (!store.localOrgId) store.localOrgId = crypto.randomUUID();
  if (!store.actorId) store.actorId = `local:${store.installationId.slice(0, 8)}`;
  return store;
}
function queuedCount(store) {
  return store.entries.filter((entry) => entry.state === "queued" || entry.state === "retry").length;
}
function storedEvents(store) {
  return store.entries.map((entry) => entry.event);
}
function enqueueEvents(store, events) {
  const existing = new Set(store.entries.map((entry) => entry.event.id));
  let accepted = 0;
  let duplicates = 0;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  for (const event of events) {
    if (existing.has(event.id)) {
      duplicates += 1;
      continue;
    }
    if (store.entries.length >= 1e4) break;
    const state = "queued";
    store.entries.push({ event, state, attempts: 0, nextAttemptAt: now });
    existing.add(event.id);
    accepted += 1;
  }
  return { accepted, duplicates };
}
function recordCollect(store, result) {
  const counts = enqueueEvents(store, result.events);
  store.lastRunAt = (/* @__PURE__ */ new Date()).toISOString();
  store.lastCollect = {
    at: store.lastRunAt,
    scanned: result.scanned,
    accepted: counts.accepted,
    duplicates: counts.duplicates,
    sources: result.sources
  };
  return { ...result, ...counts };
}

// src/engine.ts
var Engine = class {
  constructor(fs, storePathOverride, shell = "none") {
    this.fs = fs;
    this.storePathOverride = storePathOverride;
    this.shell = shell;
  }
  async path() {
    return this.storePathOverride ?? storePathFor(await this.fs.home());
  }
  async load() {
    const path = await this.path();
    return { store: await loadStore(this.fs, path), path };
  }
  async snapshot(status = "ready", error) {
    const { store } = await this.load();
    const events = storedEvents(store);
    return {
      shell: this.shell,
      status: store.paused ? "paused" : status,
      queued: queuedCount(store),
      rejected: store.entries.filter((entry) => entry.state === "rejected").length,
      overview: calculateOverview(events),
      insights: generateInsights(events),
      events: events.slice(-40).reverse(),
      lastRunAt: store.lastRunAt,
      lastCollect: store.lastCollect,
      paused: store.paused,
      autostart: store.autostart,
      approvedPaths: store.approvedPaths,
      installationId: store.installationId,
      error
    };
  }
  async collect() {
    const { store, path } = await this.load();
    if (store.paused) {
      return { result: { scanned: 0, accepted: 0, duplicates: 0, sources: [], events: [] }, snapshot: await this.snapshot("paused") };
    }
    const identity = {
      orgId: store.localOrgId,
      actorId: store.actorId,
      desktopInstallationId: store.installationId
    };
    const collected = await collectEvents(this.fs, identity);
    const result = recordCollect(store, collected);
    await saveStore(this.fs, path, store);
    return { result, snapshot: await this.snapshot("ready") };
  }
  async setAutostart(enabled) {
    const { store, path } = await this.load();
    store.autostart = enabled;
    await saveStore(this.fs, path, store);
    return this.snapshot();
  }
  async setPaused(paused) {
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
};

// src/ui/bridge.ts
function tauriInvoke() {
  const tauri = window.__TAURI__;
  return tauri?.core?.invoke;
}
function detectShell() {
  if (window.__TAURI_INTERNALS__ || tauriInvoke()) return "tauri";
  if (["127.0.0.1", "localhost"].includes(location.hostname) && location.protocol.startsWith("http")) return "launcher";
  return "none";
}
var TauriFs = class {
  constructor(invoke) {
    this.invoke = invoke;
  }
  async home() {
    return this.invoke("home_dir");
  }
  async readFile(path) {
    return this.invoke("read_text_file", { path });
  }
  async writeFile(path, contents) {
    await this.invoke("write_text_file", { path, contents });
  }
  async mkdirp(path) {
    await this.invoke("mkdirp", { path });
  }
  async exists(path) {
    return this.invoke("path_exists", { path });
  }
  async listDir(path) {
    return this.invoke("list_dir", { path });
  }
};
var HttpFs = class {
  async call(route, body = {}) {
    const response = await fetch(route, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`Local Ruwt service returned ${response.status}.`);
    return response.json();
  }
  async home() {
    return (await this.call("/api/fs/home")).home;
  }
  async readFile(path) {
    return (await this.call("/api/fs/read", { path })).contents;
  }
  async writeFile(path, contents) {
    await this.call("/api/fs/write", { path, contents });
  }
  async mkdirp(path) {
    await this.call("/api/fs/mkdirp", { path });
  }
  async exists(path) {
    return (await this.call("/api/fs/exists", { path })).exists;
  }
  async listDir(path) {
    return (await this.call("/api/fs/list", { path })).entries;
  }
};
async function createBridge() {
  const invoke = tauriInvoke();
  if (invoke) {
    return {
      shell: "tauri",
      fs: new TauriFs(invoke),
      async setAutostart(enabled) {
        return invoke("autostart_set", { enabled });
      }
    };
  }
  try {
    const status = await fetch("/api/status");
    if (status.ok) {
      return {
        shell: "launcher",
        fs: new HttpFs(),
        async setAutostart(enabled) {
          const response = await fetch("/api/autostart", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled }) });
          const body = await response.json();
          return Boolean(body.enabled);
        }
      };
    }
  } catch {
  }
  throw new Error("outside-shell");
}

// src/ui/main.ts
var money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
var relative = (value) => {
  if (!value) return "No run yet.";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 6e4));
  if (minutes < 1) return "Collected just now.";
  if (minutes < 60) return `Collected ${minutes} min ago.`;
  return `Collected ${Math.round(minutes / 60)} hr ago.`;
};
var engine;
var snapshot;
var tab = "insights";
var busy = false;
var $ = (id) => document.getElementById(id);
function render() {
  const view = snapshot;
  const status = busy ? "collecting" : view?.status ?? "starting";
  $("status-badge").textContent = status === "ready" ? "Ready" : status === "paused" ? "Paused" : status === "collecting" ? "Collecting" : status === "error" ? "Error" : "Starting";
  $("status-badge").dataset.state = status;
  $("queue-badge").textContent = `Queue ${view?.queued ?? 0}`;
  $("run-status").textContent = view?.error ?? relative(view?.lastRunAt ?? null);
  $("autostart").toggleAttribute("data-on", Boolean(view?.autostart));
  $("autostart-label").textContent = view?.autostart ? "Start at login on" : "Start at login";
  const banner = $("shell-banner");
  banner.hidden = view?.shell !== "none";
  for (const button of document.querySelectorAll("[data-tab]")) {
    const active = button.dataset.tab === tab;
    button.setAttribute("aria-selected", String(active));
    const panel = $(`panel-${button.dataset.tab}`);
    panel.hidden = !active;
  }
  renderInsights();
  renderActivity();
  renderIntegrations();
  renderPrivacy();
  renderDiagnostics();
}
function metric(label, value, note) {
  return `<article class="metric"><span>${label}</span><b>${value}</b><small>${note}</small></article>`;
}
function renderInsights() {
  const panel = $("panel-insights");
  const overview = snapshot?.overview;
  const insights = snapshot?.insights ?? [];
  if (!snapshot || snapshot.status === "starting") {
    panel.querySelector(".stack").innerHTML = `<p class="empty">Ruwt is starting the local collector.</p>`;
    return;
  }
  if (!overview?.events) {
    panel.querySelector(".stack").innerHTML = `
      ${metric("Sessions", "0", "No agent session files read yet")}
      ${metric("Events", "0", "Metadata only, stored on this machine")}
      ${metric("Estimated cost", money.format(0), "Adapter usage metadata when present")}
      <div class="empty-card">
        <h3>No activity on this machine yet</h3>
        <p>Ruwt reads Claude Code, Cursor, and Codex session files from approved folders. Nothing is guessed. Press Collect now after you use an agent.</p>
      </div>`;
    return;
  }
  panel.querySelector(".stack").innerHTML = `
    <div class="metrics">
      ${metric("Active agents", String(overview.activeAgents), "Vendors observed in local session files")}
      ${metric("Sessions", String(overview.sessions), `${overview.events} redacted events`)}
      ${metric("Estimated cost", money.format(overview.totalCostMicros / 1e6), "From adapter usage metadata")}
      ${metric("First-pass tests", `${overview.firstPassTestRate}%`, "Only observed completed tests")}
      ${metric("Merged pull requests", String(overview.mergedPullRequests), "Connected activity only")}
      ${metric("Data coverage", `${overview.coverage}%`, "Actor, repository, and agent known")}
    </div>
    <div class="ledger">
      ${insights.map((insight) => `
        <article class="insight" data-confidence="${insight.confidence}">
          <h3>${insight.title}</h3>
          <p class="meta">${insight.confidence} confidence \xB7 n=${insight.sampleSize}</p>
          <p>${insight.summary}</p>
          <p class="reco">${insight.recommendation}</p>
          <p class="limit">${insight.limitations}</p>
        </article>`).join("")}
    </div>`;
}
function renderActivity() {
  const events = snapshot?.events ?? [];
  $("panel-activity").querySelector(".stack").innerHTML = events.length ? `<div class="table">${events.map((event) => `
    <div class="row">
      <time>${new Date(event.timestamp).toLocaleString()}</time>
      <div><b>${event.type}</b><span>${event.agentVendor ?? "Unknown agent"} \xB7 ${event.repository ?? "Repository not available"}${event.toolName ? ` \xB7 ${event.toolName}` : ""}</span></div>
      <em>${event.redactionStatus}</em>
    </div>`).join("")}</div>` : `<p class="empty">No redacted activity is stored yet.</p>`;
}
function renderIntegrations() {
  const sources = snapshot?.lastCollect?.sources ?? [
    { id: "claude-code", label: "Claude Code", files: 0, events: 0, detail: "Not scanned yet." },
    { id: "cursor", label: "Cursor", files: 0, events: 0, detail: "Not scanned yet." },
    { id: "codex", label: "Codex", files: 0, events: 0, detail: "Not scanned yet." }
  ];
  $("panel-integrations").querySelector(".stack").innerHTML = sources.map((source2) => `
    <article class="card">
      <h3>${source2.label}</h3>
      <p>${source2.detail}</p>
      <p class="meta">${source2.files} files \xB7 ${source2.events} events</p>
    </article>`).join("") + `<p class="note">Ruwt does not claim a live hook. It scans approved session files and keeps metadata only.</p>`;
}
function renderPrivacy() {
  $("panel-privacy").querySelector(".stack").innerHTML = `
    <article class="card">
      <h3>Raw prompts stored</h3>
      <p><b>0</b>. Session files are read in memory. Prompt text, diffs, and command strings are discarded before the journal is written.</p>
    </article>
    <article class="card">
      <h3>Approved folders</h3>
      <p>~/.claude, ~/.cursor, ~/.codex, and this machine\u2019s Cursor application-support folder. Writes stay in ~/.ruwt.</p>
    </article>
    <button class="danger" id="delete-data" type="button">Delete local data</button>`;
  $("delete-data")?.addEventListener("click", () => void onDelete());
}
function renderDiagnostics() {
  const collect = snapshot?.lastCollect;
  $("panel-diagnostics").querySelector(".stack").innerHTML = `
    <pre>${JSON.stringify({
    shell: snapshot?.shell ?? detectShell(),
    status: snapshot?.status ?? "starting",
    installationId: snapshot?.installationId,
    lastRunAt: snapshot?.lastRunAt,
    queued: snapshot?.queued ?? 0,
    lastCollect: collect,
    error: snapshot?.error
  }, null, 2)}</pre>`;
}
async function onCollect() {
  if (!engine || busy) return;
  busy = true;
  render();
  try {
    snapshot = (await engine.collect()).snapshot;
  } catch (error) {
    snapshot = snapshot ? { ...snapshot, status: "error", error: error instanceof Error ? error.message : "Collect failed." } : void 0;
  } finally {
    busy = false;
    render();
  }
}
async function onDelete() {
  if (!engine) return;
  snapshot = await engine.deleteLocalData();
  render();
}
async function onAutostart() {
  if (!engine) return;
  const enabled = !snapshot?.autostart;
  snapshot = await engine.setAutostart(enabled);
  render();
}
async function boot() {
  render();
  try {
    const bridge = await createBridge();
    engine = new Engine(bridge.fs, void 0, bridge.shell);
    snapshot = await engine.snapshot("starting");
    render();
    snapshot = (await engine.collect()).snapshot;
  } catch {
    snapshot = {
      shell: "none",
      status: "error",
      queued: 0,
      rejected: 0,
      overview: { activeAgents: 0, sessions: 0, events: 0, totalCostMicros: 0, firstPassTestRate: 0, mergedPullRequests: 0, coverage: 0 },
      insights: [],
      events: [],
      lastRunAt: null,
      lastCollect: null,
      paused: false,
      autostart: false,
      approvedPaths: [],
      installationId: "",
      error: "This window is running outside the Ruwt application shell."
    };
  }
  render();
}
document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    tab = button.dataset.tab ?? "insights";
    render();
  });
});
$("collect").addEventListener("click", () => void onCollect());
$("sync").addEventListener("click", () => {
  tab = "integrations";
  render();
  $("sync-note").hidden = false;
});
$("autostart").addEventListener("click", () => void onAutostart());
void boot();
