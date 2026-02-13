# Ruwt

Monorepo for the Ruwt platform.

## Projects

| Directory | What | Stack | URL |
|-----------|------|-------|-----|
| `/dev` | AI-Efficiency Assessment Platform | React + Vite, Cloudflare Pages/D1, Supabase Auth | [ruwt.dev](https://ruwt.dev) |
| `/social` | Ruwt Social Network (API + mobile) | Hono + Bun on Fly.io, React Native (Expo), Supabase Postgres | [ruwt.fly.dev](https://ruwt.fly.dev) |

---

## ruwt.dev — How It Works

Ruwt measures how efficiently you use AI to solve coding challenges. The leaderboard doesn't just reward correctness — it rewards **spending the least AI resources** to get there.

### User Flow

1. **Land on ruwt.dev** — the landing page explains the three dimensions being measured: Model Selection, Prompt Efficiency, and Iterative Debugging.

2. **Register / Login** — GitHub OAuth or email/password. New users get **50,000 free credits**.

3. **Browse Challenges** (`/challenges`) — filter by category (Model Selection, Prompt Efficiency, Debugging). Each card shows difficulty, category, and an efficiency cost goal.

4. **Pick a challenge** — read the full description and constraints (time limit, max tokens, max cost), then choose:
   - **Start Timed** — countdown begins, pressure's on
   - **Start Untimed** — no timer, marked separately on the leaderboard

5. **The Arena IDE** — the core experience:
   - **Left side**: Monaco code editor + Output panel (test results)
   - **Right side**: Tabbed panel — Description tab (problem + examples + constraints) and AI Chat tab (Llama 8B assistant, costs credits/tokens)
   - **Status bar**: real-time cost, token count, time remaining, credits

6. **Iterate** — read the problem, write code, ask the AI for hints, run tests, see which fail, fix, repeat. Every AI chat message costs you — the leaderboard rewards efficiency, not just correctness.

7. **Run Tests** — per-test pass/fail with input, expected output, and actual output. Failed tests auto-expand for quick debugging.

8. **Submit** — finalizes your attempt as `passed` or `failed`.

9. **Leaderboard** (`/leaderboard`) — ranked by challenges solved, then by average cost. Cheapest solvers win.

### The Core Loop

> "How good are you at using AI?"

Can you pick the right prompts, avoid unnecessary back-and-forth, and solve problems with minimal AI cost? That's the skill being ranked.

---

## Development

### Git Workflow

- **Main branch**: `main` (deploys trigger here)
- **Development branch**: `develop`
- **PR flow**: `develop` -> `main`
- **Commit style**: `type(scope): description` (e.g., `fix(dev):`, `feat(social):`)

### Deploy

- `/dev`: Pushes to `main` with changes in `dev/**` trigger GitHub Actions (`deploy-dev.yml`) -> Cloudflare Pages
- `/social`: GitHub Actions (`deploy.yml`) -> Fly.io via `flyctl`

See [CLAUDE.md](./CLAUDE.md) for full architecture details, infrastructure config, and API reference.
