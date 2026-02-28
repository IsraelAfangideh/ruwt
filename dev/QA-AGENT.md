# Ruwt Arena — Automated QA Agent Runbook

This file is the operating manual for a Claude Code agent running automated QA on ruwt.dev.
It covers: account setup, challenge navigation, QA methodology, tracking state in D1, and known bugs.

## Quick Start

1. Open Chrome browser automation (`mcp__claude-in-chrome__tabs_context_mcp`)
2. Navigate to `https://ruwt.dev` and sign in as **qa@ruwt.dev** (password in dev/.env.local or ask owner)
3. Query D1 to find untested challenges (see "Tracking State" below)
4. Work through challenges tier-by-tier: Impossible → Hard → Medium → Easy → Sprint
5. Record results in the `qa_results` D1 table after each challenge
6. Document platform bugs in `dev/QA-REPORT.md`

---

## QA Account

- **Email**: qa@ruwt.dev
- **Display name**: RUWT QA
- **`leaderboard_excluded = 1`** — this account never appears on leaderboards
- The account has unlimited credits for QA purposes (replenish as needed via admin panel)

---

## Correct QA Methodology

> **Critical**: Do NOT manually implement solutions. The purpose is to find what blocks real users.

### Valid approaches (in order of preference):
1. **AI Chat sidebar** — Click "AI Chat" tab, use Agent mode, type message, click Send (or press Enter)
2. **Terminal `/agent` mode** — Click terminal, type `/agent`, then type your message and press Enter

### Invalid approaches (do not use):
- Writing solutions yourself via Monaco editor
- Using `window.monaco.editor.getEditors()[0].setValue()` to inject solutions
- Using browser JS APIs to bypass the platform's AI tools

### What to document:
- Any error message that is confusing or unhelpful
- Cases where the AI produces broken code (SEARCH/REPLACE truncation, "becomes" artifacts)
- Cases where the AI tool silently fails (no response, no error shown)
- Platform UX friction (unclear instructions, missing hints, confusing error states)
- Whether the challenge is fundamentally solvable with AI assistance

---

## Challenge Navigation

### Finding challenges to test

From the challenges list at `https://ruwt.dev/challenges`:
- Filter by difficulty tier (Impossible, Hard, Medium, Easy, Sprint)
- Note the challenge ID from the URL when you open one: `/arena/{challenge-id}`

### Challenge URL format
```
https://ruwt.dev/arena/{challenge-id}
```

### Checking what's already been tested

Query D1 (production `ruwt-dev` database, ID: `27b64c12-c858-473d-8a40-d202d01d32aa`):

```bash
# Via wrangler (from dev/ directory):
npx wrangler d1 execute ruwt-dev --command "
  SELECT c.id, c.title, c.tier, c.difficulty, qr.status, qr.score, qr.tested_at
  FROM challenges c
  LEFT JOIN qa_results qr ON c.id = qr.challenge_id
    AND qr.qa_user_id = (SELECT id FROM profiles WHERE email = 'qa@ruwt.dev')
  ORDER BY c.tier, c.difficulty, c.sort_order
"
```

### Recording results after each challenge

```bash
npx wrangler d1 execute ruwt-dev --command "
  INSERT INTO qa_results (challenge_id, qa_user_id, status, score, tier, model_used, cost_credits, blockers, notes, agent_id)
  VALUES (
    'challenge-id-here',
    (SELECT id FROM profiles WHERE email = 'qa@ruwt.dev'),
    'passed',            -- 'passed' | 'failed' | 'blocked' | 'partial'
    '5/5',               -- public test score
    'impossible',        -- tier
    'llama-3.1-8b',      -- model used
    0,                   -- credits spent
    '[]',                -- JSON array of blocker strings, e.g. '[\"context limit hit\"]'
    'Solved in 2 AI Chat exchanges',
    'your-agent-id'
  )
"
```

---

## Per-Challenge QA Process

### Step 1: Open the challenge
- Navigate to the challenge URL
- Note the time limit (top-right timer)
- Read the description tab to understand what's expected

### Step 2: Choose a model
- Start with **Budget+** (Llama 3.1 8B, ~$0.00) — cheapest, tests most constrained path
- If Budget+ hits context limit, note the bug and switch to **Mid** (Qwen2.5 Coder 32B)
- Use **Premium** only for challenges that genuinely need it

### Step 3: Attempt the solution
- Use AI Chat sidebar in **Agent** mode
- Describe the problem clearly: "Write a solution for [challenge title]. [Brief description of what to implement]."
- After each exchange, click "Run Tests (N public)" to see progress
- If tests fail, ask the AI to fix specific failures — show it the error output

### Step 4: Submit when all public tests pass (or document why you can't)
- Click "Submit (5 tests)" when ready
- Note the final score (public + hidden)

### Step 5: Record findings
- Update `dev/QA-REPORT.md` with the challenge entry
- Insert a row into `qa_results` via wrangler (see above)
- Add any new platform bugs to the "General UX Issues" section

---

## Known Platform Bugs (as of 2026-02-28)

These bugs have already been fixed or documented. Skip re-testing them; just note if you encounter them still:

| Bug | Status | Fix Location |
|-----|--------|-------------|
| SEARCH/REPLACE truncation (large edits fail) | Known | `diff-apply.ts` — ongoing |
| "becomes" artifact inserted into code | **Fixed** | `diff-apply.ts` `isSeparator()` |
| 413 context window: no helpful error message | **Fixed** | `RuwtTUI.ts` `onError` handler |
| Monaco autocomplete mangles `.catch()`, async patterns | **Fixed** | `ArenaIDE.tsx` — disabled quickSuggestions |
| Budget+ (7968 token) context fills after 2 exchanges | Known | Model limitation — workaround: `/clear` |
| Terminal: multiple message queueing via automation | Known | UX issue for automation only |
| Module-level code in Python pollutes judge output | Known | Starter code gap — no `solve()` hint |

---

## Tier-by-Tier Testing Strategy

### Impossible (14 challenges) — ~90 min each, focus on AI tool reliability
Test with Budget+ first. If blocked by platform bugs (not challenge difficulty), document and move on.
Expected pass rate with AI assistance: ~50-70% (some require Premium model).

### Hard (~20 challenges) — ~30 min each
Mix of difficulty. Budget+ or Mid tier should work for most.

### Medium (~30 challenges) — ~15 min each
Most should pass with Budget+ in 1-2 exchanges.

### Easy (~30 challenges) — ~5 min each
Should pass with a single AI Chat exchange. Flag any that don't.

### Sprint (~12 challenges) — ~2 min each (timed, no AI)
Manual coding challenges. Test that timer works, code runs, submission records correctly.

---

## Running Multiple QA Agents in Parallel

You can spawn up to 3 browser-based QA agents simultaneously — each works on different challenges:

1. Agent A: challenges 1-35 (Impossible + Hard)
2. Agent B: challenges 36-70 (Medium)
3. Agent C: challenges 71-106 (Easy + Sprint)

Each agent writes to `qa_results` with its own `agent_id` — no conflicts since challenge IDs are disjoint.

**Constraint**: Each agent needs its own browser tab/session. With `mcp__claude-in-chrome`, use separate tab groups or windows.

---

## Escalation Criteria

Stop the QA session and report immediately if you see:
- A challenge that crashes the platform (unhandled exception, white screen)
- A security issue (XSS, exposed credentials, unauthorized data access)
- Any challenge where the correct solution scores 0/5 with no helpful error

---

## File Locations

| File | Purpose |
|------|---------|
| `dev/QA-REPORT.md` | Human-readable QA findings, blockers, notes |
| `dev/QA-AGENT.md` | This file — agent operating manual |
| `dev/drizzle/migrations-d1/0038_qa_tracking.sql` | D1 migration for qa_results table |
| `dev/src/components/arena/RuwtTUI.ts` | Terminal AI mode (413 fix here) |
| `dev/src/components/ArenaIDE.tsx` | Monaco editor config (autocomplete fix here) |
| `dev/src/lib/ai/diff-apply.ts` | SEARCH/REPLACE parser ("becomes" fix here) |
