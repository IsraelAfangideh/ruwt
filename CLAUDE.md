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

## Knowledge Sharing

When you discover something non-obvious (gotchas, architecture decisions, debug findings, deploy quirks), update this file or your auto-memory notes so future Claude instances benefit. Specifically:

- **This file (`CLAUDE.md`)**: Add project-level facts — infrastructure config, architectural decisions, deploy procedures, service quirks. Keep it concise and factual.
- **Auto-memory (`~/.claude/projects/.../memory/MEMORY.md`)**: Add working patterns, user preferences, and recurring pitfalls you've confirmed across interactions.

Don't wait to be asked — if you hit a wall and solve it, document the fix here before moving on.
