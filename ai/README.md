# ruwt.ai — Agent Observation Platform

Standalone Cloudflare Pages app for observing coding agent activity across your organization.

**ruwt.dev remains a separate web app** (AI efficiency assessments, Arena, hiring).
ruwt.ai has its own deploy pipeline, D1 database, and domain. Shared Supabase
accounts only — not shared infrastructure or routes.

## Stack

- React 19 + Vite + React Native Web
- Cloudflare Pages Functions + D1 (SQLite)
- Supabase Auth (shared accounts with ruwt.dev)

## Local development

```bash
cd ai
cp .env.example .env.local   # add VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm install
npx wrangler d1 execute ruwt-ai --local --file=./drizzle/migrations-d1/0000_initial.sql
npm run dev                  # http://localhost:5175
```

For API routes locally, build then run Pages dev in a second terminal:

```bash
npm run build
npx wrangler pages dev dist --d1=DB --port 8788
```

## First-time Cloudflare setup

Automated (recommended):

```bash
cd ai
CLOUDFLARE_API_TOKEN=... node scripts/setup-cloudflare.mjs
git add wrangler.toml && git commit -m "chore(ai): wire D1 database IDs from setup script"
```

The script creates `ruwt-ai` and `ruwt-ai-preview` D1 databases, attaches
`ruwt.ai` to the Pages project when the zone exists, and updates `wrangler.toml`.
It does **not** modify ruwt.dev.

Manual steps if the domain is not in Cloudflare yet:

1. Register `ruwt.ai` and add it to Cloudflare (update nameservers).
2. Re-run `node scripts/setup-cloudflare.mjs`.
3. Set runtime secrets and deploy:

```bash
echo "$VITE_SUPABASE_URL" | npx wrangler pages secret put SUPABASE_URL --project-name=ruwt-ai
echo "$VITE_SUPABASE_ANON_KEY" | npx wrangler pages secret put SUPABASE_ANON_KEY --project-name=ruwt-ai
npm run build
CLOUDFLARE_API_TOKEN=... npx wrangler pages deploy dist --project-name=ruwt-ai
npx wrangler d1 migrations apply ruwt-ai --remote
```

4. Add Supabase redirect URLs:
   - `https://ruwt.ai/callback`
   - `https://ruwt-ai.pages.dev/callback`
   - `http://localhost:5175/callback`
   - Preview branches: `https://*.ruwt-ai.pages.dev/callback` (if supported)

Until the custom domain is live, use `https://ruwt-ai.pages.dev`.

## PR previews

Changes under `ai/**` trigger `.github/workflows/deploy-ai-preview.yml`.
Each PR gets `<branch>.ruwt-ai.pages.dev` with an isolated `ruwt-ai-preview` D1.
ruwt.dev previews are unaffected.

## API surface

| Endpoint | Purpose |
|----------|---------|
| `POST /api/intelligence/events` | Ingest normalized telemetry batches |
| `GET /api/intelligence/overview?orgId=` | Dashboard metrics + insights |
| `POST /api/intelligence/demo` | Load simulated demo events |
| `GET/POST /api/intelligence/api-keys` | Manage ingestion keys |
| `GET/POST /api/intelligence/policies` | Detect-only policy rules |
| `GET/POST /api/orgs` | Organization workspaces |

Ingestion auth: `Authorization: Bearer ruwt_ing_...` or authenticated org member session.

## Desktop collector

The local collector in `/desktop` syncs to `https://ruwt.ai/api/intelligence/events`
by default. Only `RUWT_INGESTION_KEY` is required:

```bash
RUWT_INGESTION_KEY=ruwt_ing_... npm run cli -- sync
```

See `/docs/telemetry-schema.md` for the event contract.
