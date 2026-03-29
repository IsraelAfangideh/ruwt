# Ruwt Social — Code Workspace

Bun monorepo containing the backend, mobile app, web marketing site, and shared types for the Ruwt Social Network.

## Workspaces

| Workspace | Description | Runtime |
|-----------|-------------|---------|
| `api/` | Hono backend — Runner AI, auth, messaging | Fly.io (Bun) |
| `mobile/` | React Native (Expo) mobile app | iOS / Android |
| `web/` | Static marketing site (ruwt.social) | Cloudflare Pages |
| `shared/` | Shared types, Zod schemas, prompt generators | Library |

## Prerequisites

- [Bun](https://bun.sh/) 1.0+
- Docker & Docker Compose (for local Postgres + pgvector)
- Cloudflare account (Workers AI)

## Setup

```bash
cd social/code
bun install

# Environment
cp api/.env.example api/.env  # fill in DB + Cloudflare keys

# Database
docker-compose up -d          # Postgres + pgvector on :5432
cd api && bun run db:migrate
```

## Running

```bash
# API server
cd api && bun run dev

# Mobile app (Expo)
cd mobile && bun run start

# CLI (test Runner logic directly)
cd api && bun run cli
```

## Architecture

- **AI**: Cloudflare Workers AI (Llama 3.3 70B with fallback chain)
- **Database**: Supabase Postgres + pgvector for embeddings
- **Auth**: Supabase Auth
- **Shared types**: `@ruwt/shared` package — Zod schemas, prompt generators, constants
  - History format uses Gemini-style `{role: 'user'|'model', parts: [{text}]}` for mobile compatibility
  - Conversion to OpenAI format happens server-side in `api/src/services/cloudflare-ai.ts`

## Deploy

Deploys are handled by GitHub Actions (`deploy.yml`) on push to `main`:
- **API**: `flyctl deploy` to Fly.io
- **Web**: `npx wrangler pages deploy` to Cloudflare Pages
- **Mobile**: EAS Build (native changes) or EAS Update (OTA for JS-only changes)

The CI pipeline detects which files changed and only deploys the affected services.
