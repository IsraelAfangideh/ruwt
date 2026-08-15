# Ruwt Monorepo

## Project Structure

```
ruwt/
├── dev/          # AI-Efficiency Assessment Platform (web app)
├── health/       # Ruwt Fit — Fitness & Nutrition Tracker (web app)
├── ai/           # Ruwt.ai — Agent Observation Platform (web app)
├── social/       # Ruwt Social Network (mobile + API)
├── trade/        # Ruwt Trade — Palm Oil Futures (web app + smart contracts)
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
  - Cloudflare's built-in Workers Builds git integration was disconnected (was misconfigured, causing failing checks on PRs). Deploys are handled exclusively by GitHub Actions.
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

## /trade — Ruwt Trade (Palm Oil Futures)

- **Stack**: Solidity (Hardhat) + Express API + React (Vite) PWA, Polygon PoS
- **Smart contract**: `trade/chain/contracts/PalmVault.sol` — vault-model futures
- **API**: `trade/api/` — Express server, position engine, Databento oracle
- **Web app**: `trade/app/` — Vite + React PWA (port 5180), Ruwt design system
- **Design system**: Same warm cream/dark palette as /dev and /social, with green/red trading colors
  - Theme: `trade/app/src/theme/colors.ts` (light/dark + profit/loss), `tokens.ts`
  - Light mode: profit `#16a34a`, loss `#dc2626`
  - Dark mode: profit `#00f0aa`, loss `#ff3366`
- **Design constitution**: `trade/DESIGN.md` — **READ BEFORE making any UI changes**. Hard rules on flicker, pricing clarity, transitions, mobile-first, data formatting.

### How the vault works
- Owner seeds vault with USDT ($2K initial). Vault is counterparty to all trades.
- User deposits USDT → opens long at oracle price → closes whenever → PnL settled from vault.
- 3% fee on close (accrues to vault). No leverage. Max $100/position. OI capped at vault balance.
- Operator (backend hot wallet) submits oracle prices and executes open/close on-chain.

### Contract: PalmVault.sol
- 35 passing tests covering all flows, edge cases, access control, price bounds
- Struct-packed Position (3 storage slots), cached storage reads in closeLong
- Price bounds: MIN_PRICE=$100/MT, MAX_PRICE=$100,000/MT (catches operator bugs)
- Zero-address checks on constructor and setOperator
- nonReentrant on all state-changing functions

### Local dev setup (3 terminals)

```bash
# Terminal 1: Hardhat local node
cd trade/chain && npx hardhat node

# Terminal 2: Deploy contracts + start API
cd trade/chain && npx hardhat run scripts/deploy-local.ts --network localhost
# Copy the env vars from output, then:
cd ../api && VAULT_ADDRESS=<addr> OPERATOR_PRIVATE_KEY=<key> POLYGON_RPC=http://127.0.0.1:8545 npm run dev

# Terminal 3: Web app
cd trade/app && npm run dev
# → http://localhost:5180
```

### Local dev — Hardhat well-known accounts
- Account #0 (owner): `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- Account #1 (operator): `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`, key: `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`
- Account #2 (demo trader / Alice): `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`
- deploy-local.ts seeds vault with $2K and gives Alice $200 platform balance

### Browser testing with Chrome MCP tools
1. Start the 3-terminal local dev setup above
2. Load Chrome MCP tools via `ToolSearch("select:mcp__claude-in-chrome__tabs_context_mcp,...")`
3. `tabs_context_mcp(createIfEmpty: true)` → get tab ID
4. `navigate(url: "http://localhost:5180", tabId)` → load app
5. `screenshot` → verify UI rendered (price display, trade panel, balance)
6. `find("$50 preset button")` → click to select amount
7. `find("Buy Long button")` → click to open position on-chain
8. Wait 3s for tx confirmation, `screenshot` → verify position card appeared with P&L
9. `find("Close Position button")` → click to close
10. Wait 3s, `screenshot` → verify position removed, balance updated
11. Test dark mode: `find("Dark theme toggle button")` → click → `screenshot`

### API endpoints
- `GET /api/prices/current` — latest palm oil price
- `POST /api/positions/open` — `{trader, amount}` → opens long
- `POST /api/positions/close` — `{positionId}` → closes position
- `GET /api/positions/:id` — position details + unrealized P&L
- `GET /api/account/:address` — trader balance + vault stats
- `GET /health` — health check
- Mutation routes require `X-API-Key` header when `API_KEY` env var is set

### Deploy to production
1. Create deployer + operator wallets (separate keys)
2. Fund deployer with ~5 MATIC, operator with ~2 MATIC on Polygon
3. Get 2,000 USDT on Polygon in deployer wallet
4. Deploy: `DEPLOYER_PRIVATE_KEY=... USDT_ADDRESS=0xc2132D05D31c914a87C6611C10748AEb04B58e8F OPERATOR_ADDRESS=... npx hardhat run scripts/deploy.ts --network polygon`
5. Deploy API to Fly.io (same as /executor pattern)
6. Deploy web app to Cloudflare Pages (same as /dev pattern)
7. Databento API key for real FCPO prices ($125 free credits, then ~$199/mo)

## /health — Ruwt Fit (Fitness & Nutrition Tracker)

- **Stack**: React (react-native-web) + Vite, Cloudflare Pages + Functions, Cloudflare D1 (SQLite), Supabase Auth (shared with /dev)
- **Domain**: `ruwt.health` (planned), fallback `ruwt-health.pages.dev`
- **Cloudflare Pages project**: `ruwt-health`
- **D1 database**: `ruwt-health` (ID: `a3126eb6-d8bb-4e34-9e56-950956ad2115`)
- **Auth**: Shared Supabase project `fzncpdelyfuvdeqmwznx` (same user accounts as ruwt.dev)
- **Deploy**: GitHub Actions (`deploy-health.yml`) → `npx wrangler pages deploy dist --project-name=ruwt-health`
  - Triggers on push to `main` with changes in `health/**`, or manual `workflow_dispatch`
- **Design system**: Same warm cream/dark palette with gold accent as /dev and /social
- **Database tables**: profiles, user_goals, foods (~90 seeded), meals, meal_items, exercises, workouts, workout_sets, body_logs, daily_logs
- **Key screens**: Dashboard (calorie ring, macro bars, meal/workout summary), LogMeal, LogWorkout, FoodSearch, Progress (SVG charts), Profile/Settings
- **API endpoints**: /api/dashboard, /api/goals, /api/meals, /api/workouts, /api/foods, /api/body-logs, /api/progress, /api/daily-log
- **Setup needed**: Purchase ruwt.health domain, add Supabase redirect URLs for ruwt-health.pages.dev
- **Local dev**: `cd health && npm run dev` (port 5174), `npx wrangler pages dev dist --d1=DB` for Functions

## /ai — Ruwt.ai (Agent Observation Platform)

Separate product from ruwt.dev. Own Pages project, D1 database, domain, and deploy
workflows. ruwt.dev continues to deploy from `/dev` unchanged.

- **Stack**: React (react-native-web) + Vite, Cloudflare Pages + Functions, Cloudflare D1 (SQLite), Supabase Auth
- **Domain**: `ruwt.ai` (live), fallback `ruwt-ai.pages.dev`
- **Cloudflare Pages project**: `ruwt-ai`
- **D1 databases**: `ruwt-ai` (ID: `e6f7bd3b-dd99-4152-a6c4-2236e989aece`), `ruwt-ai-preview` (ID: `7c2840ee-51be-4c2b-ae49-4f3b8fe533d0`)
- **Auth**: Shared Supabase project `fzncpdelyfuvdeqmwznx` (same user accounts as ruwt.dev)
- **Deploy**: GitHub Actions (`deploy-ai.yml`) → `npx wrangler pages deploy dist --project-name=ruwt-ai`
  - Triggers on push to `main` with changes in `ai/**`, or manual `workflow_dispatch`
- **Preview deploys**: `deploy-ai-preview.yml` → `<branch>.ruwt-ai.pages.dev` (isolated preview D1)
- **Design system**: Same warm cream/dark palette with gold accent as /dev and /health
- **Key screens**: Landing (Download in header), Intelligence dashboard, Org/workspace settings, ingestion key management
- **API endpoints**: /api/intelligence/events, /api/intelligence/overview, /api/intelligence/demo, /api/intelligence/api-keys, /api/intelligence/policies, /api/orgs, /api/marketing/visit, /api/marketing/download
- **Local dev**: `cd ai && npm run dev` (port 5175), `npx wrangler pages dev dist --d1=DB` for Functions
- **Desktop app**: Tauri 2 in `/desktop` (`ai.ruwt.desktop`). CI `Release Desktop` builds unsigned macOS DMG + Windows NSIS, publishes GitHub Release `desktop-latest`, then retriggers `deploy-ai.yml` so files land at `/downloads/Ruwt.dmg` and `/downloads/Ruwt-Setup.exe`.
  - Empty `APPLE_*` GitHub secrets break codesign (`SecKeychainItemImport`). Leave them unset until a real Developer ID `.p12` exists; `signingIdentity: "-"` skips signing.
  - Set `TAURI_BUNDLER_DMG_IGNORE_CI=true` in Release Desktop. Otherwise `CI=true` skips Finder layout and the DMG alphabetizes Applications to the left with no drag arrow.
  - Docs: `docs/desktop-distribution.md`

## Cloudflare Account

- **Account ID**: `32f5999dbd09eae38c1de8c15de98d48`
- **Zone**: `ruwt.dev` (zone ID: `31032a4069bc880a095d18e9e96947ac`, Cloudflare nameservers, free plan)
- **DNS**: CNAME `ruwt.dev` → `ruwt-dev.pages.dev` (proxied)
- **ruwt.ai zone**: Live. CNAME `ruwt.ai` + `www` → `ruwt-ai.pages.dev` (proxied). Does not affect ruwt.dev.
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
  - `uri_allow_list`: `https://ruwt.dev/**,https://ruwt-dev.pages.dev/**,http://localhost:5173/**,https://ruwt-health.pages.dev/**,http://localhost:5174/**`
  - Providers: GitHub OAuth + email/password (Google disabled)
  - Add for ruwt.ai: `https://ruwt.ai/**`, `https://ruwt-ai.pages.dev/**`, `http://localhost:5175/**`

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

## Google Sheets CRM

- **Spreadsheet**: [Ruwt CRM](https://docs.google.com/spreadsheets/d/16O3N3C4zfopf50cf_vzQU-b3zWsvh_32aOZG3N1PbAU)
- **Spreadsheet ID**: `16O3N3C4zfopf50cf_vzQU-b3zWsvh_32aOZG3N1PbAU`
- **Sheet name**: `Prospects`
- **Auth**: OAuth token at `~/.claude/google-sheets/token.json` (auto-refreshes, no browser login needed)
- **Credentials**: `~/.claude/google-sheets/credentials.json` (OAuth client ID from Google Cloud project `ruwt-dev`)
- **Required Python packages**: `google-auth-oauthlib`, `google-api-python-client`

### How to read/write the CRM from Claude

```python
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
import json

with open('/Users/israelafangideh/.claude/google-sheets/token.json') as f:
    token_data = json.load(f)

creds = Credentials(
    token=token_data['token'],
    refresh_token=token_data['refresh_token'],
    token_uri=token_data['token_uri'],
    client_id=token_data['client_id'],
    client_secret=token_data['client_secret'],
    scopes=token_data['scopes']
)

service = build('sheets', 'v4', credentials=creds)
SPREADSHEET_ID = '16O3N3C4zfopf50cf_vzQU-b3zWsvh_32aOZG3N1PbAU'

# Read all rows:
result = service.spreadsheets().values().get(
    spreadsheetId=SPREADSHEET_ID, range='Prospects!A:V'
).execute()
rows = result.get('values', [])

# Append a new prospect:
service.spreadsheets().values().append(
    spreadsheetId=SPREADSHEET_ID,
    range='Prospects!A:V',
    valueInputOption='RAW',
    body={'values': [['Company','Name','Title','email@co.com','50','LinkedIn DM','LinkedIn','Contacted','2026-02-22','2026-02-22','2026-02-25','opener text','No','','','','','','','','','notes']]}
).execute()

# Update a specific cell (e.g., row 3 status):
service.spreadsheets().values().update(
    spreadsheetId=SPREADSHEET_ID,
    range='Prospects!H3',
    valueInputOption='RAW',
    body={'values': [['Replied']]}
).execute()
```

### CRM Column Layout (A–V)

`Company | Contact Name | Title | Email | Engineers | Channel | Source | Status | First Contact | Last Contact | Follow-up Due | Opener Used | Replied | Demo Date | Subscribed Date | Plan | Assessments Run | Referral Asked | Referrals Given | Lost Reason | Re-approach | Notes`

### Status values (dropdown, color-coded)

`Identified` (gray) → `Contacted` (blue) → `Replied` (gold) → `Demo` (orange) → `Subscribed` (green) or `Lost` (red)

### Channel values (dropdown)

`Email`, `LinkedIn DM`, `Slack DM`, `Twitter DM`, `Text`, `Discord`, `In-person`

### If token expires

The refresh token should auto-renew. If you get a 401 error, re-run the OAuth flow:
```bash
python3 -c "
from google_auth_oauthlib.flow import InstalledAppFlow
import json
flow = InstalledAppFlow.from_client_secrets_file(
    '/Users/israelafangideh/.claude/google-sheets/credentials.json',
    scopes=['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
)
creds = flow.run_local_server(port=0)
token_data = {
    'token': creds.token, 'refresh_token': creds.refresh_token,
    'token_uri': creds.token_uri, 'client_id': creds.client_id,
    'client_secret': creds.client_secret, 'scopes': list(creds.scopes)
}
with open('/Users/israelafangideh/.claude/google-sheets/token.json', 'w') as f:
    json.dump(token_data, f, indent=2)
print('Token saved!')
"
```
This opens the browser once — user approves — token is saved and auto-refreshes from then on.

## ruwt.dev Arena — User Flow

1. Landing → Register/Login (GitHub OAuth or email, 50k free credits)
2. Browse challenges at `/challenges` (filter by category: Model Selection, Prompt Efficiency, Debugging)
3. Pick challenge → choose Timed or Untimed → Arena IDE opens
4. IDE layout: sidebar LEFT (description/AI chat tabs), editor+terminal RIGHT, xterm virtual shell with `ruwt` TUI mode
5. Iterate: write code, chat with AI (costs credits), run tests, debug
6. Submit → attempt marked passed/failed
7. Leaderboard ranks by challenges solved, then avg cost (cheapest wins)
- Core concept: measures how *efficiently* you use AI, not just correctness
- Philosophy: easy challenge + premium model = should pass. The game is efficiency, not fighting the platform.

## Arena Challenge Harness

- `judge.ts` `buildTestCode()` calls exported functions as `funcName(...args)` — NO `new` keyword
- Class-based challenges MUST have `test_harness` column with a `solve()` dispatch function that uses `new`
- Challenges with complex input (command sequences, test scenario names) also need harnesses
- Safety net: `judge.ts` detects `class` declarations and adds `new` automatically
- If `module.exports = { ..., solve }` includes `solve`, it's used as single dispatch (not multi-export table)
- Challenge design guidelines in `dev/marketing/CONSTITUTION.md`

## Arena AI Diff Applier

Code: `dev/src/lib/ai/diff-apply.ts` (parser) + `dev/src/lib/ai/code-apply.ts` (orchestrator)

**Parsing priority chain** (`applyCodeFromResponse`):
1. SEARCH/REPLACE blocks (angle-bracket `<<<SEARCH`/`>>>REPLACE` or colon `SEARCH:`/`REPLACE:`)
2. Bare conflict markers (`<<<<<<<` ... `>>>>>>>` without SEARCH/REPLACE labels)
3. Unified diff (`@@ -1,5 +1,8 @@` or bare `@@` without line numbers)
4. Fenced code block extraction (largest `` ``` `` block that looks like a complete file)
5. Fallback: `needsApplyModel: true` → calls apply LLM to merge

**Key gotcha**: Fenced code blocks containing diff content (with `@@`, `+`/`-` lines) are skipped at step 4 so they don't get dumped as raw code. Without this guard, a `` ```diff `` block passes the `looksComplete` check (because the code inside matches `/^function /`) and gets written verbatim into the editor — `@@` and all.

**Why models produce weird diffs**: Small/medium models output wildly inconsistent formats — bare `@@` without line numbers, `FILE:` instead of `--- a/`, colon-style `SEARCH:`/`REPLACE:`, or mix unified diff `+`/`-` inside SEARCH/REPLACE blocks. The parser is deliberately lenient with many fallback strategies, and `cleanDiffContamination()` strips mixed-format `+`/`-` prefixes from SEARCH/REPLACE content.

## /executor — Code Execution Sandbox

- **Runs on**: Fly.io (`ruwt-exec.fly.dev`), Docker container
- **Source**: `executor/` directory (Dockerfile, server.js, entrypoint.sh)
- **Piston-compatible API**: `POST /api/v2/piston/execute` and `POST /execute`
- **Auth**: `EXECUTOR_SECRET` env var, checked via `X-Executor-Secret` header (conditional — unauthenticated if not set)
- **Languages**: JavaScript (Node 18), TypeScript (tsx), Python 3

### Security layers
1. **Network isolation**: `entrypoint.sh` tries iptables-legacy then iptables to block outbound for `executor` uid (REJECT, not DROP). **Note**: Fly.io Firecracker VMs lack nf_tables kernel module — iptables is NOT active there. Works in Docker with `--privileged`. Explore Fly.io network policies for production network isolation.
2. **Filesystem**: `chmod 700 /app` (can't read server code), `/etc/passwd|shadow|group` restricted
3. **Process group kill**: `detached: true` + `kill(-pid, SIGKILL)` on timeout (handles forks)
4. **Python memory limit**: 256MB `RLIMIT_AS` preamble prepended to all Python code
5. **Temp cleanup**: `rmSync(recursive: true, force: true)` handles nested dirs user code creates
6. **Code size limit**: 1MB max enforced at `dev/functions/api/execute.ts` Zod schema
7. **Auth propagation**: CF Pages (`execute.ts`) → `judge.ts` → executor, CI workflows also send header

### Testing executor changes locally (Docker)

No staging Fly.io app exists — Docker is the only pre-production gate.

```bash
docker build -t ruwt-exec-test ./executor
docker run --privileged -d --name ruwt-exec-test -p 8080:8080 -e EXECUTOR_SECRET=test123 ruwt-exec-test
```

Test matrix (curl against `localhost:8080`):
| Test | Payload | Expected |
|------|---------|----------|
| Auth blocked | POST without secret | 403 |
| Auth works | POST with `X-Executor-Secret: test123` | 200 + stdout |
| Network blocked | Python `urllib.request.urlopen(...)` | Immediate URLError |
| Filesystem blocked | Python `open("/app/server.js")` | PermissionError |
| Process group kill | Python fork + sleep, 3s timeout | SIGKILL, no orphans |
| Python memory | Python `[0] * (300*1024*1024)` | MemoryError |
| Nested cleanup | Python `os.makedirs("a/b/c")` | `/tmp/exec-*` clean after |
| executionTimeMs | Any code | Field present in response |

Cleanup: `docker stop ruwt-exec-test && docker rm ruwt-exec-test`

### Deploy order (critical — backward compatibility)
1. **CF Pages first** (judge.ts auth header + execute.ts code limit) — backward-compatible, sends header when available
2. **CI workflows** (keep-alive.yml + eval.yml auth headers)
3. **Executor to Fly.io last** — `flyctl deploy` from `executor/`

## Test Coverage (dev/)

- Provider: `istanbul` (NOT v8 — v8 has ENOENT race condition with vitest)
- Config: `vitest.config.ts` needs `clean: false` and `reportOnFailure: true`
- Barrel file exclusions: `src/components/ui/index.ts`, `src/theme/index.ts`, `src/navigation/types.ts`
- `patch-package` persists vitest ENOENT fix — see `patches/vitest+4.0.18.patch`
- Istanbul ignore syntax: `/* istanbul ignore next -- @preserve */` (the `@preserve` is REQUIRED — esbuild strips comments without it)
- React Native Web testing: use `fireEvent.click()` not `fireEvent.press()`; never mock `react-native` directly (alias handles it)
- Monaco editor uses `React.lazy` + `Suspense` (not manual DOM mount) for reactive props
- SSE stream parsing must buffer incomplete lines across `read()` calls — split by `\n`, keep last part as buffer

## Additional Gotchas

- **`position: fixed` does not work inside a react-native-web `ScrollView`.** RNW gives every ScrollView `transform: translateZ(0)`, and a transformed ancestor becomes the containing block for fixed descendants — so a "fixed" overlay is rebased to the scroll container and scrolls away after one viewport. 25 components use a ScrollView, so this bites any fixed overlay, sticky bar, or full-bleed decorative layer declared inside a screen. Two ways out: keep the layer inside the screen but use `position: absolute` in a `position: relative` page wrapper (what `LandingScreen`'s ruled-grid layer does), or mount it above `AppNavigator` in `App.tsx`, outside every ScrollView — which is how both `ToastProvider` and `SkipLink` avoid it.
- **The stack keeps departed screens mounted under `display: none`** (`NativeStackView.js` sets `display: isFocused ? 'flex' : 'none'`). So `getElementById` can return an element belonging to a screen the user already left — several screens can carry `id="main-content"` at once. Anything resolving a screen element globally must skip unrendered matches; `findMainRegion` in `src/shared/ui/SkipLink.tsx` shows the check.
- `develop` branch is heavily diverged from `main` — use feature branches off `main` for new work
- Docker Desktop must be running for local executor tests (`open -a Docker` on macOS)
- `--privileged` flag required for iptables inside Docker on macOS
- Preview deploys: PRs with `dev/**` changes get preview URLs via `deploy-dev-preview.yml` workflow. Production deploys only on push to `main`.

## Knowledge Sharing

When you discover something non-obvious (gotchas, architecture decisions, debug findings, deploy quirks), update this file or your auto-memory notes so future Claude instances benefit. Specifically:

- **This file (`CLAUDE.md`)**: Add project-level facts — infrastructure config, architectural decisions, deploy procedures, service quirks. Keep it concise and factual.
- **Auto-memory (`~/.claude/projects/.../memory/MEMORY.md`)**: Add working patterns, user preferences, and recurring pitfalls you've confirmed across interactions.

Don't wait to be asked — if you hit a wall and solve it, document the fix here before moving on.

## Always run /simplify after your changes and always tell your user whether you did this or not
## When you push, always watch the deploy to make sure it succeeds. You can use /loop for this

