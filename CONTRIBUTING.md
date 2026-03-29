# Contributing to Ruwt

## Prerequisites

| Tool | Version | Used by |
|------|---------|---------|
| [Node.js](https://nodejs.org/) | 20+ (see `.nvmrc`) | `/dev`, `/health` |
| [Bun](https://bun.sh/) | 1.0+ | `/social` |
| [Docker](https://www.docker.com/) | Latest | `/social` (Postgres), `/executor` (sandbox testing) |
| [Wrangler](https://developers.cloudflare.com/workers/wrangler/) | 4+ | `/dev`, `/health` (Cloudflare Pages) |

## Quick Start

```bash
# Clone and go
git clone <repo-url>
cd ruwt

# Use correct Node version
nvm use  # reads .nvmrc → Node 20
```

### /dev (AI-Efficiency Assessment Platform)

```bash
cd dev
npm install
cp .env.example .env.local    # fill in Supabase keys
npm run dev                    # Vite dev server on :5173
```

For Cloudflare Functions locally:
```bash
npx wrangler pages dev dist --compatibility-date=2024-01-01 --d1=DB
```

### /health (Fitness & Nutrition Tracker)

```bash
cd health
npm install
cp .env.example .env.local    # fill in Supabase keys
npm run dev                    # Vite dev server on :5174
```

For Cloudflare Functions locally:
```bash
npx wrangler pages dev dist --d1=DB
```

### /social (Social Network — API + Mobile)

```bash
cd social/code
bun install
cp api/.env.example api/.env  # fill in DB + Cloudflare keys

# Start Postgres
docker-compose up -d

# Run migrations
cd api && bun run db:migrate

# Start API
bun run dev

# Start mobile (separate terminal)
cd ../mobile && bun run start
```

## Project Structure

```
ruwt/
├── dev/          # ruwt.dev — Cloudflare Pages + D1 + Supabase Auth
├── health/       # ruwt.health — Cloudflare Pages + D1 + Supabase Auth
├── social/       # Ruwt Social — Fly.io API + Expo mobile + Supabase Postgres
├── executor/     # Code sandbox — Fly.io Docker container
└── .github/      # CI/CD workflows
```

Each project has its own `package.json` and dependencies. `/dev` and `/health` use npm; `/social` uses Bun workspaces.

## Git Workflow

| Branch | Purpose |
|--------|---------|
| `main` | Production — deploys trigger here |
| `develop` | Development integration (note: currently diverged from main) |
| Feature branches | Branch off `main` for new work |

### Commit Convention

```
type(scope): description
```

**Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`
**Scopes:** `dev`, `health`, `social`, `executor`, `ci`

Examples:
```
feat(dev): add team assessment dashboard
fix(health): correct calorie ring calculation
refactor(social): extract AI model fallback logic
```

### Pull Requests

1. Create a feature branch off `main`
2. Make your changes, write tests
3. Open a PR to `main`
4. CI runs: lint, typecheck, build (and tests for `/dev`)
5. Get review, merge

## Running Tests

```bash
# /dev (vitest — full suite)
cd dev && npm test

# /dev with coverage
cd dev && npm run test:coverage

# /social mobile (type check)
cd social/code/mobile && bun tsc --noEmit
```

## Linting

```bash
# From repo root (runs across all workspaces)
npm run lint

# Or per-project
cd dev && npm run lint
cd health && npm run lint
```

Formatting uses [Prettier](https://prettier.io/) — config is at the repo root (`.prettierrc`).

## Deploying

Deploys happen automatically via GitHub Actions on push to `main`:

| Project | Workflow | Target |
|---------|----------|--------|
| `/dev` | `deploy-dev.yml` | Cloudflare Pages (`ruwt.dev`) |
| `/health` | `deploy-health.yml` | Cloudflare Pages (`ruwt-health.pages.dev`) |
| `/social` | `deploy.yml` | Fly.io (API) + Cloudflare Pages (web) + EAS (mobile) |

Only files changed in the relevant directory trigger that project's deploy.

### Manual deploy (dev)

```bash
cd dev
npm run build
CLOUDFLARE_API_TOKEN=... npx wrangler pages deploy dist --project-name=ruwt-dev --branch=main
```

## Architecture Notes

- **Auth** is shared across `/dev` and `/health` via the same Supabase project
- **Sessions** use cookies (via `@supabase/ssr`), not localStorage — this lets server-side Functions validate auth
- **D1** (SQLite) is the database for `/dev` and `/health`; Supabase Postgres for `/social`
- **Cloudflare Workers AI** powers the chat in the Arena IDE and the social Runners
- **Code execution** for challenges goes through the executor sandbox on Fly.io

See [CLAUDE.md](./CLAUDE.md) for detailed infrastructure config and API reference.
