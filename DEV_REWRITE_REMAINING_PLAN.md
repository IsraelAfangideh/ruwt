# Dev App Rewrite — Remaining Work (Full-Stack Cloudflare)

Plan for completing the react-native-web + Vite + Cloudflare Pages rewrite using **full-stack Cloudflare**: Pages, Functions, and **D1** for the app database. Auth stays on **Supabase** (GitHub/Google/email). The scaffold, theme, navigation, auth/dashboard screens, and deployment config are done; this document covers what’s left.

---

## 1. Arena — Full IDE

**Current state:** Arena screen is a placeholder. No editor, terminal, chat, or cost/constraint UI.

**Goal:** Restore the full challenge IDE: file tree, Monaco editor, xterm terminal, AI chat panel, cost tracker, and constraint display.

### Tasks

| # | Task | Notes |
|---|------|--------|
| 1.1 | **Mount DOM-based components** | CodeEditor (Monaco), FileTree, Terminal (xterm), ChatPanel, CostTracker, ConstraintDisplay, ModelSelector live in `dev/components/` and expect DOM/className. In the RN Web app, render them inside a `View` that forwards to a DOM container (e.g. a div ref or `react-native-web`’s default div). Lazy-load these so they only load on Arena. |
| 1.2 | **Wire WebContainer** | Reuse `lib/sandbox/webcontainer.ts`: init container on Arena mount, create starter files from challenge, mount files, expose `readFile` / `writeFile` / `spawn` to the editor and terminal. |
| 1.3 | **Start attempt on enter** | When user opens Arena for a challenge, call `POST /api/attempts` with `challengeId`; store `attemptId` and `expiresAt` in state for constraints and submission. |
| 1.4 | **AI chat** | Point ChatPanel at `POST /api/ai/chat` (streaming) with `attemptId`, model, messages. Handle `chunk`, `done`, `error`, `constraint_warning` events and update cost/tokens in CostTracker. |
| 1.5 | **Run tests / Submit** | “Run tests”: run code in WebContainer (or call Judge0 via API if you move execution to the backend). “Submit”: call `POST /api/submissions` with `attemptId`, `sourceCode`, `language`; show results and navigate or refresh as needed. |
| 1.6 | **Constraint display** | Pass challenge limits (maxTokens, maxCost, wallClockLimit) and current usage (from CostTracker + attempt) into ConstraintDisplay; show progress and warnings. |

**Dependencies:** Attempts and submissions APIs must be implemented (see §2).

---

## 2. Cloudflare Functions + D1 — Real Logic

**Current state:** All `dev/functions/api/*` handlers are stubs (empty JSON or 501). No DB or auth.

**Goal:** Implement the same behavior as the former Next.js API routes using **Cloudflare Pages Functions** and **D1** (Cloudflare’s SQLite database). Auth: **Supabase only** (session from request cookies); app data lives entirely in D1.

### 2.1 Prerequisites

| Item | Action |
|------|--------|
| **Create D1 database** | `wrangler d1 create ruwt-dev` (or similar name). Note the `database_id` and add to `wrangler.toml` under `[[d1_databases]]` with `binding = "DB"`. For local dev, use `wrangler d1 execute` or Pages dev with D1 bound. |
| **Drizzle + D1 adapter** | Add `drizzle-orm` with D1 support. Create a schema compatible with **SQLite** (or a D1-specific schema in e.g. `drizzle/schema.d1.ts`): use `TEXT` for UUIDs and enums, keep JSON as `TEXT`/JSON. Use `drizzle-orm/d1` and `getRequestContext().env.DB` in Functions to get the D1 binding. Export shared `getDb(env)` that returns a drizzle instance + schema for use in all handlers. |
| **Schema migration for D1** | Port or adapt `drizzle/schema.ts`: `profiles`, `challenges`, `attempts`, `ai_calls`, `transactions`. Replace Postgres-only types (e.g. `uuid` → `text`, `pgEnum` → `text` with check or integer). Generate and run D1 migrations (`drizzle-kit generate` for SQLite, then `wrangler d1 execute <db> --file=./migrations/0000_*.sql`). |
| **Auth from request** | In each protected handler, create a Supabase client from the request’s `Cookie` header (reuse/adapt `functions/_shared/supabase.ts`), then call `getUser()`. Return 401 if no user. User id from Supabase is the canonical identity; D1 `profiles.id` matches that. |

### 2.2 Per-route plan

| Route | Method | Status | Tasks |
|-------|--------|--------|--------|
| **`/api/leaderboard`** | GET | Stub returns `{ entries: [] }` | Use shared `getDb(env)` (D1); port query from `app/api/leaderboard/route.ts` (global vs challenge-specific). Use SQLite-compatible SQL. No auth required. |
| **`/api/attempts`** | POST | 501 | Auth; parse `challengeId`; verify challenge exists in D1; create or return existing in-progress attempt; set `expiresAt` if challenge has `wallClockLimit`. Return attempt + challenge. |
| **`/api/attempts`** | GET | Returns `{ attempts: [] }` | Auth; query attempts for user (optional `challengeId`); join challenges; return list. |
| **`/api/submissions`** | POST | 501 | Auth; parse `attemptId`, `sourceCode`, `language`; verify attempt ownership and `in_progress`; check expiry; run tests (Judge0 or existing `lib/judge/client`); update attempt in D1 (status, finalCode, passedTests, etc.); return result. |
| **`/api/submissions`** | GET | 400 on missing `attemptId` | Auth; require `attemptId`; verify ownership; return attempt status and metadata from D1. |
| **`/api/ai/chat`** | POST | 501 | Auth; parse body (model, messages, attemptId, maxTokens, temperature); validate model (pricing); pre-flight credit and constraint check (read profile/attempt from D1); stream response using existing AI proxy logic (port from `app/api/ai/chat/route.ts`); deduct credits and update attempt/ai_calls in D1; send `chunk` / `done` / `error` / `constraint_warning` events. |
| **`/api/webhooks/stripe`** | POST | Returns `{ received: true }` | Read body as text; get `stripe-signature` header; verify with `STRIPE_WEBHOOK_SECRET`; handle `checkout.session.completed` (add credits to profile, insert transaction in D1); return 200. |

**References:** Logic lives in `dev/app/api/` (Next.js routes) and `dev/lib/` (ai proxy, constraints, judge, stripe). Port the same behavior; only the runtime (request/response, env) and the database (D1 instead of Postgres) change.

### 2.3 D1 binding in wrangler.toml

```toml
[[d1_databases]]
binding = "DB"
database_name = "ruwt-dev"
database_id = "<id-from-wrangler-d1-create>"
```

Functions receive `context.env.DB`; pass it to your shared `getDb(env)`.

---

## 3. Optional UI Components

**Current state:** Core and feature components used by existing screens are in `src/components/` (RN Web). Several shadcn/Radix-style components were not ported.

**Goal:** Add RN Web versions only when a screen needs them.

| Component | Use case | Priority |
|-----------|----------|----------|
| **Dialog** | Confirmations (e.g. sign out, delete). | Medium — can use a simple modal View until then. |
| **Tabs** | Arena: Chat vs Files. | High if Arena uses tabs. |
| **Progress** | Challenge cards or constraint display. | Low. |
| **Select** | Language picker, model selector (or use a custom dropdown). | Medium. |
| **Form + validation** | Settings, registration fields. | Low if current forms are sufficient. |
| **Table** | Leaderboard table (optional if current list UI is enough). | Low. |
| **Textarea** | Long text inputs. | Low. |
| **Sonner / toast** | Notifications after submit, errors. | Medium — can add a small toast provider with RN Web. |

**Approach:** Implement in `src/components/ui/` using `View`, `Text`, `Pressable`, `StyleSheet`, and theme. Reuse patterns from existing `Button`, `Card`, `Input`.

---

## 4. Challenges Data Source

**Current state:** ChallengesScreen fetches from `supabase.from('challenges')`.

**With full-stack Cloudflare (D1):**

- **Store challenges in D1.** Migrate or seed the `challenges` table in D1 (same schema as in §2.1). No Supabase table for challenges.
- **Add `GET /api/challenges`** in Functions: read from D1 via shared `getDb(env)`, return list. No auth required for listing.
- **ChallengesScreen:** Replace Supabase fetch with `fetch('/api/challenges')`.

Auth (who the user is) stays Supabase; app data (challenges, attempts, profiles, etc.) lives in D1.

---

## 5. TypeScript

**Current state:** Build is `vite build` only; `tsc --noEmit` is not run in CI/build due to react-native vs react-native-web type conflicts. Custom `src/react-native.d.ts` provides minimal types.

**Goal (optional):** Restore `npm run typecheck` (e.g. `tsc --noEmit`) with no errors.

**Tasks:**

- Resolve `StyleSheet` / `StyleProp` and other react-native types (either extend `src/react-native.d.ts` or use `@types/react-native-web` with correct module resolution so `react-native` alias gets those types).
- Remove or fix any remaining `any` or unused-variable errors in `src/`.
- Re-add `tsc --noEmit` to the build script or run it in CI only.

---

## 6. Environment and Documentation

**Current state:** App uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Functions will need D1 (binding), Supabase env for auth, Stripe, and AI provider keys. No central env/docs in repo.

**Tasks:**

| # | Task |
|---|------|
| 6.1 | Add **`.env.example`** in `dev/` with: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and placeholders for any other client or build-time vars. No `DATABASE_URL` (D1 is bound in wrangler). |
| 6.2 | Document **Cloudflare Pages / wrangler**: D1 binding (`DB`) is in `wrangler.toml`; in dashboard or `.dev.vars` set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `STRIPE_WEBHOOK_SECRET`, and AI-related secrets used by `/api/ai/chat`. |
| 6.3 | Update **`dev/README.md`** (or root README): full-stack Cloudflare (Pages + Functions + D1); Supabase for auth only; how to run `npm run dev`, `npm run build`, create D1 DB, run migrations, deploy to Cloudflare Pages; where to set env vars; that Functions are stubs until §2 is done; optional note on Arena (§1). |

---

## Order of work (suggested)

1. **§2 — D1 + Cloudflare Functions**  
   Create D1 database; add Drizzle D1 schema and migrations; implement shared `getDb(env)` and auth helper. Then implement each route (leaderboard, attempts, submissions, ai/chat, webhooks/stripe). No `DATABASE_URL` or external Postgres.

2. **§4 — Challenges**  
   Ensure challenges table is in D1 and seeded; add `GET /api/challenges`; point ChallengesScreen at it.

3. **§1 — Arena**  
   Once attempts and submissions work, wire the IDE (DOM components, WebContainer, chat, run/submit, constraints).

4. **§3, §5, §6**  
   Optional UI components, typecheck, and env/docs can be done in parallel or as needed.

---

## Verification (from original plan)

- [ ] `npm run build` produces `dist/` with `index.html` and assets.
- [ ] `npm run dev` → landing and social theming (fonts, colors) load.
- [ ] All routes work: `/`, `/login`, `/register`, `/callback`, `/challenges`, `/leaderboard`, `/profile`, `/settings`, `/arena/:challengeId`.
- [ ] Dark/light toggle works.
- [ ] Arena loads Monaco, terminal, chat, cost tracker, constraints (after §1).
- [ ] Responsive layout at mobile width.
- [ ] (Optional) `npm run typecheck` passes.
- [ ] Auth (GitHub/Google/email) works via Supabase; app data (leaderboard, attempts, challenges) comes from D1 via Functions.
