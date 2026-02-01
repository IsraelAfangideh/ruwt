# ruwt.dev

Ruwt is a competitive coding platform where success is measured in dollars, not just runtime. Developers solve challenges by prompting AI models, with every token and model choice carrying a real-world price tag. The goal is to produce working code for the absolute lowest financial cost, turning engineering efficiency into a game of arbitrage.

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **ORM:** Drizzle
- **Payments:** Stripe
- **AI Providers:** OpenAI, Anthropic, Cloudflare Workers AI
- **Editor:** Monaco Editor
- **Terminal:** xterm.js
- **Sandbox:** WebContainers

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account
- Stripe account
- API keys for OpenAI, Anthropic, and/or Cloudflare

### Setup

1. Clone the repository and install dependencies:

```bash
cd dev
npm install
```

2. Copy the environment template:

```bash
cp .env.example .env.local
```

3. Fill in your environment variables in `.env.local`

4. Set up the database:

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

5. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

```
dev/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth pages (login, register)
│   ├── (dashboard)/       # Protected dashboard pages
│   ├── arena/             # Challenge IDE
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── editor/           # Monaco editor components
│   └── ai/               # AI-related components
├── lib/                   # Utility libraries
│   ├── supabase/         # Supabase clients
│   ├── ai/               # AI providers & pricing
│   └── ...
└── drizzle/              # Database schema & migrations
```

## Environment Variables

See `.env.example` for all required environment variables.

## License

MIT
