# Ruwt IDE — Tech Stack & Strategy

## The Product

A browser-based AI coding tool that doubles as the take-home assessment platform for hiring teams. You own your code. Bring your own API key. Deploy anywhere. Priced at cost.

Two runtime modes: **Browser Mode** (WebContainer, free, JS/TS) and **Cloud Mode** (Fly Machine, $5/month, any language, Docker, full Linux). Same IDE, same AI, different backend.

**The business:** Companies pay for take-home assessments with AI telemetry. Candidates experience the IDE during assessments. Some stick around as free/paid IDE users. The IDE is the product and the acquisition channel simultaneously.

---

## Philosophy: "Your Code Is Yours"

Every competitor locks you in. We don't.

- **Your code, your files.** One-click download as zip. `git push` to your own repo. No proprietary project format.
- **Your models.** Bring your own API key — Anthropic, OpenAI, Groq, Ollama on localhost. Or use our open-source models for free.
- **Your infrastructure.** Deploy to Cloudflare, Vercel, Netlify, Fly.io, your VPS. Not locked into our hosting.
- **Your data.** No training on your code. Ever. Export everything. Delete your account and it's gone.

---

## Why This Exists (vs Competitors)

### vs Bolt / Lovable / v0

They're for people who don't want to code. User describes an app in English, AI generates it, user deploys to their platform. You can't clone a real repo, fix a specific bug, or work on an existing codebase.

Ruwt IDE is for people who **do** code but want cheap AI help. Clone your repo, navigate to a file, ask the AI to fix it, review the diff, commit, push. Real development workflow.

Also: Bolt/Lovable lock you in. Your project lives on their platform, their hosting, their deploy pipeline. Ruwt lets you take your code and leave. Download the zip. Push to your GitHub. Deploy wherever you want. The code is yours from the first keystroke.

### vs Cursor / Claude Code

Great tools. $100-300/month for real usage. Local install required. Proprietary.

Ruwt is browser-based (no install, works on a Chromebook) and priced at cost. Cloud Mode gives the same full-environment power (Docker, any language, any CLI) at a fraction of the price because Fly Machines are cheap and we don't mark up.

### vs Replit / CodeSandbox

Replit targets beginners and education. Expensive server-side containers ($25-40/month). CodeSandbox is for quick frontend prototyping with minimal AI.

Ruwt's free tier runs on WebContainer (zero server cost). Cloud Mode uses on-demand Fly Machines that stop when idle (~$1-4/month actual compute vs Replit's always-on containers). AI is a core feature, not a bolt-on.

### vs all of them

Nobody lets you bring your own API key. Nobody prices at cost. Nobody has an integrated AI fluency assessment platform with take-home telemetry. Nobody gives you a full Linux VM with Docker for $5/month. Ruwt does all of it.

---

## Differentiators

### 1. Take-Home Assessments with Full Session Replay

The primary differentiator and revenue driver. The pitch: "Everyone's doing vibe coding. We're the only platform that lets you see how."

Companies don't just get a summary. They get a **full session replay** — a timeline-scrubbing view of everything the candidate did:

- **Every keystroke** (content snapshots every 5 seconds per active file)
- **Every AI prompt** (full text of what they asked, which model they chose)
- **Every AI response** (full text of what the AI suggested)
- **Every terminal command** (input + output + exit code)
- **Every file switch** (which files they opened, when, in what order)
- **Every test run** (pass/fail, which tests, output)
- **Active vs idle time** (window focus tracking)
- **AFI score** computed from the session
- **Full code diff** (what changed from the original repo)

The hiring manager can scrub through the timeline, see exactly when the candidate asked for help, what they asked, what the AI said, and what they did with it. This is 10x more valuable than a test score.

No other assessment platform has this. HackerRank, Codility, CoderPad — they test coding ability with contrived puzzles. We test AI fluency on the company's real codebase with full observability.

**Candidate disclosure:** Transparent, not hidden. Assessment landing page clearly states telemetry is recorded. Good candidates want to show off their process.

The take-home model is also the acquisition engine: every candidate spends 4-8 hours in the IDE, and ~10% come back for personal use afterward.

### 2. Priced at Cost

Don't mark up AI compute. Pass through the exact Workers AI cost with zero margin.

Current Cloudflare Workers AI pricing:
- Llama 3.3 70B: ~$0.30/M input, ~$0.80/M output
- Heavy coding session: ~$0.02-0.05
- Heavy month of usage: ~$2-5 in actual AI compute

Charge $3-5/month flat, or meter actual usage + $1/month platform fee.

Every competitor marks up AI 3-10x. We say: "We don't make money on AI compute. We make money on hiring assessments." The IDE is the free/cheap distribution channel that feeds the real business.

Target: affordable for a developer in any country. Not $20-40/month. $3-5/month or less.

### 3. BYOK (Bring Your Own Key)

Default mode: users plug in their own API keys.
- Anthropic key → Claude at Anthropic's price
- OpenAI key → GPT-4o at OpenAI's price
- Groq key → Llama at Groq speed
- Ollama URL → local models, completely free
- No key → our Workers AI open-source models (free tier)

We make zero on AI compute in BYOK mode. Our infra cost drops to near zero. Users get whatever model they want at the cheapest possible price.

Nobody else does this because everyone's business model depends on the AI markup.

### 4. You Own Everything

- One-click download as zip
- `git push` to your own GitHub/GitLab
- One-click deploy to Cloudflare Pages, Vercel, Netlify, GitHub Pages — using their accounts, not ours
- No proprietary project format. Standard files on a standard filesystem.
- No "export" — the code is already yours, always

Bolt locks you into Bolt. Lovable locks you into Lovable. v0 is Vercel's funnel. We're the one that sets the code free.

### 5. B2B Acquisition Flywheel

The take-home assessment is the growth engine, not organic/viral adoption:

```
Company signs up → sends candidates → candidates use IDE →
some stick around → get hired elsewhere → new company discovers ruwt
```

No marketing budget needed. Each B2B customer brings 10-20 new developer users per month, acquired for free.

### 6. AI Fluency Scoring in the IDE

The only coding tool that measures how well you use it. As you work:
- Track cost per task
- Efficiency metrics (tokens per fix, model selection quality)
- AFI score visible in your profile
- "You spent $0.03 solving this bug. Efficiency: 95th percentile."

This gamifies AI usage and feeds back into the assessment platform.

---

## What You Already Have (and can reuse)

| Piece | Status | Location |
|-------|--------|----------|
| Monaco editor (React.lazy) | Production | `dev/src/features/arena/ArenaIDE.tsx` |
| AI chat + SSE streaming | Production | `dev/src/features/arena/useAIChat.ts` |
| Diff applier (6 formats) | Production | `dev/src/features/arena/lib/diff-apply.ts` |
| System prompt assembly | Production | `dev/functions/_shared/system-prompts.ts` |
| Cost tracking per AI call | Production | `dev/functions/_shared/constraints.ts` |
| Workers AI (Llama/Qwen/Mistral) | Production | `dev/functions/api/ai/chat.ts` |
| Code execution sandbox | Production | `executor/` on Fly.io |
| xterm.js terminal | Production | `dev/src/features/arena/TerminalPanel.tsx` |
| Supabase auth (cookie-based) | Production | `dev/functions/_shared/auth.ts` |
| Stripe billing + credits | Production | `dev/functions/api/webhooks/stripe.ts` |
| D1 database (50+ tables) | Production | `dev/drizzle/schema.d1.ts` |
| AFI scoring + badges | Production | `dev/functions/_shared/scoring.ts` |
| Assessment/org system | Production | `dev/functions/api/assessments/` |
| WebContainer integration | **Dead code** | `dev/app/arena/[challengeId]/page.tsx` (old Next.js) |
| File tree component | **Dead code** | `dev/app/` (old Next.js `FileTree`) |
| `@webcontainer/api` | **Installed** | `dev/package.json` (already a dependency) |

**~70% of the stack exists.** The gap is filesystem/project support, codebase-aware AI context, BYOK key management, and Cloud Mode.

---

## Architecture: Hybrid (Browser Mode + Cloud Mode)

The IDE has two runtime backends. Same frontend, same AI chat, same diff applier. The only difference is what's behind the terminal and filesystem.

```
┌──────────────────────────────────────────────────────────────┐
│                      Browser (user's tab)                     │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────────────────┐│
│  │  Monaco   │  │  xterm   │  │  Runtime Abstraction Layer  ││
│  │  Editor   │  │ Terminal │  │                             ││
│  │  multi-  │  │          │  │  readFile() writeFile()     ││
│  │  file    │  │          │  │  spawn() listFiles()        ││
│  │  tabs    │  │          │  │  gitClone() gitPush()       ││
│  └──────────┘  └──────────┘  └──────────┬──────────────────┘│
│       │              │                   │                    │
│       │              │          ┌────────┴────────┐          │
│       │              │          │                 │          │
│       │              │    ┌─────┴─────┐   ┌──────┴──────┐   │
│       │              │    │  Browser   │   │   Cloud     │   │
│       │              │    │  Mode      │   │   Mode      │   │
│       │              │    │            │   │             │   │
│       │              │    │ WebContainer│  │ Fly Machine │   │
│       │              │    │ in-browser │   │ via WebSocket│  │
│       │              │    │ JS/TS only │   │ any language │   │
│       │              │    │ free       │   │ $3-5/month  │   │
│       │              │    └───────────┘   └─────────────┘   │
│       │              │                                       │
│  ┌────┴──────────────┴───────────────────────────────────┐  │
│  │                  React + Vite SPA                       │  │
│  │  - File tree sidebar                                   │  │
│  │  - AI chat panel (SSE streaming)                       │  │
│  │  - Cost tracker / AFI metrics                          │  │
│  │  - Diff applier (already built)                        │  │
│  │  - BYOK key management                                │  │
│  └───────────────────────┬───────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────┼──────────────────────────────────┐
│              Cloudflare Edge (global)                         │
│                          │                                    │
│  ┌───────────────────────┴───────────────────────────┐       │
│  │           Cloudflare Pages + Functions             │       │
│  │  - /api/ai/chat → Workers AI (free tier)           │       │
│  │  - /api/ai/chat → BYOK passthrough (premium)       │       │
│  │  - /api/projects → R2 (save/load projects)         │       │
│  │  - /api/machines → Fly Machines API (cloud mode)    │       │
│  │  - /api/challenges, assessments, auth, etc.        │       │
│  │  - /api/deploy → Vercel/Netlify/CF (one-click)     │       │
│  └──────┬────────────┬──────────────┬────────────────┘       │
│         │            │              │                         │
│  ┌──────┴──────┐ ┌───┴────┐ ┌──────┴──────────┐             │
│  │  D1 (SQLite)│ │   R2   │ │   Workers AI    │             │
│  │  users,     │ │ project│ │   Llama 3.3 70B │             │
│  │  challenges,│ │ files, │ │   Qwen 2.5 32B  │             │
│  │  attempts,  │ │ snaps  │ │   Mistral 24B   │             │
│  │  orgs, AFI  │ │        │ │   (free tier)   │             │
│  └─────────────┘ └────────┘ └─────────────────┘             │
└──────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│               Fly.io (existing account)                       │
│                          │                                    │
│  ┌───────────────────────┴────────────────────────────────┐  │
│  │  Fly Machines (Cloud Mode — on-demand per user)         │  │
│  │                                                         │  │
│  │  - Full Linux VM (Ubuntu 24.04)                         │  │
│  │  - Docker, git, node, python, go, rust, any CLI         │  │
│  │  - Boots in ~300ms-2s via Fly Machines API              │  │
│  │  - Stops on idle (15min timeout) — pay per second       │  │
│  │  - Persistent volume for project files                  │  │
│  │  - WebSocket bridge: browser terminal ↔ machine shell   │  │
│  │  - Pre-installed: node, python3, docker, git, wrangler, │  │
│  │    flyctl, gh, cargo, go                                │  │
│  │                                                         │  │
│  │  Cost: ~$0.007-0.028/hour depending on specs            │  │
│  │  Typical user (6hr/day, 22 days): $0.92-3.70/month      │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Executor (existing — assessment sandbox)                │  │
│  │  - Sandboxed code execution for challenges              │  │
│  │  - Separate from Cloud Mode machines                    │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### Runtime Abstraction Layer

The key architectural piece: a unified interface that both Browser Mode and Cloud Mode implement.

```typescript
interface RuntimeBackend {
  // Filesystem
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  listFiles(path?: string): Promise<FileEntry[]>;
  mkdir(path: string): Promise<void>;

  // Process execution
  spawn(command: string, args: string[]): Promise<ProcessHandle>;

  // Git
  clone(url: string, options?: { token?: string }): Promise<void>;
  commit(message: string): Promise<void>;
  push(options?: { token?: string }): Promise<void>;
  diff(): Promise<string>;
  status(): Promise<GitStatus>;

  // Lifecycle
  boot(): Promise<void>;
  shutdown(): Promise<void>;
  isReady(): boolean;
}
```

Browser Mode implements this via WebContainer + isomorphic-git.
Cloud Mode implements this via WebSocket RPC to the Fly Machine.

The IDE doesn't know or care which backend is active. Switch mid-session if needed (e.g., "this project needs Docker → upgrade to Cloud Mode").

---

## Browser Mode: WebContainer

WebContainer is StackBlitz's open-source tech. Full Node.js runtime running entirely in the browser via WebAssembly.

When a user opens a Browser Mode project:
- Node.js boots in their browser tab (~2 seconds)
- Real filesystem (in memory)
- Can run `npm install`, execute scripts, run dev servers
- xterm connects to a real shell inside it
- Close the tab → gone (unless saved to R2)

**Strengths:**
- Zero server cost per user
- Instant boot
- Works offline (with service worker caching)
- Perfect for assessments (zero per-candidate cost)

**Limitations:**
- JS/TS only
- No Docker
- No arbitrary CLIs
- Memory limited to browser tab (~1-4GB)

**What to port from old Next.js code:**
- `getWebContainer()`, `mountFiles()`, `writeFile()`, `readFile()`, `spawn()`
- `FileTree` + `buildFileTree()`
- Wire xterm to WebContainer shell

---

## Cloud Mode: Fly Machines

Fly Machines are VMs you start/stop via API. Pay per second of uptime. Boot in ~300ms-2s.

```
User opens Cloud Mode project
  → API call: POST /api/machines/start { userId, projectId }
  → Cloudflare Worker calls Fly Machines API
  → Machine boots in ~1s
  → WebSocket connects browser terminal ↔ machine shell
  → User has full Linux with Docker, git, node, python, etc.

User closes tab (or idle 15min)
  → Idle detection via WebSocket heartbeat
  → API call: machines stop
  → Machine stops, billing stops
  → Persistent volume retains files
```

### Cost per user

| Machine spec | $/hour | 132 hrs/month (6hr/day) | Use case |
|---|---|---|---|
| shared-cpu-1x, 1GB RAM | $0.007 | **$0.92/month** | Light: JS/TS, small projects |
| shared-cpu-2x, 2GB RAM | $0.014 | **$1.85/month** | Medium: larger projects, tests |
| shared-cpu-4x, 4GB RAM | $0.028 | **$3.70/month** | Heavy: Docker, monorepos |
| performance-2x, 4GB RAM | $0.057 | **$7.52/month** | Power: compilation, large builds |

Gitpod charges $25/month. Codespaces charges $18-36/month. Same class of machine, 5-10x the price.

### Machine image

One base Dockerfile, pre-installed with common tools:

```dockerfile
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y \
    git curl wget build-essential docker.io \
    python3 python3-pip python3-venv

# Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs

# Go, Rust (optional — can be installed on demand)
# RUN curl -fsSL https://go.dev/dl/go1.22.linux-amd64.tar.gz | tar -C /usr/local -xzf -
# RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# Dev CLIs
RUN npm install -g wrangler tsx
RUN curl -L https://fly.io/install.sh | sh
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg

# WebSocket bridge server (receives commands from browser)
COPY ws-bridge /usr/local/bin/ws-bridge

# User workspace
RUN useradd -m -s /bin/bash dev
USER dev
WORKDIR /home/dev/workspace
```

Users can also provide a `.ruwt.yml` (like `.gitpod.yml`) to customize their environment:

```yaml
image: node:22  # or custom Dockerfile
tasks:
  - npm install
ports:
  - 3000
  - 8080
```

### WebSocket bridge

A small server running on the Fly Machine that bridges browser ↔ machine:

- **Terminal stream**: xterm ↔ PTY on the machine (bidirectional)
- **File operations**: read/write/list/delete via JSON-RPC over WebSocket
- **Process management**: spawn, kill, get output
- **Port forwarding**: expose machine ports to browser (for dev servers, preview)

This is ~500 lines of code. Similar to what Gitpod's supervisor does, but minimal.

### Persistent volumes

Fly Machines support persistent volumes. User's project files survive machine stop/start.

```
Volume: /home/dev/workspace (per user, 5-10GB)
- Project files live here
- git repos cloned here
- node_modules cached here (fast restarts)
- Survives machine stop → start cycles
```

Cost: $0.15/GB/month. 5GB volume = $0.75/month per user.

---

## Stack Decisions

### Frontend: React + Vite (keep)

Don't switch frameworks. 135 components, 3,938 tests, 100% coverage exist. Rewriting burns months for zero user value.

### AI: BYOK + Workers AI Free Tier

**BYOK (Bring Your Own Key) — default for premium models:**
- User stores API keys in browser (localStorage, encrypted)
- Requests proxy through our edge for CORS, but we don't store keys server-side
- Supported: Anthropic, OpenAI, Groq, Mistral, Ollama (localhost)
- In Cloud Mode: Ollama can run on the machine itself for fully local AI
- We make $0 on these calls — and that's the point

**Free tier (Workers AI — our cost):**
- Llama 3.3 70B — general coding
- Qwen 2.5 Coder 32B — code-specific
- Mistral Small 3.1 24B — fast/cheap tasks
- Cost to us: ~$0.01-0.05 per conversation

### Codebase Context: Simple file-tree + grep (v1)

No embeddings or vector DB on day one. The existing `system-prompts.ts` pattern extends naturally.

**v1 context strategy:**
1. File tree listing (all filenames) — always included
2. Currently open file — always included
3. Recently edited files (last 3) — if token budget allows
4. grep results for user's query terms — on demand
5. `package.json` + `tsconfig.json` — always included (project metadata)
6. `@file` mention syntax — user references specific files in chat

**v2 (later):**
- Tree-sitter AST for symbol extraction
- Simple TF-IDF or BM25 over file contents
- Cloudflare Vectorize if embeddings needed

### Project Persistence

**Browser Mode:** R2 snapshots (tar → upload → download → mount)
**Cloud Mode:** Fly persistent volumes (files survive machine stop/start, no snapshot needed)

R2 still useful for Cloud Mode as backup/export, but not the primary storage.

### Git

**Browser Mode:** isomorphic-git (pure JS, in-browser, ~200KB)
**Cloud Mode:** real `git` binary on the machine (full featured, fast, handles large repos)

### One-Click Deploy (ship to anywhere)

User finishes their project. Clicks "Deploy." Picks a target:
- Cloudflare Pages (free tier) — using their own CF account
- Vercel (free tier)
- Netlify (free tier)
- GitHub Pages (free)
- Download zip and do whatever

Using their accounts. Not our hosting. Not our subdomain. Their domain, their infrastructure.

---

## New Dependencies

| Package | Purpose | Size | Mode |
|---------|---------|------|------|
| `isomorphic-git` | Git in browser | ~200KB gz | Browser only |
| `lightning-fs` | In-memory FS for isomorphic-git | ~20KB gz | Browser only |
| `fflate` | R2 project snapshot compression | ~30KB gz | Both |

Total new frontend bundle: ~250KB gz

**Cloud Mode server-side (ws-bridge on Fly Machine):**
- `ws` — WebSocket server (~20KB)
- `node-pty` — PTY for terminal (~native addon)
- Minimal: the bridge is ~500 lines

**Already installed:**
- `@webcontainer/api` — already in package.json
- `@monaco-editor/react` — already in package.json
- `@xterm/xterm` + `@xterm/addon-fit` — already in package.json
- `@anthropic-ai/sdk`, `@ai-sdk/openai` — already in package.json

---

## What NOT to Build (v1)

| Temptation | Why skip it |
|------------|-------------|
| VS Code extension API | Massive surface area, Cursor's moat |
| LSP integration | Monaco has built-in JS/TS intellisense — good enough |
| Desktop app (Electron/Tauri) | Browser-only is a feature: zero install, works on Chromebook |
| Self-hosted LLM inference | Workers AI does this at scale |
| Real-time collaboration | 6-month project by itself |
| Custom language servers | Monaco's TypeScript worker is surprisingly good |
| Embeddings / vector DB | File-tree + grep covers 80% of the value for v1 |

---

## Build Phases

### Phase 1: WebContainer + Multi-File IDE (4-6 weeks)

Port WebContainer back and extend Arena IDE for real projects:

- [ ] Runtime abstraction layer (`RuntimeBackend` interface)
- [ ] Browser Mode backend (WebContainer implementation)
- [ ] Port WebContainer wrapper → `src/lib/sandbox/webcontainer.ts`
- [ ] File tree sidebar component (React Native Web)
- [ ] Multi-file tabs in Monaco editor
- [ ] Wire xterm to WebContainer shell (real shell, not virtual TUI)
- [ ] File create/rename/delete in browser
- [ ] Auto-save to WebContainer filesystem on edit
- [ ] COOP/COEP headers on Cloudflare Pages (`_headers` file)

### Phase 2: Project Persistence via R2 (2-3 weeks)

- [ ] R2 bucket setup (`ruwt-projects`)
- [ ] `projects` table in D1
- [ ] Save project → compress → upload to R2
- [ ] Load project → download from R2 → mount in WebContainer
- [ ] Project list/dashboard screen
- [ ] Auto-save on interval (debounced, 30s)

### Phase 3: Git Integration (2-3 weeks)

- [ ] `isomorphic-git` integration with WebContainer filesystem
- [ ] Clone public repo → mount in WebContainer
- [ ] Clone private repo (user provides GitHub PAT)
- [ ] Commit, push from browser
- [ ] Git status + diff in sidebar
- [ ] `.gitignore` support

### Phase 4: Codebase-Aware AI (2-3 weeks)

- [ ] File tree context injection (all filenames → system prompt)
- [ ] Open file context (current + recent files)
- [ ] grep-based context (search project for relevant code)
- [ ] Multi-file diff application (AI edits multiple files in one response)
- [ ] `@file` mention syntax in chat

### Phase 5: BYOK + Pricing (2-3 weeks)

- [ ] BYOK key management UI (settings page)
- [ ] Proxy layer: route BYOK requests through edge (CORS)
- [ ] Key validation (test connection on save)
- [ ] Free tier: open-source models, 3 projects max, Browser Mode only
- [ ] Pro tier ($3-5/month): unlimited projects, BYOK, git push, deploy
- [ ] Usage dashboard (tokens used, cost breakdown per model)

### Phase 6: One-Click Deploy (1-2 weeks)

- [ ] Deploy to Cloudflare Pages (user's account via OAuth)
- [ ] Deploy to Vercel (via Vercel API + user's token)
- [ ] Deploy to Netlify (via Netlify API + user's token)
- [ ] Download as zip (always available)

### Phase 7: Take-Home Assessment Mode (3-4 weeks)

The killer feature: companies give candidates a real take-home, administered through the IDE, with full AI telemetry.

**How it works:**
1. Company creates assessment → provides a repo URL + instructions ("fix the auth bug in src/middleware.ts")
2. Candidate gets a link: `ruwt.dev/assessment/:id`
3. IDE opens with repo pre-cloned, instructions in sidebar, telemetry recording
4. Candidate codes, uses AI, runs tests, commits — all inside Ruwt
5. Candidate clicks "Submit" → company gets: code diff, AI cost, models used, token counts, time spent, AFI score, and optionally the full AI conversation history

**Why this matters:**
- Companies already give take-homes. They just lack telemetry on AI usage
- No challenge authoring needed — the repo IS the challenge
- A bad hire costs $50-100k. Telemetry that prevents one bad hire/year is worth $5,000+
- Every candidate spends 4-8 hours in the IDE → acquisition funnel for the free IDE

**Build tasks:**
- [ ] Take-home assessment creation flow (company provides repo URL + instructions + time limit)
- [ ] Assessment workspace: same IDE, repo pre-cloned, telemetry active, "Submit" button
- [ ] Telemetry recording: AI calls (model, tokens, cost), time tracking, file changes
- [ ] Candidate submission flow: generate diff, compute AFI, package results
- [ ] Company results dashboard: candidate list, per-candidate deep dive
- [ ] Session replay (optional): review candidate's AI conversation history
- [ ] Post-assessment: "Keep using this IDE — it's free" (convert candidate → IDE user)
- [ ] Assessment project auto-saves as candidate's personal project after submission

### Phase 8: Launch + B2B Outreach (ongoing, starts month 5)

- [ ] Public launch: Product Hunt, HN, Reddit, Twitter
- [ ] Landing page A/B test (B2B-first vs developer-first)
- [ ] B2B outreach: identify 50 target companies (eng teams that do take-homes)
- [ ] Cold outreach via LinkedIn, email, dev community Slack/Discord
- [ ] Offer 2-3 free beta take-home trials
- [ ] Collect feedback, iterate on telemetry/reporting
- [ ] Convert betas to paid plans
- [ ] Case study from first paying customer (social proof for next sales)

**Phases 1-8 total: ~18-22 weeks (~4-5 months) to MVP + first outreach**

Note: Phases 9-10 (Cloud Mode + dogfooding) are deferred. Not needed for the take-home assessment business. Can be built later if demand appears. This means launch-ready product in ~5 months, not 6-8.

---

### Phase 9: Cloud Mode — Fly Machines (3-4 weeks)

Full Linux VM per user. This is what makes 100% workflow coverage possible.

- [ ] Fly Machine base image (Dockerfile with common dev tools)
- [ ] Machine provisioning API (`/api/machines/start`, `/api/machines/stop`)
- [ ] WebSocket bridge server (terminal PTY + file ops + process management)
- [ ] Cloud Mode backend (implements `RuntimeBackend` via WebSocket RPC)
- [ ] Idle detection + auto-stop (15min timeout via heartbeat)
- [ ] Persistent volumes for project files (survive stop/start)
- [ ] Port forwarding (expose dev server ports to browser preview)
- [ ] `.ruwt.yml` custom environment config (optional)
- [ ] Machine spec selector (light/medium/heavy/power)
- [ ] Pro tier update: Cloud Mode included in $5/month plan

### Phase 10: Dogfooding (ongoing)

Move Ruwt IDE development into Ruwt IDE itself (Cloud Mode). This is not affected by the open-source decision — Cloud Mode is a full Linux VM regardless.

What works in Cloud Mode (same as discussed earlier):

| Task | Works? | How |
|---|---|---|
| Edit files across `dev/`, `executor/`, `social/` | Yes | Full filesystem on Fly Machine |
| Run `npx vitest run` (3,938 tests) | Yes | Real Node.js on real CPU |
| `flyctl deploy` | Yes | Pre-installed in machine image |
| `wrangler pages deploy` | Yes | Pre-installed in machine image |
| `docker build` | Yes | Docker on the Fly Machine |
| `git push` | Yes | Real git with SSH keys |
| AI chat with Claude | Yes | BYOK with Anthropic key |
| Full monorepo grep/search | Yes | Real filesystem, real tools |

The only thing you lose vs Claude Code: MCP servers (Google Sheets, Pencil, browser automation). Everything else works.

Build tasks:
- [ ] Clone ruwt monorepo into Cloud Mode machine
- [ ] Run full test suite
- [ ] Docker builds for executor
- [ ] Deploy commands (flyctl, wrangler)
- [ ] AI chat with BYOK Claude key for daily development
- [ ] Identify and fix every UX gap discovered through dogfooding
- [ ] Screen recordings of "building the tool with the tool" for marketing

**Phases 9-10: ~4-6 weeks additional — full Cloud Mode**

**Grand total: ~6-8 months from start to fully dogfoodable product**

---

## Revenue Model

Take-home assessments are the business. The IDE is the product and the acquisition channel.

| Stream | Price | Margin | Notes |
|--------|-------|--------|-------|
| **IDE Free tier** | $0 | Loss leader | Browser Mode, OSS AI, 3 projects. Costs ~$0.01-0.05/user/month |
| **IDE Pro tier** | $5/month | Low-medium | Cloud Mode, unlimited projects, BYOK, deploy, git push |
| **Take-home (monthly)** | $500/month | ~98% | Unlimited take-homes, full session replay, AI telemetry, AFI scoring |
| **Take-home (pay-per-use)** | $75/take-home | ~95% | Same features, billed per assessment |
| **Auto-billing** | whichever is less | | If $75 × take-homes < $500, charge per-use. Otherwise $500 flat. Customer never overpays. |
| **Challenge assessments** | included | | Existing pre-built challenges included in company plan |

**Pricing philosophy for companies:** One price. $500/month for everything, or $75/take-home if that's less. "We charge whichever costs you less." Zero friction. The company never has to pick a plan or worry about overages.

### Why take-home assessments are the core business

**Easier to sell than challenge assessments:**
- Companies already give take-homes — no behavior change needed
- Company provides their own repo and instructions — no challenge authoring
- "Add AI telemetry to the take-homes you already give" is a one-line pitch

**High pricing power:**
- A bad hire costs $50-100k
- If telemetry prevents one bad hire per year, it pays for itself 10x
- Per-assessment pricing ($75) is a trivial expense approval
- Monthly plans are cheap relative to recruiting agency fees ($15-25k per hire)

**Built-in acquisition funnel:**
```
Company buys take-home plan ($500/month)
  → Sends 20 candidates/month
  → Each candidate spends 4-8 hours in Ruwt IDE
  → ~10% come back for personal use (2 new IDE users/month, free)
  → Some IDE users get hired at companies that don't use Ruwt
  → Those companies see "assessed via ruwt.dev" on the candidate's profile
  → New company signs up for assessments
```

Each B2B customer generates ~2 IDE users/month with zero marketing spend.

### IDE pricing philosophy

The IDE is priced at cost, not for profit:
- Free tier costs us ~$0.11/user/month (WebContainer = no server compute)
- Pro tier at $5/month covers Cloud Mode compute (~$2.70 for heavy users, ~$0.63 blended)
- BYOK users cost us nearly nothing on AI
- IDE revenue is gravy, not the business

---

## Cost Structure (at scale)

### Browser Mode only (phases 1-8)

| Component | 1,000 DAU | 10,000 DAU |
|-----------|-----------|------------|
| Cloudflare (Pages, D1, R2) | ~$6/mo | ~$33/mo |
| Workers AI (free tier users) | ~$50/mo | ~$500/mo |
| Fly executor (assessments) | ~$15/mo | ~$50/mo |
| **Total** | **~$70/mo** | **~$580/mo** |

### With Cloud Mode (phases 9-10)

| Component | 1,000 DAU | 10,000 DAU |
|-----------|-----------|------------|
| Cloudflare (Pages, D1, R2) | ~$6/mo | ~$33/mo |
| Workers AI (free tier users) | ~$50/mo | ~$500/mo |
| Fly Machines (Cloud Mode, ~20% of users) | ~$370/mo | ~$3,700/mo |
| Fly persistent volumes | ~$150/mo | ~$1,500/mo |
| Fly executor (assessments) | ~$15/mo | ~$50/mo |
| **Total** | **~$590/mo** | **~$5,780/mo** |

### Revenue projections (B2B-driven model)

Assessment revenue drives the business. IDE revenue is secondary.

#### Assumptions

- Each assessment customer sends ~15 candidates/month on average
- ~10% of candidates return as IDE users (~1.5/company/month, cumulative over time)
- ~5% of returning IDE users eventually go Pro ($5/month)
- Candidates use Browser Mode during assessments (zero compute cost to us)
- Assessment infrastructure cost: ~$0.05 per candidate (WebContainer + AI for hints = pennies)
- B2B churn: ~5%/month early on (some companies hire in bursts, not continuously)

#### Year 1 detailed (building months 1-5, selling months 6-12)

| Month | B2B customers | Candidates/month | Assessment MRR | Cumulative IDE users | IDE Pro users | IDE MRR | **Total MRR** | Infra cost | **Net profit** |
|---|---|---|---|---|---|---|---|---|---|
| 1-5 | 0 | 0 | $0 | 27 | 0 | $0 | **$0** | ~$10 | **-$10** |
| 6 | 0 | 0 | $0 | 27 | 0 | $0 | **$0** | ~$10 | **-$10** |
| 7 | 1 (free beta) | 15 | $0 | 29 | 0 | $0 | **$0** | ~$15 | **-$15** |
| 8 | 2 (1 free, 1 paid) | 30 | $500 | 32 | 0 | $0 | **$500** | ~$20 | **$480** |
| 9 | 3 (1 free, 2 paid) | 45 | $1,000 | 37 | 1 | $5 | **$1,005** | ~$25 | **$980** |
| 10 | 3 (all paid) | 45 | $1,500 | 43 | 2 | $10 | **$1,510** | ~$30 | **$1,480** |
| 11 | 4 | 60 | $2,000 | 49 | 2 | $10 | **$2,010** | ~$35 | **$1,975** |
| 12 | 5 | 75 | $2,500 | 57 | 3 | $15 | **$2,515** | ~$40 | **$2,475** |

**End of Year 1: ~$2,500 MRR, 5 B2B customers, ~57 IDE users, ~$2,475/month net**

#### Year 2 detailed (months 13-24)

| Month | B2B customers | Candidates/month | Assessment MRR | Cumulative IDE users | IDE Pro users | IDE MRR | **Total MRR** | Infra cost | **Net profit** |
|---|---|---|---|---|---|---|---|---|---|
| 13 | 6 | 90 | $3,000 | 66 | 3 | $15 | **$3,015** | ~$50 | **$2,965** |
| 14 | 7 | 105 | $3,500 | 77 | 4 | $20 | **$3,520** | ~$55 | **$3,465** |
| 15 | 8 | 120 | $4,000 | 89 | 4 | $20 | **$4,020** | ~$65 | **$3,955** |
| 16 | 9 | 135 | $4,500 | 102 | 5 | $25 | **$4,525** | ~$70 | **$4,455** |
| 17 | 10 | 150 | $5,000 | 117 | 6 | $30 | **$5,030** | ~$80 | **$4,950** |
| 18 | 12 | 180 | $6,000 | 135 | 7 | $35 | **$6,035** | ~$90 | **$5,945** |
| 19 | 14 | 210 | $7,000 | 156 | 8 | $40 | **$7,040** | ~$105 | **$6,935** |
| 20 | 16 | 240 | $8,000 | 180 | 9 | $45 | **$8,045** | ~$120 | **$7,925** |
| 21 | 18 | 270 | $9,000 | 207 | 10 | $50 | **$9,050** | ~$135 | **$8,915** |
| 22 | 20 | 300 | $10,000 | 237 | 12 | $60 | **$10,060** | ~$150 | **$9,910** |
| 23 | 22 | 330 | $11,000 | 270 | 14 | $70 | **$11,070** | ~$165 | **$10,905** |
| 24 | 25 | 375 | $12,500 | 308 | 15 | $75 | **$12,575** | ~$185 | **$12,390** |

**End of Year 2: ~$12,500 MRR, 25 B2B customers, ~308 IDE users, ~$12,390/month net**

#### Key observations

- **Month 14**: Crosses $3,500 MRR — enough to cover basic living expenses in a low-cost area
- **Month 18**: Crosses $6,000 MRR — comfortable solo founder income
- **Month 22**: Crosses $10k MRR — sustainable business
- **Month 24**: $12,500 MRR — solid solo founder business
- **Infra costs stay tiny**: ~$185/month at 25 customers because candidates use Browser Mode (zero compute)
- **Gross margin**: ~98% on assessment revenue (almost pure software margin)
- **IDE revenue is negligible**: $75/month at month 24 — confirms IDE is distribution, not the business
- **B2B customer growth assumes**: 1-2 new customers/month, with slight acceleration as referrals kick in around month 18

#### To reach $10k MRR

Need ~20 assessment customers at $500/month. That's:
- Not 26,000 DAU
- Not viral GitHub stars
- Just 20 engineering teams that do take-home assignments and want AI telemetry
- Tractable via cold outreach + referrals over ~22 months

#### What if growth is faster or slower?

| Scenario | Month to $10k MRR | B2B customers needed |
|---|---|---|
| Pessimistic (0.5 new customers/month) | Month 30+ (beyond runway) | Never reaches 25 |
| Base case (1-2/month, accelerating) | Month 24 | 25 |
| Optimistic (2-3/month, early referrals) | Month 18 | 25 |
| Breakout (inbound demand, viral case study) | Month 14-15 | 25 |

---

## Competitive Positioning

### As a developer tool

```
                    High price ($100+/mo)
                        │
            Cursor ●    │    ● Claude Code
                        │
    Complex ────────────┼──────────────── Simple
    (local install,     │                (browser, no setup)
     extensions, LSP)   │
                        │
   Gitpod/Codespaces ● │    ● Bolt/Lovable ($20-40)
               Replit ● │
                        │    ★ Ruwt IDE ($0-5)
                        │
                    Low price / free
```

### As a hiring/assessment tool

```
                    No AI telemetry
                        │
         HackerRank ●   │   ● CoderPad
          Codility ●    │
                        │
   Puzzles ─────────────┼──────────────── Real codebases
   (contrived           │                (company's actual repo)
    algorithms)         │
                        │
                        │   ★ Ruwt Take-Homes
                        │
                    Full AI telemetry
```

**Nobody else occupies the "real codebase + AI telemetry" quadrant.** That's the actual moat.

---

## What This Breaks

| Competitor | Their model | What we break |
|---|---|---|
| **HackerRank** | Contrived puzzles, no AI telemetry | Real take-homes on real repos, full AI usage tracking |
| **Codility** | Timed algorithm tests | Real-world coding with AI, AFI scoring |
| **CoderPad** | Live coding interviews, no AI allowed | AI-allowed take-homes with telemetry (measures AI fluency, not just coding) |
| **Cursor** | $20-40/mo, local install | Browser-based, BYOK, free tier |
| **Bolt/Lovable** | Vendor lock-in, non-coders | Own your code, real dev workflow |
| **Replit** | $25-40/mo, server containers | Free Browser Mode, $5 Cloud Mode |
| **Gitpod/Codespaces** | $18-36/mo | Cloud Mode at $5/mo, same class of machine |

Through-line for devs: **cheaper, simpler, no lock-in.**
Through-line for hiring: **the only tool that measures how candidates use AI on real work.**

---

## One-Line Pitch

**For developers:** "AI coding in your browser. Your code, your keys. Free to start, $5/month for everything."

**For hiring teams:** "Give real take-homes. See exactly how candidates use AI. AFI score included."

---

## Pricing Deep Dive

### Why $5/month for everything (including Cloud Mode)

The original plan was $3-5/month even before Cloud Mode existed — just for the platform (R2 storage, unlimited projects, BYOK proxy, deploy). Browser Mode Pro users cost ~$0.11/month, so $5 was almost pure margin.

Adding Cloud Mode to the same $5 plan changes the margin picture:

| | Browser Mode Pro user | Cloud Mode Pro user | Blended (80/20 split) |
|---|---|---|---|
| Compute cost | $0.00 | $1.85 | $0.37 |
| Storage cost | $0.01 (R2) | $0.75 (Fly volume) | $0.16 |
| AI cost (free tier) | $0.10 | $0.10 | $0.10 |
| **Total cost** | **$0.11** | **$2.70** | **$0.63** |
| Revenue | $5.00 | $5.00 | $5.00 |
| **Gross margin** | **$4.89 (98%)** | **$2.30 (46%)** | **$4.37 (87%)** |

The blended margin stays healthy because most users won't use Cloud Mode, and most Cloud Mode users won't code 6 hours/day. The $2.70 figure assumes a power user. Average Cloud Mode usage is likely $0.30-1.00/month.

**Keep it simple: one price, everything included.** "$5/month gets you everything" is itself a differentiator. No tiers, no meters, no surprise bills. If costs get out of hand later, add a usage cap (e.g., "100 Cloud hours/month included").

### What if B2B sales are slow? (IDE-only fallback)

If assessment sales don't materialize, the IDE alone at $5/month needs massive scale:

| DAU | 10% conversion | Paying users | MRR | Gross profit |
|---|---|---|---|---|
| 1,000 | 100 | $500 | $380 |
| 5,000 | 500 | $2,500 | $1,900 |
| 10,000 | 1,000 | $5,000 | $3,800 |
| 25,000 | 2,500 | $12,500 | $9,500 |

To sustain a solo founder on IDE alone: ~26,000 DAU at $5/month, or ~12,000 DAU at $12/month.

**Fallback options if B2B fails:**
1. Open source the IDE to drive organic adoption (deferred lever)
2. Raise price to $12/month (still cheaper than all competitors)
3. Add usage-based Cloud pricing ($0.02/hour overage)
4. Pivot fully to developer tool, abandon assessment angle

Decision point: month 8-10 based on sales pipeline data.

---

## Realistic Growth Projections

### Current state (as of March 2026)

Production database (ruwt.dev assessment platform):
- **27 total signups** (23 in Feb 2026, 4 in March)
- **19 users** attempted at least one challenge (70% activation)
- **14 users** solved at least one challenge (52% solve rate)
- **210 total attempts**, 71 passed (34% pass rate)
- **No marketing** has been done — all organic/direct
- **0 B2B customers** (assessment org features built but not sold)

Key takeaway: strong engagement (70% activation, 52% solve) but zero distribution. The product works. The funnel doesn't exist yet.

### B2B growth projections (take-home assessments)

B2B sales cycle for a solo founder doing outbound:
- Cold outreach → demo → trial → paid: 4-8 week cycle
- Conversion rate on cold outreach: ~2-5% to demo, ~25-50% demo to paid
- Solo founder can realistically do 20-30 outreach messages/week
- That's ~1-3 demos/month, ~1 new customer every 1-2 months early on

| Month | Event | New B2B customers | Total customers | Assessment MRR | IDE users (from candidates) |
|---|---|---|---|---|---|
| 1-5 | Building (nights/weekends) | 0 | 0 | $0 | 27 (existing) |
| 6 | MVP launch + first outreach | 0 | 0 | $0 | 27 |
| 7-8 | Beta customers (free/discounted) | 1-2 (free) | 1-2 | $0 | ~60 |
| 9-10 | First paying customers | 1-2 | 2-3 | $600-1,200 | ~120 |
| 11-12 | Steady outreach + referrals | 1-2 | 3-5 | $1,200-2,000 | ~200 |
| 13-18 | Compounding (referrals, word of mouth) | 1-2/month | 8-15 | $3,200-6,000 | ~500 |
| 19-24 | Established, inbound starts | 2-3/month | 15-25 | $6,000-10,000 | ~1,000 |

### Scenario analysis (end of Year 2, combined revenue)

| Scenario | Probability | B2B customers | Assessment MRR | IDE MRR | **Total MRR** | **Monthly net** |
|---|---|---|---|---|---|---|
| B2B sales fail | 25% | 0-2 | $0-1,000 | <$20 | **<$1,020** | **<$1,000** |
| Slow growth | 30% | 5-10 | $2,500-5,000 | $20-50 | **$2,520-5,050** | **$2,400-4,900** |
| Base case | 25% | 15-25 | $7,500-12,500 | $50-75 | **$7,550-12,575** | **$7,300-12,200** |
| Strong PMF | 15% | 25-40 | $12,500-20,000 | $75-150 | **$12,575-20,150** | **$12,200-19,500** |
| Breakout | 5% | 50+ | $25,000+ | $200+ | **$25,200+** | **$24,500+** |

**Probability-weighted expected MRR after 2 years: ~$5,500-7,500/month**

~45% chance of reaching $7,000+ MRR (base case or better). ~20% chance of reaching $12k+ MRR.

### Why B2B changes the math vs IDE-only

| Path | What you need for $10k MRR | Probability in 2 years |
|---|---|---|
| IDE only at $5/month | ~26,000 DAU (2,600 paying users) | ~5% |
| B2B take-homes at $500/month | ~20 companies | ~20% |
| Combined (B2B + IDE organic) | ~15 companies + some IDE Pro users | ~25% |

20 companies is hard but tractable via outbound sales. 26,000 DAU without funding is near-impossible. B2B is the path.

### Comparable B2B dev tool growth (solo/small team)

| Company | Product | Time to $10k MRR | How |
|---|---|---|---|
| Lemon Squeezy | Payment platform | ~12 months | Solo founder, developer community |
| Plausible | Analytics | ~18 months | 2-person team, privacy angle |
| Cal.com | Scheduling | ~8 months | Open source + YC |
| Typesense | Search | ~24 months | Small team, slow B2B grind |

Solo-founder B2B SaaS reaching $10k MRR in 18-24 months is uncommon but not unprecedented. The key variable is whether engineering managers actually want AI telemetry on take-homes — that's what the beta period (months 7-9) validates.

---

## Go/No-Go Decision Framework

### Verdict: Build it on the side. Don't quit your job yet.

The entire assessment platform (135 components, 3,938 tests, 56 migrations, 50+ tables) was built while employed. The builder can clearly ship at night. The first 5 months are building anyway (phases 1-8) — no need to be full-time.

### The plan

1. **Now → month 5**: Build phases 1-7 (nights and weekends) — IDE + take-home assessment mode
2. **Month 5-6**: Start B2B outreach while still building. Target: 2-3 beta companies (free) to validate take-home telemetry
3. **Month 6-8**: Convert betas to paid. Continue outreach. Launch IDE publicly (Product Hunt, HN, Reddit)
4. **Month 8-10**: Watch the B2B numbers

### Quit signals (if you see these by month 8-10, quit)

- 3+ paying B2B customers (any plan)
- $1,000+ MRR from assessments alone
- Inbound interest from companies you didn't cold-contact
- Pipeline of 5+ companies in demo/trial stage
- Candidates converting to IDE users without prompting

### Stay signals (keep building on the side)

- 0 paying customers after 3 months of outreach
- Every demo ends with "interesting but not now"
- No candidate-to-IDE-user conversion
- Companies say "we'd use this if [feature that's 6+ months away]"

### Why B2B changes the quit calculus

With IDE-only, you needed viral organic growth to justify quitting — something you can't control or predict. With B2B take-homes, the signal is **sales pipeline**, which is:
- Measurable (demos booked, trials started, revenue)
- Controllable (you can do more outreach)
- Fast feedback (4-8 week sales cycle, not 12-month organic compounding)

You can validate B2B demand in 3-4 months of part-time outreach. If 3 out of 30 companies you contact want to pay, you have product-market fit signal. If 0 out of 30 want to pay, you saved yourself from quitting.

### Why this is the right call

- 2 years of runway sounds long until you're 18 months in with $300 MRR
- Building the same product while employed costs nothing but time
- B2B gives you faster signal than organic growth — you'll know by month 8-10
- You'll make a better quit decision with real sales data than with projections
- If it works, you'll still have 14-16 months of runway when you quit
- If it doesn't, you kept your salary and can pivot the approach

### Open-source as a fallback lever

Open source is not the core strategy, but it's available as a fallback:
- If B2B sales are slow but developers like the IDE → open source it to drive organic adoption
- If B2B works → keep it proprietary, no need to give away the code
- You can always open source later. You can't un-open-source.

Decision on open source deferred until month 8-10 based on which growth channel is working.

---

## Website Integration: One Product, One Domain

Everything lives on `ruwt.dev`. The IDE, the challenges, the take-home assessments — they're all the same app, same editor, different modes. **The integration is additive — existing routes, screens, and flows don't change.** New features plug in alongside.

### How close we already are

The current product has ~80% of the assessment infrastructure built:
- AssessmentBuilder (`/assessments/build/:id`) — org creates assessments, picks challenges, sets branding
- Invite flow — token-based invite links, bulk generation
- Candidate flow — AssessmentLandingScreen → AssessmentFlowScreen → results
- Results — AFI radar chart, cost breakdown, per-candidate deep dive
- Org management — members, roles, subscriptions, trial status
- Teams pitch page (`/hiring`) — comparison table vs HackerRank/Codility, demo form

**Take-home mode is an extension of what exists, not a rebuild.** The main new pieces: WebContainer file tree + multi-file editor (Phase 1), repo cloning, and telemetry recording.

### What changes for take-home mode

The existing AssessmentBuilder gets a mode toggle:

```
[Challenge-Based]  [Take-Home]
```

Challenge-Based is today's flow (pick challenges from library). Take-Home is new:
- Company enters a git repo URL (public, or private + access token)
- Company writes instructions in markdown
- Company sets time limit (optional: 24h, 48h, 72h, or untimed)
- Company chooses which AI models are available

The candidate experience changes from sequential challenges to a full IDE workspace:
- Candidate clicks invite → landing page shows repo name + instructions (not challenge list)
- Clicks Start → IDE opens with repo pre-cloned into WebContainer
- File tree, multi-file Monaco tabs, terminal, AI chat
- Telemetry recording in background (every AI call: model, tokens, cost, prompt, response)
- "Submit" button → company gets: git diff, AI usage timeline, AFI score, conversation replay

Database changes (minimal — extend existing tables):
```sql
ALTER TABLE assessments ADD COLUMN type TEXT DEFAULT 'challenge_based';
-- values: 'challenge_based' (existing) or 'take_home' (new)
ALTER TABLE assessments ADD COLUMN repo_url TEXT;
ALTER TABLE assessments ADD COLUMN repo_token TEXT; -- encrypted, private repos
ALTER TABLE assessments ADD COLUMN instructions TEXT;
ALTER TABLE assessments ADD COLUMN allowed_models TEXT; -- JSON array
```

### URL Structure

```
EXISTING (unchanged):
  /                              → Landing (logged out) or Dashboard (logged in)
  /login, /register, /callback   → Auth (unchanged)
  /dashboard                     → User dashboard (add "My Projects" section)
  /problems                      → Challenge browser (unchanged)
  /arena/:challengeId            → Challenge IDE (unchanged)
  /leaderboard                   → Rankings (unchanged)
  /hiring                        → Teams pitch page (add take-home section)
  /assessments/build/:id         → Assessment builder (add take-home mode toggle)
  /assess/:token                 → Candidate invite landing (adapt for take-home)
  /assess/session/:sessionId     → Challenge-based assessment flow (unchanged)
  /results/:shareToken           → Candidate results (extend for take-home diffs)
  /u/:username                   → Public profile (unchanged)
  /settings                      → Settings (add BYOK key management tab)

NEW (all under /ide):
  /ide                           → IDE landing / project list
  /ide/new                       → New project (blank, template, or clone URL)
  /ide/:projectId                → IDE workspace (personal projects)
  /ide/takehome/:sessionId       → Take-home IDE workspace (repo pre-cloned, telemetry)
```

### The Mental Model

One editor, three modes:

| Mode | Entry point | What's different |
|---|---|---|
| **Project Mode** | `/ide/:projectId` | User's own project. Full freedom. No constraints. |
| **Challenge Mode** | `/arena/:challengeId` | Pre-built challenge. Cost/time constraints. Test runner. AFI scoring. (Existing.) |
| **Take-Home Mode** | `/ide/takehome/:sessionId` | Company's repo. Instructions in sidebar. Telemetry recording. Submit button. |

Same Monaco editor, same AI chat, same terminal, same diff applier in all three. The only differences are: where the code comes from, what constraints exist, and what happens when you're done.

### The GitHub analogy

This mirrors GitHub's business model:
- **Companies pay** for assessments (like GitHub Teams/Enterprise)
- **Individuals use the IDE for free** (like free GitHub repos)
- **Free individual usage makes the platform valuable** to the companies paying for it
- GitHub doesn't advertise "free git hosting" — they advertise enterprise features. But the free tier is obviously there and millions use it.

Same here. Assessment revenue is the business you sell. The IDE is the product everyone uses. Developers who discover the IDE through take-homes (or organically) can use it for personal projects — you just don't spend marketing dollars acquiring them.

### Code Organization

```
dev/src/
  features/
    shared-ide/         ← EXTRACT from arena/: Monaco, AI chat, terminal,
                          diff applier, file tree, mode selector
    arena/              ← Challenge Mode (existing, imports from shared-ide/)
    projects/           ← NEW: Project Mode (project list, project settings)
    editor/             ← NEW: Project IDE workspace (imports from shared-ide/)
    assessments/        ← EXTEND: Take-Home Mode (add take-home workspace,
                          telemetry recording, submission, diff view)
```

The refactor is mostly extracting shared IDE components out of `arena/` into `shared-ide/`, then importing them in all three modes. The assessment infrastructure (builder, invites, results, org management) already exists — take-home mode extends it.

### Cloud Mode is deferrable

For the take-home assessment business, Cloud Mode (phases 9-10) is not needed:
- Candidates do take-homes in Browser Mode (WebContainer, free, JS/TS)
- The IDE free tier runs in Browser Mode
- Cloud Mode only matters for power users who want Docker, Python, Go, etc.

Cloud Mode can be pushed back indefinitely until either:
- Companies ask for take-homes in non-JS languages (Python, Go, Rust)
- Developers explicitly request full-environment IDE features
- You want to dogfood by building ruwt in ruwt

This saves 4-6 weeks of build time that can go toward sales outreach instead.

### Landing Page

Two possible lead angles depending on which audience converts better. A/B test after launch.

**Lead with hiring (B2B-first):**
```
Hero:     "See how your candidates actually use AI."
Sub:      "Real take-homes. Real codebases. Full AI telemetry. AFI scoring."
CTA:      [Set Up a Take-Home] → /teams

Section:  "Powered by a real IDE"
Sub:      "Candidates code in a browser-based IDE with AI assistance.
           You see every model they chose, every token they spent, every minute."
CTA:      [Try the IDE] → /editor/new

Section:  "Or use it to sharpen your own skills"
Sub:      "60+ AI coding challenges. Earn your AFI score."
CTA:      [Browse Challenges] → /challenges
```

**Lead with IDE (developer-first):**
```
Hero:     "AI coding in your browser."
Sub:      "Your code. Your keys. Free to start, $5/month for everything."
CTA:      [Start Coding] → /editor/new

Section:  "For hiring teams"
Sub:      "Give real take-homes. See exactly how candidates use AI."
CTA:      [Set Up a Take-Home] → /teams

Section:  "Prove your skills"
Sub:      "60+ AI challenges. Earn your AFI score. Get discovered by employers."
CTA:      [Browse Challenges] → /challenges
```

Start with B2B-first (that's where the money is). Switch if developer organic growth outpaces B2B sales.

### Dashboard (logged-in user)

```
┌─────────────────────────────────────────────────┐
│  ruwt.dev Dashboard                    [New +]  │
├─────────────────────────────────────────────────┤
│                                                  │
│  My Projects          My Challenges              │
│  ┌──────────────┐     ┌──────────────┐          │
│  │ ruwt-api     │     │ 14 solved    │          │
│  │ Last: 2h ago │     │ AFI: 720     │          │
│  ├──────────────┤     │ Streak: 5d   │          │
│  │ portfolio    │     └──────────────┘          │
│  │ Last: 3d ago │                                │
│  ├──────────────┤     Pending Take-Homes         │
│  │ side-project │     ┌──────────────┐          │
│  │ Last: 1w ago │     │ Acme Corp    │          │
│  └──────────────┘     │ Due: 48h     │          │
│                       │ [Start →]    │          │
│                       └──────────────┘          │
└─────────────────────────────────────────────────┘
```

Projects, challenges, and pending take-home assessments all in one view. The user doesn't think of these as different products — it's all just "my coding stuff."

---

## Open Questions (for future discussion)

### Product
- [ ] Should the IDE be a separate repo or stay in the ruwt monorepo?
- [ ] WebContainer licensing — any restrictions on commercial use?
- [ ] Offline mode via service worker — how much effort, how much value?
- [ ] Community challenges as content engine — user-created challenges, embeddable in blogs?
- [ ] Mobile support — WebContainer on iPad? Cloud Mode via tablet browser?
- [ ] Team/org features for the IDE itself (shared Cloud Machines, pair programming)?
- [ ] Could Cloud Mode machines be pooled/shared to reduce idle cost further?
- [ ] MCP server support in Cloud Mode (run MCP servers on the Fly Machine)?

### Business
- [ ] At what price point does the IDE become independently sustainable? ($5 vs $12 vs usage-based)
- [ ] Could YC or similar accelerator change the growth trajectory enough to justify quitting earlier?
- [ ] Open source as fallback: if B2B is slow by month 8, open source to drive organic adoption?
- [ ] Partnership angle: could we integrate with existing ATS (Greenhouse, Lever, Ashby) to reduce friction?
- [ ] Content marketing: "State of AI Fluency" report using anonymized assessment data?
- [ ] Who exactly is the buyer? Engineering manager? VP Eng? Recruiting? (Determines outreach strategy)
- [ ] What's the ICP (ideal customer profile)? Company size, hiring volume, tech stack?
