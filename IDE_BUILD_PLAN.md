# Ruwt IDE — Implementation Plan

This document is the step-by-step build plan for adding IDE capabilities to ruwt.dev.
Read `TECH_STACK.md` for full strategy, architecture, and financial context.

## Current State

- ruwt.dev is a live assessment platform with 27 users, 44 challenges, and a full Arena IDE
- The Arena IDE (`/arena/:challengeId`) has: Monaco editor, AI chat (SSE streaming), xterm terminal, diff applier, cost tracking
- Assessment infrastructure exists: AssessmentBuilder, invite flow, candidate flow, results dashboard, org management
- `@webcontainer/api` is already in `dev/package.json` (installed but unused in current RNW app)
- Old Next.js app (`dev/app/`) has dead WebContainer + FileTree code that can be referenced

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

**What:** Move reusable IDE components from `features/arena/` to `features/shared-ide/`. Arena imports from the new location. Pure refactor — no new features.

**Components to extract:**
- Monaco editor wrapper (the lazy-loaded editor component)
- AI chat panel + hooks (`useAIChat.ts`, `ChatMarkdown.tsx`, `ModeSelector.tsx`)
- Terminal panel (`TerminalPanel.tsx`)
- Diff applier (`lib/diff-apply.ts`, `lib/code-apply.ts`, `lib/apply-model.ts`)
- Results bar (`ResultsBar.tsx`)
- Panel resize bar (`PanelResizeBar.tsx`)
- Plan approval (`PlanApproval.tsx`)
- Collapsed sidebar (`CollapsedSidebar.tsx`)
- Layout hook (`useArenaLayout` or equivalent)

**What stays in arena/:**
- `ArenaScreen.tsx` (challenge-specific orchestration)
- `ArenaIDE.tsx` (challenge-specific IDE wrapper)
- `GuestArenaScreen.tsx`
- `ExpiryOverlay.tsx` (challenge timer — challenge-specific)
- `RuwtTUI.ts` (virtual shell — challenge-specific, may not be needed in IDE mode)
- `Notepad.tsx`
- Challenge-specific types and hooks

**Acceptance criteria:**
- [x] All components moved to `features/shared-ide/`
- [ ] `features/shared-ide/index.ts` barrel export (deferred — not needed yet)
- [x] Arena components import from `shared-ide/` instead of local
- [x] ALL existing tests pass (`npx vitest run`) — 5,415/5,416 (1 pre-existing failure in LandingScreen)
- [x] TypeScript compiles (`npx tsc --noEmit`)
- [x] No behavior changes — pure refactor

**Completed in branch `feat/ide-shared-components`. 53 files changed.**

What was moved to `shared-ide/`:
- UI: ChatMarkdown, CollapsedSidebar, ModeSelector, PanelResizeBar, PlanApproval, Notepad, VirtualFileSystem, VirtualShell
- Hooks: useAIChat (attemptId→sessionId), useIDELayout (renamed from useArenaLayout), useEditorDecorations, useCodeSync
- Lib: diff-apply, code-apply, apply-model, tool-parser, line-diff, monaco-init
- New: ai-types.ts (extracted shared types from system-prompts.ts)

What stayed in `arena/` (challenge-specific):
- ArenaIDE.tsx, ArenaScreen.tsx, GuestArenaScreen.tsx, TerminalPanel.tsx, ResultsBar.tsx, ExpiryOverlay.tsx, RuwtTUI.ts, ArenaErrorBoundary.tsx, lib/system-prompts.ts

**Gotchas:**
- Some components may have arena-specific props/types. Make them generic or pass as props.
- Test files that import from arena paths need updating
- Istanbul coverage exclusions may need adjusting

---

### Step 2: Add /ide route with basic editor

**Branch:** `feat/ide-route`

**What:** New route `/ide` that renders a basic IDE layout using shared-ide components. No WebContainer yet — just Monaco with a hardcoded file, terminal placeholder, and file tree stub.

**Tasks:**
- [ ] Add `/ide`, `/ide/new`, `/ide/:projectId` routes to navigation/linking.ts
- [ ] Create `features/projects/ProjectListScreen.tsx` — placeholder list
- [ ] Create `features/editor/IDEScreen.tsx` — basic layout using shared-ide components
- [ ] Wire up in `AppNavigator.tsx`
- [ ] Basic tests for new screens

**Acceptance criteria:**
- [ ] Navigating to `/ide` shows a project list placeholder
- [ ] Navigating to `/ide/new` shows the IDE with an empty Monaco editor
- [ ] Existing routes unaffected
- [ ] Tests pass, TypeScript compiles

---

### Step 3: WebContainer wrapper

**Branch:** `feat/ide-webcontainer`

**What:** Port WebContainer integration. Create `src/lib/sandbox/webcontainer.ts` with functions to boot, read/write files, spawn processes. Add COOP/COEP headers.

**Reference code:** `dev/app/arena/[challengeId]/page.tsx` (old Next.js — lines 16-22 for imports, lines 131-168 for initialization)

**Tasks:**
- [ ] Create `src/lib/sandbox/webcontainer.ts` — wrapper module
  - `getWebContainer()` — singleton boot
  - `mountFiles(files)` — mount file tree
  - `writeFile(path, content)` — write single file
  - `readFile(path)` — read single file
  - `deleteFile(path)` — delete file
  - `listFiles(path?)` — list directory contents
  - `spawn(cmd, args)` — run process, return output stream + exit code
- [ ] Add `_headers` file for COOP/COEP on Cloudflare Pages:
  ```
  /*
    Cross-Origin-Embedder-Policy: require-corp
    Cross-Origin-Opener-Policy: same-origin
  ```
- [ ] Tests for wrapper (mock WebContainer API in tests)

**Gotchas:**
- COOP/COEP headers may break some existing functionality (external resources, OAuth popups). Test carefully.
- WebContainer boot is async and slow (~2s). Handle loading state.
- Only one WebContainer instance per page. Singleton pattern required.

---

### Step 4: Wire WebContainer to IDE

**Branch:** `feat/ide-webcontainer-ui`

**What:** Connect the WebContainer wrapper to the IDE screen. File tree reads from WebContainer filesystem. Monaco reads/writes files. Terminal connects to WebContainer shell.

**Tasks:**
- [ ] Build `features/shared-ide/FileTree.tsx` — tree component reading from WebContainer
- [ ] Multi-file tab support in Monaco (open files in tabs, switch between them)
- [ ] Wire xterm to WebContainer `spawn('jsh')` for real shell
- [ ] File create/rename/delete context menu in file tree
- [ ] Auto-save: debounced write to WebContainer on Monaco change
- [ ] Loading state while WebContainer boots

**Acceptance criteria:**
- [ ] User can create a project, see file tree, edit files, use terminal
- [ ] Terminal runs real commands (`ls`, `node file.js`, `npm install`)
- [ ] Files persist within the session (in WebContainer memory)
- [ ] Closing the tab loses files (persistence comes in Step 5)

---

### Step 5: R2 project persistence

**Branch:** `feat/ide-persistence`

**What:** Save and load projects to/from Cloudflare R2.

**Tasks:**
- [ ] Create R2 bucket `ruwt-projects` in Cloudflare dashboard
- [ ] Add R2 binding to `dev/wrangler.toml`
- [ ] D1 migration: create `projects` table
- [ ] API endpoints:
  - `POST /api/projects` — create project metadata
  - `GET /api/projects` — list user's projects
  - `GET /api/projects/:id` — get project metadata
  - `PUT /api/projects/:id/save` — save files (tar → R2)
  - `GET /api/projects/:id/load` — load files (R2 → response)
  - `DELETE /api/projects/:id` — delete project + R2 object
- [ ] Client-side: compress files from WebContainer → upload to R2 on save
- [ ] Client-side: download from R2 → mount in WebContainer on load
- [ ] Auto-save (debounced, 30 seconds)
- [ ] `ProjectListScreen` shows real project list from API

---

### Step 6: Take-home assessment mode

**Branch:** `feat/ide-takehome`

**What:** Companies provide a repo URL for take-home assignments. Candidates get the full IDE with repo pre-cloned and telemetry recording.

**Database changes:**
```sql
ALTER TABLE assessments ADD COLUMN type TEXT DEFAULT 'challenge_based';
ALTER TABLE assessments ADD COLUMN repo_url TEXT;
ALTER TABLE assessments ADD COLUMN repo_token TEXT;
ALTER TABLE assessments ADD COLUMN instructions TEXT;
ALTER TABLE assessments ADD COLUMN allowed_models TEXT;
```

**Tasks:**
- [ ] D1 migration for new assessment columns
- [ ] AssessmentBuilder: add mode toggle (Challenge-Based / Take-Home)
- [ ] Take-Home builder UI: repo URL, instructions (markdown), time limit, model selection
- [ ] Clone repo into WebContainer on candidate session start (isomorphic-git or fetch tarball)
- [ ] Telemetry recording: log every AI call (model, tokens, cost, prompt snippet, timestamp)
- [ ] D1 table for telemetry: `assessment_telemetry` (sessionId, event_type, data JSON, timestamp)
- [ ] Candidate workspace screen at `/ide/takehome/:sessionId`
- [ ] Submit flow: compute git diff, calculate AFI from session, package results
- [ ] Results page: show diff, AI usage timeline, AFI score, conversation replay
- [ ] Company dashboard: per-candidate telemetry view

---

### Step 7: Git integration (can be parallel with Step 6)

**Branch:** `feat/ide-git`

**What:** Add `isomorphic-git` for clone/commit/push in Browser Mode.

**Tasks:**
- [ ] Install `isomorphic-git` + `lightning-fs`
- [ ] Git wrapper: `clone()`, `commit()`, `push()`, `status()`, `diff()`, `log()`
- [ ] Clone flow in `/ide/new` — paste a URL, clone into WebContainer
- [ ] Git status indicators in file tree (modified, added, untracked)
- [ ] Commit panel (message input + commit button)
- [ ] Push support (user provides GitHub PAT in settings)

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

- **Always read `TECH_STACK.md` first** for full context on strategy, architecture, and business model
- **Always run `npx vitest run` after changes** to verify nothing is broken
- **Always run `npx tsc --noEmit`** to verify TypeScript compiles
- **Run `/simplify` after changes** per CLAUDE.md instructions
- **Test coverage is 100%** and must be maintained — add tests for all new code
- **Istanbul ignore syntax:** `/* istanbul ignore next -- @preserve */` (the `@preserve` is REQUIRED)
- **React Native Web testing:** use `fireEvent.click()` not `fireEvent.press()`
- **Branch off `main`** for all work (not `develop` — it's diverged)
- **Commit style:** `type(dev): description` (e.g., `refactor(dev): extract shared-ide components from arena`)
- **COOP/COEP headers may break OAuth popups** — test login flow after adding them
- **The old Next.js WebContainer code** in `dev/app/arena/[challengeId]/page.tsx` is reference only — don't import from it, port the patterns into new modules
