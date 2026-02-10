# Rewrite Dev App → React Native Web + Cloudflare Pages

Rewrite the existing Next.js `dev` app as a **react-native-web** app bundled by **Vite**, deployed to **Cloudflare Pages**. All current functionality is retained. The visual aesthetic is ported from the `social` folder.

## User Review Required

> [!IMPORTANT]
> **Backend / API routes**: Next.js API routes (`/api/ai/chat`, `/api/leaderboard`, `/api/attempts`, `/api/submissions`, `/api/webhooks/stripe`) will be converted to **Cloudflare Functions** (file-based routing in `functions/`). Same logic, different runtime.

> [!WARNING]
> **WebContainer / Monaco / xterm**: These are browser-only libraries and will continue to work in react-native-web since they target a real DOM. They will be lazy-loaded just as they are today.

> [!IMPORTANT]
> **Supabase auth**: Will use `@supabase/supabase-js` directly (no SSR helpers needed since this is now a client-side SPA). Auth guards become navigation guards via react-navigation.

## Proposed Changes

### 1. Project Scaffold

Replace current Next.js config with Vite + react-native-web:

| File | Action |
|------|--------|
| `package.json` | Rewrite — new deps (react-native-web, @react-navigation/*, vite) |
| `vite.config.ts` | NEW — alias `react-native` → `react-native-web`, configure static output |
| `tsconfig.json` | Rewrite — adjust for Vite + RN Web |
| `index.html` | NEW — entry point with Google Fonts (Cormorant Garamond, Libre Franklin) |
| `next.config.ts`, `postcss.config.mjs`, `middleware.ts`, `next-env.d.ts` | DELETE |

---

### 2. Theming (from social folder)

| File | Purpose |
|------|---------|
| `src/theme/colors.ts` | Port of `social/code/mobile/src/theme/colors.ts` — warm cream/dark palette |
| `src/theme/tokens.ts` | Spacing, fonts, transitions, radii from social CSS |
| `src/theme/ThemeContext.tsx` | System-aware dark/light toggle via React context |
| `src/theme/index.ts` | Barrel export |

Key values ported:
- Light: `#f5f3f0` bg, `#1a1816` text, `#9a7b3c` gold accent
- Dark: `#0f0e0d` bg, `#e8e4df` text, `#c9a962` gold accent
- Fonts: Cormorant Garamond (display), Libre Franklin (body)
- Grain overlay, fadeInUp animations

---

### 3. Navigation (react-navigation for web)

| File | Purpose |
|------|---------|
| `src/navigation/AppNavigator.tsx` | Stack navigator with all routes |
| `src/navigation/linking.ts` | Deep linking config for web URLs |

Routes preserved:
- `/` — Landing
- `/login`, `/register`, `/callback` — Auth
- `/challenges` — Challenge list (dashboard)
- `/leaderboard` — Global rankings
- `/profile` — User profile
- `/settings` — Account settings & credits
- `/arena/:challengeId` — Challenge IDE

---

### 4. UI Components (29 components → RN Web)

All existing components rewritten using `View`, `Text`, `Pressable`, `StyleSheet`:

**Core UI** (from `components/ui/`):
`Button`, `Card`, `Badge`, `Input`, `Label`, `Avatar`, `Dialog`, `DropdownMenu`, `Form`, `Progress`, `Select`, `Separator`, `Tabs`, `Table`, `Textarea`, `Sonner` (toast)

**Feature components**:
`ChallengeCard`, `DashboardNav`, `UserNav`, `BalanceTicker`, `ThemeToggle`

**AI components** (retained as-is, web-only):
`ChatPanel`, `CostTracker`, `ConstraintDisplay`, `ModelSelector`

**Editor components** (retained, lazy-loaded):
`CodeEditor` (Monaco), `FileTree`, `Terminal` (xterm)

---

### 5. Screens (all pages retained)

| Screen | Key functionality preserved |
|--------|---------------------------|
| `Landing` | Hero, How It Works cards, Model Tiers, CTA — styled with social aesthetic |
| `Login` | Email + password, GitHub/Google OAuth via Supabase |
| `Register` | Account creation with Supabase |
| `Challenges` | Grid of ChallengeCards, fetched from API |
| `Leaderboard` | Top-3 podium + full ranked table |
| `Profile` | Account info, stats grid, recent activity |
| `Settings` | Credit packages, account settings, danger zone |
| `Arena` | Full IDE: file tree, Monaco editor, xterm terminal, AI chat, cost tracker, constraints |

---

### 6. Lib / Services (18 files retained)

| Module | Adaptation |
|--------|-----------|
| `supabase/client.ts` | Keep as-is (client-side only now) |
| `supabase/server.ts` | Move to Cloudflare Functions |
| `ai/*` (pricing, tokens, constraints, providers, proxy) | Move server parts to Functions, keep client parts |
| `sandbox/webcontainer.ts` | Keep as-is (browser-only) |
| `stripe.ts` | Keep as-is |
| `agent/*` | Keep as-is (client-side) |
| `judge/client.ts` | Keep as-is |

---

### 7. API Routes → Cloudflare Functions

| Next.js Route | Cloudflare Function |
|--------------|-------------------|
| `app/api/ai/chat/route.ts` | `functions/api/ai/chat.ts` |
| `app/api/leaderboard/route.ts` | `functions/api/leaderboard.ts` |
| `app/api/attempts/route.ts` | `functions/api/attempts.ts` |
| `app/api/submissions/route.ts` | `functions/api/submissions.ts` |
| `app/api/webhooks/stripe/route.ts` | `functions/api/webhooks/stripe.ts` |

Same logic, adapted to Cloudflare Workers `onRequest` handler pattern.

---

### 8. Cloudflare Deployment

| File | Purpose |
|------|---------|
| `wrangler.toml` | Static assets from `dist/`, functions directory |
| `public/_headers` | Security headers, SPA fallback |
| `public/_redirects` | `/* /index.html 200` for SPA routing |

---

## Verification Plan

### Automated
1. `npm run build` — produces `dist/` with `index.html` + JS bundle
2. `npx tsc --noEmit` — no type errors

### Browser
1. `npm run dev` → verify landing page with social theming (fonts, colors, grain)
2. Navigate all routes: login, register, challenges, leaderboard, profile, settings, arena
3. Toggle dark/light mode
4. Verify arena loads Monaco editor, terminal, chat panel
5. Test responsive layout at mobile width
