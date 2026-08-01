# Ruwt Desktop foundation

Ruwt Desktop uses a Tauri 2 shell and one local service. The service owns the
local queue, redaction, generic JSON import, retry state, and exports. The CLI
uses the same service code.

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
npm run cli -- import ./events.json
npm run cli -- export ./ruwt-local-export.json
RUWT_INGESTION_URL=https://example.com/api/intelligence/events \
RUWT_INGESTION_KEY=ruwt_ing_... npm run cli -- sync
```

## Supported capability states

- Real: local redaction, durable queue, generic JSON import, export, and sync.
- Experimental: no vendor adapter is enabled. Claude Code, Cursor, and Codex
  require verified fixtures and approved path mappings before release.
- Placeholder: browser sign-in, OS credential storage, tray controls,
  autostart, code signing, notarization, and updates.

The queue uses a permission-restricted, atomically replaced local journal. A
SQLite migration is the next required release hardening step.
