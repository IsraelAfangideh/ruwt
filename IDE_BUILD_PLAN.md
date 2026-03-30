# Ruwt IDE — Implementation Plan

This document is the step-by-step build plan for adding IDE capabilities to ruwt.dev.
Read `TECH_STACK.md` for full strategy, architecture, and financial context.
Read `RUNTIME.md` for the browser runtime architecture that replaced WebContainer.

## Current State

- ruwt.dev is a live assessment platform with 27 users, 44 challenges, and a full Arena IDE
- The Arena IDE (`/arena/:challengeId`) has: Monaco editor, AI chat (SSE streaming), xterm terminal, diff applier, cost tracking
- Assessment infrastructure exists: AssessmentBuilder, invite flow, candidate flow, results dashboard, org management
- **Ruwt Runtime** (`src/lib/runtime/`) replaces WebContainer — esbuild-wasm + QuickJS + VirtualFS, zero server cost
- IDE at `/ide/new` is live with file tree, multi-file tabs, terminal with `node`/`npm`/`npx` commands

## Goal

Add three new capabilities to the existing app:
1. **Project Mode** (`/ide/:projectId`) — developers use the IDE for their own projects
2. **Take-Home Mode** (`/ide/takehome/:sessionId`) — companies provide a repo, candidates code with AI telemetry
3. **Project Persistence** — save/load projects via Cloudflare R2

All existing functionality (challenges, arena, assessments, leaderboard) stays untouched.

## Architecture Principle

One editor, three modes. Shared components extracted from `arena/` into `shared-ide/`:

```
dev/src/features/
  shared-ide/         ← Monaco, AI chat, terminal, diff applier, file tree
  arena/              ← Challenge Mode (existing, imports from shared-ide/)
  projects/           ← Project Mode (new)
  editor/             ← IDE workspace (new)
  assessments/        ← Take-Home Mode (extend existing)
```

## Implementation Steps

Each step is designed to be completable in 1-3 Claude Code sessions. Each produces a working commit. Each maintains all existing tests passing.

---

### Step 1: Extract shared-ide components from arena/ ✅ COMPLETE

**Branch:** `feat/ide-shared-components`

**Completed.** 53 files changed. Components moved to `features/shared-ide/`:
- UI: ChatMarkdown, CollapsedSidebar, ModeSelector, PanelResizeBar, PlanApproval, Notepad, VirtualFileSystem, VirtualShell
- Hooks: useAIChat (attemptId→sessionId), useIDELayout (renamed from useArenaLayout), useEditorDecorations, useCodeSync
- Lib: diff-apply, code-apply, apply-model, tool-parser, line-diff, monaco-init
- New: ai-types.ts (extracted shared types from system-prompts.ts)

---

### Step 2: Add /ide route with basic editor ✅ COMPLETE

**Completed.** Created:
- `features/ide/ProjectListScreen.tsx` — `/ide` route with empty state, "New Project" button
- `features/ide/IDEScreen.tsx` — `/ide/new` route with Monaco editor, file tree, terminal
- Navigation wired up in types.ts, linking.ts, AppNavigator.tsx

---

### Step 3: Ruwt Runtime (browser-native JS runtime) ✅ COMPLETE

**Originally:** WebContainer wrapper. **Replaced with:** self-built browser runtime.

WebContainer (StackBlitz) required a paid license. Built a replacement from open-source components:

**New modules (`src/lib/runtime/`):**
- `esbuild-bridge.ts` — in-browser TS/JSX bundling via esbuild-wasm
- `quickjs-engine.ts` — JS execution via QuickJS WASM with Node.js polyfills
- `node-polyfills.ts` — fs, path, events, buffer, process, os, crypto (pure-JS SHA-256)
- `npm-client.ts` — browser-based package manager (resolve, fetch, extract from npm registry)
- `tar.ts` — minimal tar archive parser for npm tarballs
- `sw-handler.ts` + `dev-server.ts` — Service Worker dev preview with Cache API
- `persistence.ts` — IndexedDB package cache + OPFS filesystem persistence
- `constants.ts` — shared HOME_DIR/NODE_MODULES_DIR constants

**New backend (`src/lib/sandbox/`):**
- `ruwt-backend.ts` — implements `RuntimeBackend` interface (drop-in for `BrowserBackend`)

**Extended:**
- `VirtualShell.ts` — added `node`, `npm`, `npx` commands via `RuntimeCallbacks`

**260+ new tests, all passing. See `RUNTIME.md` for full architecture.**

---

### Step 4: Wire runtime to IDE ✅ COMPLETE

**Completed.** Created:
- `features/ide/useRuntime.ts` — replaces `useWebContainer.ts`, same API + `backend` prop
- IDEScreen updated: imports `useRuntime` instead of `useWebContainer`, uses `backend.readFile/writeFile`
- IDETerminal updated: accepts `backend` prop, uses `backend.connectTerminal()` instead of `spawnWithInput('jsh')`
- esbuild.wasm served from `public/` (self-hosted, no CDN dependency)

**The IDE at `ruwt.dev/ide/new` is live and functional:**
- File tree sidebar with index.js, package.json, solution.js
- Multi-file tabs in Monaco editor
- Terminal with `ls`, `node index.js`, `npm install`, and all shell commands
- Project persistence via R2 (save/load)

---

### Step 5: R2 project persistence ✅ COMPLETE

**Completed.** Created:
- D1 migration 0057: projects table
- R2 binding PROJECTS_BUCKET in wrangler.toml, env.d.ts updated
- API: GET/POST /api/projects, GET/PUT/DELETE /api/projects/:id, GET /api/projects/:id/files
- Client: useRuntime saveProject/loadProject + auto-save (30s), save status indicator
- ProjectListScreen: real project list from API with delete
- IDEScreen: load on mount, save button, /ide/:projectId route

---

### Step 6: Take-home assessment mode ✅ COMPLETE

**Completed.** Created:
- D1 migration 0058: assessment type/repo_url/instructions/allowed_models columns + assessment_telemetry table
- API: POST /api/assess/takehome/start, /telemetry, /submit + GET /api/assessments/:id/takehome
- TakeHomeScreen at /ide/takehome/:sessionId: instructions sidebar, timer, fire-and-forget telemetry, submit flow
- Atomic SQL increments for telemetry cost tracking (race-safe)
- Shared IDE utils extracted (tabLabel, languageForPath)

---

### Step 6.5: Full Session Replay Telemetry ← NEXT

**Branch:** `feat/ide-session-replay`

**What:** Upgrade take-home telemetry from basic event logging to full session replay. This is the core value proposition — "everyone's doing vibe coding, we're the only platform that lets you see how."

**The pitch:** Companies don't just get a summary. They get a timeline-scrubbing replay of everything the candidate did: every keystroke (via content snapshots), every AI prompt and response (full text), every terminal command, every file switch, every test run.

**What to capture (expand existing telemetry):**

| Event type | Data | Capture method |
|---|---|---|
| `content_snapshot` | `{ path, content, cursorLine }` | Every 5 seconds for active file (debounced) |
| `ai_prompt` | `{ model, fullPrompt, timestamp }` | On each AI message send (full text, not preview) |
| `ai_response` | `{ model, fullResponse, tokens, cost, timestamp }` | On each AI response complete |
| `terminal_command` | `{ input, output, exitCode, timestamp }` | On each command completion in terminal |
| `file_open` | `{ path, timestamp }` | On file tab open |
| `file_close` | `{ path, timestamp }` | On file tab close |
| `tab_switch` | `{ fromPath, toPath, timestamp }` | On tab change |
| `test_run` | `{ command, passed, failed, output, timestamp }` | On test execution |
| `focus_change` | `{ focused, timestamp }` | On window focus/blur (detect idle) |

**Candidate disclosure:** Assessment landing page must clearly state: "This assessment records your coding activity including keystrokes, AI usage, terminal commands, and file changes. Your employer will be able to review a full replay of your session."

**Tasks:**
- [ ] D1 migration 0059: expand assessment_telemetry or create session_events table (high-volume, consider R2 for raw data)
- [ ] Update TakeHomeScreen to record all event types above
- [ ] Content snapshot: debounced 5-second interval for active file, store in R2 (not D1 — too much data)
- [ ] Full AI conversation capture: store complete prompt + response text (not just preview)
- [ ] Terminal command capture: hook into xterm output, parse command boundaries
- [ ] Focus tracking: window focus/blur events
- [ ] Candidate disclosure: add telemetry notice to assessment landing page
- [ ] Session replay API: GET /api/assessments/:id/sessions/:sessionId/replay — returns ordered event stream
- [ ] Session replay component: timeline scrubber, file state at any point, AI conversation sidebar
- [ ] Company dashboard update: add "Watch Replay" button per candidate

**Data storage strategy:**
- High-frequency events (content snapshots, terminal output) → R2 as JSON blobs per session
- Indexed events (AI calls, test runs, file opens) → D1 assessment_telemetry table (for querying/filtering)
- Session replay loads both: R2 blob for raw timeline + D1 for structured events

**Privacy/legal:**
- Candidates must acknowledge recording before starting
- Companies cannot share replay data outside their org
- Candidates can request deletion of their session data (GDPR)

---

### Step 7: Git integration

**Branch:** `feat/ide-git`

**What:** Add `isomorphic-git` for clone/commit/push. Already installed (`package.json`), works with any in-memory filesystem — now backed by VirtualFS via `RuwtBackend`.

**Tasks:**
- [ ] Git wrapper: `clone()`, `commit()`, `push()`, `status()`, `diff()`, `log()` using VirtualFS as the backing store
- [ ] Clone flow in `/ide/new` — paste a URL, clone into VirtualFS
- [ ] Git status indicators in file tree (modified, added, untracked)
- [ ] Commit panel (message input + commit button)
- [ ] Push support (user provides GitHub PAT in settings)
- [ ] `git` commands in VirtualShell (`git status`, `git add`, `git commit`, `git push`)

---

### Step 8: BYOK + pricing

**Branch:** `feat/ide-byok`

**What:** Bring Your Own Key support + Pro tier.

**Tasks:**
- [ ] Settings page: API key management (Anthropic, OpenAI, Groq, Ollama URL)
- [ ] Keys stored in localStorage (encrypted with user-derived key)
- [ ] AI chat proxy: detect BYOK key → route through edge without storing
- [ ] Free tier: OSS models only, 3 project max
- [ ] Pro tier ($5/month): unlimited projects, BYOK, Cloud Mode (when built)
- [ ] Stripe integration for Pro plan (extend existing billing)

---

## Notes for Future Claude Sessions

- **Always read `RUNTIME.md`** for browser runtime architecture (esbuild-wasm + QuickJS + VirtualFS)
- **Always read `TECH_STACK.md`** for full context on strategy, architecture, and business model
- **Always run `npx vitest run` after changes** to verify nothing is broken
- **Always run `npx tsc --noEmit`** to verify TypeScript compiles
- **Run `/simplify` after changes** per CLAUDE.md instructions
- **Test coverage is 100%** and must be maintained — add tests for all new code
- **Istanbul ignore syntax:** `/* istanbul ignore next -- @preserve */` (the `@preserve` is REQUIRED)
- **React Native Web testing:** use `fireEvent.click()` not `fireEvent.press()`
- **Branch off `main`** for all work (not `develop` — it's diverged)
- **Commit style:** `type(dev): description` (e.g., `feat(dev): add session replay`)
- **WebContainer is deprecated** — `webcontainer.ts` and `browser-backend.ts` still exist but are unused. The IDE uses `RuwtBackend` via `useRuntime` hook.
- **The old `useWebContainer` hook** is still in the codebase for reference but `IDEScreen` and `IDETerminal` no longer import from it.
- **esbuild.wasm** is served from `public/esbuild.wasm` (self-hosted, 13MB). Do not use CDN — COEP headers block cross-origin fetches on `/ide/*`.
- **Ruwt Runtime constants:** `HOME_DIR` and `NODE_MODULES_DIR` in `src/lib/runtime/constants.ts`. Never hardcode `/home/user`.
