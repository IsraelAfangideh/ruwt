# ruwt.dev — AI-Efficiency Assessment Platform

Ruwt is a competitive coding platform where success is measured in dollars, not just runtime. Developers solve challenges by prompting AI models, with every token and model choice carrying a real-world price tag.

## How It Works

1. **Land on ruwt.dev** — landing page explains the three dimensions being measured: Model Selection, Prompt Efficiency, and Iterative Debugging.

2. **Register / Login** — GitHub OAuth or email/password. New users get **50,000 free credits**.

3. **Browse Challenges** (`/challenges`) — filter by category (Model Selection, Prompt Efficiency, Debugging). Each card shows difficulty, category, and an efficiency cost goal.

4. **Pick a challenge** — read the full description and constraints (time limit, max tokens, max cost), then choose:
   - **Start Timed** — countdown begins, pressure's on
   - **Start Untimed** — no timer, marked separately on the leaderboard

5. **The Arena IDE** — the core experience:
   - **Left side**: Monaco code editor + Output panel (per-test results)
   - **Right side**: Tabbed panel — Description tab (problem + examples + constraints) and AI Chat tab (Llama 8B assistant, costs credits/tokens)
   - **Status bar**: real-time cost, token count, time remaining, credits

6. **Iterate** — read the problem, write code, ask the AI for hints, run tests, see which fail, fix, repeat. Every AI chat message costs you — the leaderboard rewards efficiency, not just correctness.

7. **Run Tests** — per-test pass/fail with input, expected output, and actual output. Failed tests auto-expand for quick debugging.

8. **Submit** — finalizes your attempt as `passed` or `failed`.

9. **Leaderboard** (`/leaderboard`) — ranked by challenges solved, then by average cost. Cheapest solvers win.

### The Core Loop

> "How good are you at using AI?" — can you pick the right prompts, avoid unnecessary back-and-forth, and solve problems with minimal AI cost? That's the skill being ranked.

## Stack

- **Frontend:** React (react-native-web) + Vite
- **Hosting:** Cloudflare Pages (static + **Functions**)
- **Database:** Cloudflare **D1** (SQLite) + Drizzle ORM
- **Auth:** Supabase (GitHub OAuth + email/password)
- **Payments:** Stripe
- **AI Chat:** Cloudflare Workers AI (Llama 3.1 8B)
- **Code Execution:** Judge0 API
- **Editor:** Monaco (React.lazy)

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

5. (Optional) Seed challenges into D1:

```bash
npm run db:seed-d1   # generates scripts/seed-d1.sql
npx wrangler d1 execute ruwt-dev --remote --file=./scripts/seed-d1.sql   # remote
# or --local for local D1
```

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

## Deploying (going live)

### 1. GitHub Actions (recommended)

Push to `main` (when `dev/**` changes) or run **Actions → Deploy Dev (Cloudflare Pages) → Run workflow**.

**Required repo secrets:**

| Secret | Used for |
|--------|----------|
| `CLOUDFLARE_ACCOUNT_ID` | Wrangler deploy |
| `CLOUDFLARE_API_TOKEN` | Wrangler deploy (needs Pages + D1) |
| `VITE_SUPABASE_URL` | Build-time client env (auth) |
| `VITE_SUPABASE_ANON_KEY` | Build-time client env (auth) |

After the first successful deploy, the site is at **https://ruwt-dev.pages.dev**.

### 2. One-time: D1 migrations and seed (remote)

Run once against production D1 (same DB as in `wrangler.toml`):

```bash
cd dev
npx wrangler d1 execute ruwt-dev --remote --file=./drizzle/migrations-d1/0000_initial.sql
npm run db:seed-d1
npx wrangler d1 execute ruwt-dev --remote --file=./scripts/seed-d1.sql
```

### 3. Functions env vars (production)

In **Cloudflare Dashboard → Pages → ruwt-dev → Settings → Environment variables** (Production), set:

- **Required for auth:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (same values as build; used by Functions to validate sessions).
- **Optional:** `STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY` (payments), `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` (if `/api/ai/chat` uses them), `JUDGE0_API_URL`, `JUDGE0_API_KEY` (submissions).

D1 is already bound via `wrangler.toml` (`DB`); no dashboard binding needed if you deploy with the same config.

### 4. Custom domain (optional)

In **Pages → ruwt-dev → Custom domains**, add your domain and follow DNS instructions.

### If you use Cloudflare Git integration (dashboard "Connect to Git")

- **Root directory:** `dev` (so build runs inside `dev/`).
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Do not** set a custom deploy command to `npx wrangler deploy` (that is for Workers). Either leave the deploy command **blank** (Pages will deploy the build output) or use `npx wrangler pages deploy dist --project-name=ruwt-dev`. If you see "run a Workers-specific command in a Pages project", remove or change the deploy command in **Pages → your project → Settings → Builds & deployments**.

---

## Environment (reference)

- **Client (Vite):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (see `.env.example`).
- **Cloudflare Pages / Functions:** In dashboard or `.dev.vars`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `JUDGE0_API_URL`, `JUDGE0_API_KEY`, and AI provider keys if used. D1 is bound in `wrangler.toml` as `DB`.

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
