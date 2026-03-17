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

### Step 2: Add /ide route with basic editor ✅ COMPLETE

**Branch:** `feat/ide-route`

**Completed.** Created:
- `features/ide/ProjectListScreen.tsx` — `/ide` route with empty state, "New Project" button
- `features/ide/IDEScreen.tsx` — `/ide/new` route with Monaco editor, mock file tree, terminal placeholder, top bar
- Navigation wired up in types.ts, linking.ts, AppNavigator.tsx
- 23 new tests, all 5,438 tests pass

---

### Step 3: WebContainer wrapper ✅ COMPLETE

**Completed.** Created:
- `src/lib/sandbox/webcontainer.ts` — singleton boot, file CRUD, spawn, spawnWithInput, createStarterFiles
- `public/_headers` — COOP/COEP scoped to /ide/* and /arena/* (OAuth unaffected)
- 15 new tests

---

### Step 4: Wire WebContainer to IDE ✅ COMPLETE

**Completed.** Created:
- `features/ide/FileTree.tsx` — recursive tree from WebContainer FS, folder expand/collapse, file icons
- `features/ide/IDETerminal.tsx` — xterm connected to WebContainer jsh shell
- `features/ide/useWebContainer.ts` — boot lifecycle, file tree building, refresh
- IDEScreen updated: real file tree, multi-file tabs, Monaco read/write, debounced auto-save
- Shared terminal theme extracted to colors.ts
- 43 new tests, all 5,496 pass

---

### Step 5: R2 project persistence ✅ COMPLETE

**Completed.** Created:
- D1 migration 0057: projects table
- R2 binding PROJECTS_BUCKET in wrangler.toml, env.d.ts updated
- API: GET/POST /api/projects, GET/PUT/DELETE /api/projects/:id, GET /api/projects/:id/files
- Client: useWebContainer saveProject/loadProject + auto-save (30s), save status indicator
- ProjectListScreen: real project list from API with delete
- IDEScreen: load on mount, save button, /ide/:projectId route
- Files stored as JSON in R2 (simple, no compression for v1)
- 70 new tests, all 5,566 pass

---

### Step 6: Take-home assessment mode ✅ COMPLETE

**Completed.** Created:
- D1 migration 0058: assessment type/repo_url/instructions/allowed_models columns + assessment_telemetry table
- API: POST /api/assess/takehome/start, /telemetry, /submit + GET /api/assessments/:id/takehome
- TakeHomeScreen at /ide/takehome/:sessionId: instructions sidebar, timer, fire-and-forget telemetry, submit flow
- Atomic SQL increments for telemetry cost tracking (race-safe)
- Shared IDE utils extracted (tabLabel, languageForPath)
- 51 new tests, all 5,617 pass

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
