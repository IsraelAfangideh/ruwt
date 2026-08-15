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

Production deploys run via `.github/workflows/deploy-ai.yml` on push to `main` with changes in `ai/**`.

## Agentic Engineering Intelligence (`/dev`)
environment.

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
