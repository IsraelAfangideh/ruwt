# Deployment

## ruwt.ai (`/ai`)

Create the D1 database and Pages project before the first deploy:

```bash
cd ai
npx wrangler d1 create ruwt-ai
# Update database_id in wrangler.toml with the returned UUID
npm install
npx wrangler d1 execute ruwt-ai --local --file=./drizzle/migrations-d1/0000_initial.sql
npm run typecheck
npm run build
CLOUDFLARE_API_TOKEN=... npx wrangler pages deploy dist --project-name=ruwt-ai
```

Add Supabase redirect URLs for `https://ruwt.ai/callback`, `https://ruwt-ai.pages.dev/callback`, and `http://localhost:5175/callback`.

### Domain and Cloudflare (one-time)

ruwt.ai is a **separate** Cloudflare Pages project from ruwt.dev. This does not
change or redeploy the ruwt.dev app.

1. Register `ruwt.ai` and add it to Cloudflare (or transfer to Cloudflare Registrar).
2. Run the setup script (creates D1 databases, DNS, Pages custom domain):

```bash
cd ai
CLOUDFLARE_API_TOKEN=... node scripts/setup-cloudflare.mjs
```

3. Commit the updated `database_id` values in `wrangler.toml`.

Manual fallback if the zone is not ready yet: use `https://ruwt-ai.pages.dev`.

Production deploys run via `.github/workflows/deploy-ai.yml` on push to `main` with changes in `ai/**`.

PR previews deploy via `.github/workflows/deploy-ai-preview.yml` to `<branch>.ruwt-ai.pages.dev`.

## Agentic Engineering Intelligence (`/dev`)

Run the additive migration before enabling the Intelligence route in a target environment.

```bash
cd dev
npx wrangler d1 execute ruwt-dev --local --file=./drizzle/migrations-d1/0065_agentic_engineering_intelligence.sql
npm run typecheck
npm test
npm run build
```

Use the preview D1 database before production. The existing deployment workflow
deploys `/dev` to Cloudflare Pages. This task did not deploy because no
authenticated staging target or migration approval was available.
