# Ruwt.dev Product Strategy — Reshape Notes

## Vision

Transform ruwt.dev from "a coding challenge platform with AI" into **the definitive measurement standard for AI fluency in software engineering**. The product should feel less like HackerRank-with-AI and more like a **credit score for AI usage** — a number every developer knows and every hiring manager asks for.

---

## Key Strategic Changes

### 1. AI Fluency Index (AFI) — The Core Score
**Status: IMPLEMENTED**

A composite 0-850 score (deliberately echoing credit scores) that synthesizes all five radar dimensions into one number.

**Score formula (weighted):**
- Prompt Efficiency (25%) — strongest predictor of cost savings
- Model Selection (20%) — picking the right tier for the task
- Debugging Strategy (20%) — iterating cheaply vs. burning tokens
- Speed (20%) — wall-clock time efficiency
- Multi-Model Strategy (15%) — switching models mid-challenge

**Tiers:**
- 750-850: "Exceptional" — Top 5% globally
- 650-749: "Advanced" — Top 20%
- 500-649: "Proficient" — Median range
- 350-499: "Developing" — Below average
- 0-349: "Novice" — Just starting out

**What was built:**
- [x] `functions/_shared/scoring.ts` — server-side AFI computation, radar helpers, certification logic
- [x] `src/shared/lib/scoring.ts` — client-side mirror with same logic + certification definitions
- [x] AFI computed and returned by public profile API (`/api/users/:username`)
- [x] AFI score card displayed prominently on public profile (large number + tier badge)
- [x] Meta tags and share text now include AFI score
- [x] Landing page hero: "What's Your AI Fluency Index?"
- [x] Shared `computeRadarFromCosts()` and `determineCertification()` to avoid duplication

### 2. Certification System — "AI-Fluent Verified"
**Status: IMPLEMENTED**

Developers who meet AFI + solve count thresholds earn verified certification badges. Viral loop: developer earns cert → shares on LinkedIn → hiring manager sees it → signs up team.

**Certification tiers:**
- **AI-Fluent** (Bronze): Pass 10 challenges, AFI >= 400
- **AI-Fluent Pro** (Silver): Pass 25 challenges across 3+ categories, AFI >= 550
- **AI-Fluent Expert** (Gold): Pass 50 challenges across all categories, AFI >= 700

**What was built:**
- [x] 3 certification badge types in `badges.ts` and `badge-defs.ts` (client/server sync)
- [x] Certification checking in `checkAndAwardBadges()` — auto-awards on solve
- [x] Early-return guard: skips radar DB queries when user already has all certs
- [x] Certification display on public profile (icon + title + description)
- [x] Certification returned by public profile API
- [x] Thresholds centralized in `CERTIFICATION_THRESHOLDS` constant (single source of truth)
- [x] "Get Certified" section on landing page with tier cards

### 3. Landing Page — Lead with the Score
**Status: IMPLEMENTED**

**What was changed:**
- [x] Hero: "What's Your AI Fluency Index?" (was "Prove You Can Use AI Better Than Anyone")
- [x] Hero CTA: "Find Your Score" (was "Start Free Practice")
- [x] Stats row: "0-850 AFI Score" as lead stat
- [x] "What Your AFI Measures" section (was "Three Skills That Matter") — now 5 dimensions
- [x] "Get Certified" section with Bronze/Silver/Gold tier cards
- [x] "How Scoring Works" section (was "How It Works") — Solve → Build AFI → Earn Certification
- [x] Teams strip: "Measure your team's AFI. Benchmark candidates."
- [x] Final CTA: "What will your AFI be?" + "Find Your Score" / "Benchmark Your Team"

### 4. Team Benchmarking — Beyond Hiring
**Status: IMPLEMENTED (MESSAGING)**

**What was changed:**
- [x] Teams page hero: "Measure Your Team's AI Fluency. Hire for It."
- [x] Badge: "For Engineering Teams" (was "For Hiring Teams")
- [x] Stats: AFI Score, 3-tier Certification
- [x] CTA: "One Score. Every Engineer." (was "Stop Guessing. Start Measuring.")
- [x] Comparison table: added "AI Fluency Index (0-850)", "Certification system", "Team benchmarking" rows
- [x] Landing page teams section: "Benchmark Your Team" + "Assess Candidates"

### 5. Private Profile — AFI Display
**Status: IMPLEMENTED**

- [x] AFI score card on ProfileScreen (below stats row, above heatmap)
- [x] Tier badge + certification display
- [x] Uses real AFI data from dashboard API

### 6. Post-Solve — AFI Context
**Status: IMPLEMENTED**

- [x] Success overlay shows which AFI dimension the challenge builds (Model Selection, Prompt Efficiency, etc.)
- [x] Certification badges already appear via earned badges system

### 7. Assessment Results — AFI Score
**Status: IMPLEMENTED**

- [x] AFI score computed from candidate's AI profile radar
- [x] Large score display with tier badge above the radar chart
- [x] Section renamed from "AI Profile" to "AI Fluency Profile"

### 8. Leaderboard — AFI Reference
**Status: PARTIAL**

- [x] Teams hint updated to reference AFI scores
- [ ] Full AFI column on leaderboard (requires DB-stored AFI or per-user computation in query)

---

## Architecture Notes

### Shared Code Pattern (Server ↔ Client)
- Cloudflare Pages Functions (`functions/`) and Vite client (`src/`) cannot share imports
- Convention: mirror files with comments noting the relationship
- Examples: `badge-defs.ts`, `cost-estimate.ts`, `scoring.ts`
- Risk: divergence — keep mirrored files in sync manually

### AFI Data Flow
1. User solves challenge → `checkAndAwardBadges()` computes radar + AFI → awards certification badges
2. Public profile load → `/api/users/:username` computes radar + AFI → returns in response
3. Client renders AFI card (with client-side `computeAFI()` fallback for stale API responses)

### Certification Badge Flow
1. After each solve, `checkAndAwardBadges()` runs
2. If `solveCount >= 10` and user doesn't already have all 3 certs:
   - Runs 2 DB queries (globalAvgs + userAvgs) via `Promise.all`
   - Computes radar via `computeRadarFromCosts()`
   - Computes AFI via `computeAFI()`
   - Loops `CERTIFICATION_THRESHOLDS` (highest first) to award qualifying badges
3. Early-return guard: skips all of this if user already has all 3 certification badges

---

## Future Work

- [ ] AFI column on leaderboard (requires DB-stored AFI or per-user computation)
- [ ] Shareable AFI score cards (social media image generation)
- [ ] Team average AFI dashboard
- [ ] Internal team benchmarking features (not just assessment)
- [ ] "State of AI Fluency" report using aggregate data
- [ ] AFI trends over time (sparkline on profile)
- [ ] Post-solve AFI delta (show score change after each solve — needs before/after comparison)
