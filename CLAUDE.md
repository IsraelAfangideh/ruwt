# Ruwt Monorepo

## Project Structure

```
ruwt/
├── dev/          # AI-Efficiency Assessment Platform (web app)
├── social/       # Ruwt Social Network (mobile + API)
└── .github/      # CI/CD workflows
```

## /dev — AI-Efficiency Assessment Platform

- **Stack**: React (react-native-web) + Vite, Cloudflare Pages + Functions, Cloudflare D1 (SQLite), Supabase Auth
- **Domain**: `ruwt.dev` (custom domain on Cloudflare Pages), fallback `ruwt-dev.pages.dev`
- **Cloudflare Pages project**: `ruwt-dev`
- **D1 database**: `ruwt-dev` (ID: `27b64c12-c858-473d-8a40-d202d01d32aa`)
- **Auth**: Supabase (GitHub OAuth + email/password). Google OAuth is disabled.
- **Deploy**: GitHub Actions (`deploy-dev.yml`) → `npx wrangler pages deploy dist --project-name=ruwt-dev`
  - Triggers on push to `main` with changes in `dev/**`, or manual `workflow_dispatch`
  - Build-time env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (from GitHub Secrets, baked into JS bundle)
  - Runtime env vars for Functions: Set in Cloudflare Dashboard (not wrangler.toml, to avoid binding conflicts)
  - Cloudflare Pages also has its own auto-deploy (currently misconfigured, should be disabled)
- **Supabase project ref**: `fzncpdelyfuvdeqmwznx`
- **Auth callback URL**: `https://ruwt.dev/callback` (must be in Supabase → Authentication → Redirect URLs)
- **Key architecture decisions**:
  - Client uses `@supabase/ssr` `createBrowserClient` (stores session in cookies, not localStorage) so server-side Functions can validate auth via Cookie header
  - Server-side auth: `functions/_shared/auth.ts` → `createSupabaseFromRequest()` reads cookies → `supabase.auth.getUser()`
  - OAuth callback (`CallbackScreen`) does NOT manually read `?code=` from URL — `createBrowserClient` auto-detects and exchanges it via PKCE before React effects run. Callback listens to `onAuthStateChange` + `getSession()` instead.
  - OAuth `redirectTo` (post-login destination) is stored in `localStorage`, not URL query params, to keep the callback URL clean for Supabase PKCE flow
- **Design system**: Warm cream/dark palette with gold accent, shared with `/social`
  - Theme: `dev/src/theme/colors.ts` (light/dark), `tokens.ts` (spacing, radii, fonts)
  - Fonts: Cormorant Garamond (display), Libre Franklin (body)
  - Cards use subtle shadows for depth, tinted pill badges for difficulty/category
  - Manual deploy from CLI: `CLOUDFLARE_API_TOKEN=... npx wrangler pages deploy dist --project-name=ruwt-dev --branch=main --commit-dirty=true`

Be sure that when we add challenges some of them are non trivial for models to solve and all of them reflect real world software engineering challenges. 

## /social — Ruwt Social Network

- **Stack**: Hono API (Bun) on Fly.io, React Native (Expo) mobile app, Supabase Postgres
- **Domain**: `ruwt.fly.dev`
- **AI**: Cloudflare Workers AI (open source models: Llama 3.3 70B, Llama 3.1 70B/8B)
  - Service module: `social/code/api/src/services/cloudflare-ai.ts`
  - Model fallback pattern: tries models in order, skips on 404
- **Deploy**: GitHub Actions (`deploy.yml`) → `flyctl deploy` to Fly.io
- **Shared package**: `@ruwt/shared` — types, prompt generators, constants
  - History format uses Gemini-style `{role: 'user'|'model', parts: [{text}]}` for mobile compatibility
  - Conversion to OpenAI format happens in `cloudflare-ai.ts` → `convertHistory()`

## Cloudflare Account

- **Account ID**: `32f5999dbd09eae38c1de8c15de98d48`
- **Zone**: `ruwt.dev` (zone ID: `31032a4069bc880a095d18e9e96947ac`, Cloudflare nameservers, free plan)
- **DNS**: CNAME `ruwt.dev` → `ruwt-dev.pages.dev` (proxied)
- **Admin API token**: `CLOUDFLARE_ADMIN_API_TOKEN` in `dev/.env.local` — has Zone:Edit, DNS:Edit, Pages:Edit
- **Workers AI token**: `CLOUDFLARE_API_TOKEN` in `social/code/api/.env` — Workers AI only
- **Deploy token**: In GitHub Secrets as `CLOUDFLARE_API_TOKEN` — Pages deploy scope

## Supabase

- **Org slug**: `rltfyhluqjgpkfjvbllg`
- **Project `ruwt-dev`**: ref `fzncpdelyfuvdeqmwznx` (eu-west-3, active) — used by `/dev`
- **Project `ruwt`**: ref `eazkkwphhrwrddzyrdur` (eu-west-1, active) — used by `/social`
- **Management API token**: `SUPABASE_ADMIN_TOKEN` in `dev/.env.local`
- **Auth config** (ruwt-dev project):
  - `site_url`: `https://ruwt.dev`
  - `uri_allow_list`: `https://ruwt.dev/**,https://ruwt-dev.pages.dev/**,http://localhost:5173/**`
  - Providers: GitHub OAuth + email/password (Google disabled)

## Git Workflow

- **Main branch**: `main` (deploys trigger here)
- **Development branch**: `develop`
- **PR flow**: develop → main
- **Commit style**: `type(scope): description` (e.g., `fix(dev):`, `feat(social):`)

## Important Notes

- Do NOT add `[vars]` to `dev/wrangler.toml` for vars already set in Cloudflare Dashboard — causes "Binding name already in use" deploy failures
- The `/social` shared types keep Gemini-style history format to avoid breaking the mobile app; conversion happens server-side
- Cloudflare Workers AI returns `result.response` as a parsed object (not string) when model outputs JSON — always stringify
- Cloudflare Pages deploys from CLI associate with the current git branch; custom domains serve `main` branch only. Use `--branch=main` when deploying manually from `develop`.
- Supabase GoTrue caches auth config at startup. Updating config via Management API does NOT restart GoTrue — must pause/restore the project from the dashboard to pick up changes like `site_url`.

## Knowledge Sharing

When you discover something non-obvious (gotchas, architecture decisions, debug findings, deploy quirks), update this file or your auto-memory notes so future Claude instances benefit. Specifically:

- **This file (`CLAUDE.md`)**: Add project-level facts — infrastructure config, architectural decisions, deploy procedures, service quirks. Keep it concise and factual.
- **Auto-memory (`~/.claude/projects/.../memory/MEMORY.md`)**: Add working patterns, user preferences, and recurring pitfalls you've confirmed across interactions.

Don't wait to be asked — if you hit a wall and solve it, document the fix here before moving on.
