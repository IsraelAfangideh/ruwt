# Ruwt Fit — Fitness & Nutrition Tracker

A web-based fitness and nutrition tracker built with React (react-native-web) on Cloudflare Pages.

## Stack

- **Frontend:** React (react-native-web) + Vite
- **Hosting:** Cloudflare Pages + Functions
- **Database:** Cloudflare D1 (SQLite) + Drizzle ORM
- **Auth:** Supabase (shared with ruwt.dev — same user accounts)

## Getting Started

### Prerequisites

- Node.js 20+ (see root `.nvmrc`)
- Cloudflare account (Pages + D1)
- Supabase project (shared with `/dev`)

### Setup

```bash
cd health
npm install
cp .env.example .env.local  # fill in Supabase keys
```

### Run locally

```bash
# Vite dev server (port 5174)
npm run dev

# Cloudflare Functions + D1 (separate terminal)
npx wrangler pages dev dist --d1=DB
```

### Build

```bash
npm run build
```

## Key Screens

- **Dashboard** — calorie ring, macro bars, meal/workout summary
- **Log Meal** — search foods, log portions
- **Log Workout** — exercises, sets, reps
- **Food Search** — ~90 seeded foods
- **Progress** — SVG charts for weight/nutrition trends
- **Profile/Settings** — goals, preferences

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard` | Daily summary (calories, macros, meals, workouts) |
| GET/PUT | `/api/goals` | User nutrition/fitness goals |
| POST/GET | `/api/meals` | Log and list meals |
| POST/GET | `/api/workouts` | Log and list workouts |
| GET | `/api/foods` | Search food database |
| POST/GET | `/api/body-logs` | Weight/measurement tracking |
| GET | `/api/progress` | Historical charts data |
| GET | `/api/daily-log` | Full daily log |

## Database

Tables: `profiles`, `user_goals`, `foods`, `meals`, `meal_items`, `exercises`, `workouts`, `workout_sets`, `body_logs`, `daily_logs`

D1 migrations are in `drizzle/`. Run against remote:
```bash
npx wrangler d1 migrations apply ruwt-health --remote
```

## Deploy

Push to `main` with changes in `health/**` triggers GitHub Actions → Cloudflare Pages.

Or manually:
```bash
npm run build
CLOUDFLARE_API_TOKEN=... npx wrangler pages deploy dist --project-name=ruwt-health --branch=main
```
