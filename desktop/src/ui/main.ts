import { Engine, type Snapshot } from '../engine.js';
import { createBridge, detectShell } from './bridge.js';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const relative = (value: string | null) => {
  if (!value) return 'No run yet.';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return 'Collected just now.';
  if (minutes < 60) return `Collected ${minutes} min ago.`;
  return `Collected ${Math.round(minutes / 60)} hr ago.`;
};

let engine: Engine | undefined;
let snapshot: Snapshot | undefined;
let tab = 'insights';
let busy = false;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function render() {
  const view = snapshot;
  const status = busy ? 'collecting' : view?.status ?? 'starting';
  $('status-badge').textContent = status === 'ready' ? 'Ready' : status === 'paused' ? 'Paused' : status === 'collecting' ? 'Collecting' : status === 'error' ? 'Error' : 'Starting';
  $('status-badge').dataset.state = status;
  $('queue-badge').textContent = `Queue ${view?.queued ?? 0}`;
  $('run-status').textContent = view?.error ?? relative(view?.lastRunAt ?? null);
  $('autostart').toggleAttribute('data-on', Boolean(view?.autostart));
  $('autostart-label').textContent = view?.autostart ? 'Start at login on' : 'Start at login';
  const banner = $('shell-banner');
  banner.hidden = view?.shell !== 'none';
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
    const active = button.dataset.tab === tab;
    button.setAttribute('aria-selected', String(active));
    const panel = $(`panel-${button.dataset.tab}`);
    panel.hidden = !active;
  }
  renderInsights();
  renderActivity();
  renderIntegrations();
  renderPrivacy();
  renderDiagnostics();
}

function metric(label: string, value: string, note: string) {
  return `<article class="metric"><span>${label}</span><b>${value}</b><small>${note}</small></article>`;
}

function renderInsights() {
  const panel = $('panel-insights');
  const overview = snapshot?.overview;
  const insights = snapshot?.insights ?? [];
  if (!snapshot || snapshot.status === 'starting') {
    panel.querySelector('.stack')!.innerHTML = `<p class="empty">Ruwt is starting the local collector.</p>`;
    return;
  }
  if (!overview?.events) {
    panel.querySelector('.stack')!.innerHTML = `
      ${metric('Sessions', '0', 'No agent session files read yet')}
      ${metric('Events', '0', 'Metadata only, stored on this machine')}
      ${metric('Estimated cost', money.format(0), 'Adapter usage metadata when present')}
      <div class="empty-card">
        <h3>No activity on this machine yet</h3>
        <p>Ruwt reads Claude Code, Cursor, and Codex session files from approved folders. Nothing is guessed. Press Collect now after you use an agent.</p>
      </div>`;
    return;
  }
  panel.querySelector('.stack')!.innerHTML = `
    <div class="metrics">
      ${metric('Active agents', String(overview.activeAgents), 'Vendors observed in local session files')}
      ${metric('Sessions', String(overview.sessions), `${overview.events} redacted events`)}
      ${metric('Estimated cost', money.format(overview.totalCostMicros / 1_000_000), 'From adapter usage metadata')}
      ${metric('First-pass tests', `${overview.firstPassTestRate}%`, 'Only observed completed tests')}
      ${metric('Merged pull requests', String(overview.mergedPullRequests), 'Connected activity only')}
      ${metric('Data coverage', `${overview.coverage}%`, 'Actor, repository, and agent known')}
    </div>
    <div class="ledger">
      ${insights.map((insight) => `
        <article class="insight" data-confidence="${insight.confidence}">
          <h3>${insight.title}</h3>
          <p class="meta">${insight.confidence} confidence · n=${insight.sampleSize}</p>
          <p>${insight.summary}</p>
          <p class="reco">${insight.recommendation}</p>
          <p class="limit">${insight.limitations}</p>
        </article>`).join('')}
    </div>`;
}

function renderActivity() {
  const events = snapshot?.events ?? [];
  $('panel-activity').querySelector('.stack')!.innerHTML = events.length ? `<div class="table">${events.map((event) => `
    <div class="row">
      <time>${new Date(event.timestamp).toLocaleString()}</time>
      <div><b>${event.type}</b><span>${event.agentVendor ?? 'Unknown agent'} · ${event.repository ?? 'Repository not available'}${event.toolName ? ` · ${event.toolName}` : ''}</span></div>
      <em>${event.redactionStatus}</em>
    </div>`).join('')}</div>` : `<p class="empty">No redacted activity is stored yet.</p>`;
}

function renderIntegrations() {
  const sources = snapshot?.lastCollect?.sources ?? [
    { id: 'claude-code', label: 'Claude Code', files: 0, events: 0, detail: 'Not scanned yet.' },
    { id: 'cursor', label: 'Cursor', files: 0, events: 0, detail: 'Not scanned yet.' },
    { id: 'codex', label: 'Codex', files: 0, events: 0, detail: 'Not scanned yet.' },
  ];
  $('panel-integrations').querySelector('.stack')!.innerHTML = sources.map((source) => `
    <article class="card">
      <h3>${source.label}</h3>
      <p>${source.detail}</p>
      <p class="meta">${source.files} files · ${source.events} events</p>
    </article>`).join('') + `<p class="note">Ruwt does not claim a live hook. It scans approved session files and keeps metadata only.</p>`;
}

function renderPrivacy() {
  $('panel-privacy').querySelector('.stack')!.innerHTML = `
    <article class="card">
      <h3>Raw prompts stored</h3>
      <p><b>0</b>. Session files are read in memory. Prompt text, diffs, and command strings are discarded before the journal is written.</p>
    </article>
    <article class="card">
      <h3>Approved folders</h3>
      <p>~/.claude, ~/.cursor, ~/.codex, and this machine’s Cursor application-support folder. Writes stay in ~/.ruwt.</p>
    </article>
    <button class="danger" id="delete-data" type="button">Delete local data</button>`;
  $('delete-data')?.addEventListener('click', () => void onDelete());
}

function renderDiagnostics() {
  const collect = snapshot?.lastCollect;
  $('panel-diagnostics').querySelector('.stack')!.innerHTML = `
    <pre>${JSON.stringify({
      shell: snapshot?.shell ?? detectShell(),
      status: snapshot?.status ?? 'starting',
      installationId: snapshot?.installationId,
      lastRunAt: snapshot?.lastRunAt,
      queued: snapshot?.queued ?? 0,
      lastCollect: collect,
      error: snapshot?.error,
    }, null, 2)}</pre>`;
}

async function onCollect() {
  if (!engine || busy) return;
  busy = true;
  render();
  try {
    snapshot = (await engine.collect()).snapshot;
  } catch (error) {
    snapshot = snapshot ? { ...snapshot, status: 'error', error: error instanceof Error ? error.message : 'Collect failed.' } : undefined;
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
    engine = new Engine(bridge.fs, undefined, bridge.shell);
    snapshot = await engine.snapshot('starting');
    render();
    snapshot = (await engine.collect()).snapshot;
  } catch {
    snapshot = {
      shell: 'none',
      status: 'error',
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
      installationId: '',
      error: 'This window is running outside the Ruwt application shell.',
    };
  }
  render();
}

document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
  button.addEventListener('click', () => { tab = button.dataset.tab ?? 'insights'; render(); });
});
$('collect').addEventListener('click', () => void onCollect());
$('sync').addEventListener('click', () => {
  tab = 'integrations';
  render();
  $('sync-note').hidden = false;
});
$('autostart').addEventListener('click', () => void onAutostart());
void boot();
