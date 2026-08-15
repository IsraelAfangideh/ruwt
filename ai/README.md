# ruwt.ai — Agent Observation Platform

Standalone Cloudflare Pages app for observing coding agent activity across your organization.

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

1. Create the D1 database:
   ```bash
   npx wrangler d1 create ruwt-ai
   ```
   Copy the returned `database_id` into `wrangler.toml`.

2. Create the Pages project (first deploy):
   ```bash
   npm run build
   CLOUDFLARE_API_TOKEN=... npx wrangler pages deploy dist --project-name=ruwt-ai
   ```

3. Set runtime secrets:
   ```bash
   echo "$VITE_SUPABASE_URL" | npx wrangler pages secret put SUPABASE_URL --project-name=ruwt-ai
   echo "$VITE_SUPABASE_ANON_KEY" | npx wrangler pages secret put SUPABASE_ANON_KEY --project-name=ruwt-ai
   ```

4. Apply migrations:
   ```bash
   npx wrangler d1 migrations apply ruwt-ai --remote
   ```

5. Add Supabase redirect URLs:
   - `https://ruwt.ai/callback`
   - `https://ruwt-ai.pages.dev/callback`
   - `http://localhost:5175/callback`

6. Point DNS: CNAME `ruwt.ai` → `ruwt-ai.pages.dev` (proxied)

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

The local collector in `/desktop` posts to `/api/intelligence/events`. Point it at `https://ruwt.ai` once deployed.

See `/docs/telemetry-schema.md` for the event contract.
