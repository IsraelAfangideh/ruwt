# ruwt.dev

Ruwt is a competitive coding platform where success is measured in dollars, not just runtime. Developers solve challenges by prompting AI models, with every token and model choice carrying a real-world price tag.

## Stack

- **Frontend:** React (react-native-web) + Vite
- **Hosting:** Cloudflare Pages (static + **Functions**)
- **Database:** Cloudflare **D1** (SQLite)
- **Auth:** **Supabase** only (GitHub / Google / email)
- **Payments:** Stripe
- **AI:** Cloudflare Workers AI (and optionally OpenAI/Anthropic via env)
- **Editor:** Monaco; **Terminal:** xterm.js; **Sandbox:** WebContainers (client)

## Getting started

### Prerequisites

- Node.js 18+
- Supabase project (for auth)
- Cloudflare account (Pages + D1)

### Setup

1. Install dependencies:

```bash
cd dev
npm install
```

2. Copy env and fill in:

```bash
cp .env.example .env.local
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the client. For local Functions (wrangler), use `.dev.vars` or `wrangler.toml` vars.

3. Create the D1 database:

```bash
npx wrangler d1 create ruwt-dev
```

Add the returned `database_id` to `wrangler.toml` under `[[d1_databases]]` (replace `REPLACE_WITH_DATABASE_ID`).

4. Run migrations:

```bash
npx wrangler d1 execute ruwt-dev --remote --file=./drizzle/migrations-d1/0000_initial.sql
```

For local dev, use `--local` instead of `--remote` and run migrations against the local D1.

5. (Optional) Seed challenges (run against your DB via a small script or D1 dashboard). The schema supports `challenges`, `profiles`, `attempts`, `ai_calls`, `transactions`.

6. Run the app:

```bash
# Terminal 1: Vite dev server (proxies /api to Functions)
npm run dev

# Terminal 2: Cloudflare Pages dev (serves Functions + D1)
npx wrangler pages dev dist --compatibility-date=2024-01-01 --d1=DB=ruwt-dev
```

Or use `wrangler pages dev` with the correct `--d1` binding and point Vite’s proxy to the port wrangler uses (e.g. 8788).

7. Build for production:

```bash
npm run build
```

Deploy `dist/` to Cloudflare Pages (e.g. connect the repo or `npx wrangler pages deploy dist`). Configure D1 binding `DB` and env vars (Supabase, Stripe, Cloudflare AI, Judge0) in the dashboard or `wrangler.toml`.

## Environment

- **Client (Vite):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (see `.env.example`).
- **Cloudflare Pages / Functions:** In dashboard or `.dev.vars`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `JUDGE0_API_URL`, `JUDGE0_API_KEY`. D1 is bound in `wrangler.toml` as `DB`.

## Project structure

```
dev/
├── src/                 # Vite + react-native-web app
│   ├── screens/
│   ├── components/
│   ├── navigation/
│   └── theme/
├── functions/           # Cloudflare Pages Functions (API)
│   ├── _shared/         # db, auth, constraints, judge, ai
│   └── api/             # leaderboard, attempts, submissions, ai/chat, challenges, profile, webhooks/stripe
├── drizzle/
│   ├── schema.ts        # Postgres (legacy/Next)
│   ├── schema.d1.ts     # D1 (SQLite) schema
│   └── migrations-d1/   # D1 SQL migrations
├── lib/                 # Shared libs (ai, judge, stripe, supabase)
└── components/          # Legacy DOM components (Monaco, Terminal, etc.)
```

## API (Functions)

- `GET /api/challenges` – list challenges (D1)
- `GET /api/challenges/:id` – one challenge
- `GET /api/leaderboard` – global or `?challengeId=`
- `POST/GET /api/attempts` – create/list attempts (auth)
- `POST/GET /api/submissions` – submit solution / get status (auth, Judge0)
- `POST /api/ai/chat` – streaming chat (auth, credits; Cloudflare AI models in Workers)
- `GET /api/profile` – current user profile (auth)
- `POST /api/webhooks/stripe` – Stripe webhook (credits)

Auth is done via Supabase session (cookie). App data (challenges, attempts, profiles, etc.) lives in D1.

## License

MIT
