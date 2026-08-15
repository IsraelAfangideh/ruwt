# Ruwt Desktop foundation

Ruwt Desktop uses a Tauri 2 shell and one local service. The service owns the
local queue, redaction, generic JSON import, retry state, and exports. The CLI
uses the same service code.

The **downloadable app** on ruwt.ai is the Tauri shell in this folder. The window
opens on Insights, collects local session files on startup, and computes
deterministic figures from the on-disk journal. CI builds a macOS DMG and
Windows installer (`.github/workflows/release-desktop.yml`).

Local windowed app:

```bash
cd desktop
npm install
npm run dev
```

Telemetry syncs to **ruwt.ai** — the agent observation platform. **ruwt.dev**
is a separate web app (AI efficiency assessments) and is not the sync target.

## Development

```bash
cd desktop
npm install
npm run check
npm run dev
```

## CLI

```bash
cd desktop
npm run cli -- status
npm run cli -- collect
npm run cli -- insights
npm run cli -- doctor
npm run cli -- import ./events.json
npm run cli -- export ./ruwt-local-export.json

# Sync to ruwt.ai (default endpoint). Only the ingestion key is required:
RUWT_INGESTION_KEY=ruwt_ing_... npm run cli -- sync

# Override endpoint for local Pages dev or preview deploys:
RUWT_INGESTION_URL=http://127.0.0.1:8788/api/intelligence/events \
RUWT_INGESTION_KEY=ruwt_ing_... npm run cli -- sync
```

Default ingestion URL: `https://ruwt.ai/api/intelligence/events`

See `.env.example` for all environment variables.

## Supported capability states

- Real: Insights window, local session-file collection (Claude Code, Cursor, Codex),
  deterministic insight rules, redaction, durable queue, generic JSON import, export,
  sync to ruwt.ai, and in-app updates from `https://ruwt.ai/downloads/desktop-latest.json`.
- Experimental: live vendor hooks. Session files are scanned; accounts are not connected.
- Placeholder: OS credential storage and tray controls.
  Start at login writes a macOS LaunchAgent. macOS CI signs with Developer ID
  (App Store Connect API key) and notarizes the DMG. The updater verifies SHA-256.

The queue uses a permission-restricted, atomically replaced local journal. A
SQLite migration is the next required release hardening step.
