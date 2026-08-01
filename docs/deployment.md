# Deployment

Run the additive migration before enabling the Intelligence route in a target
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
