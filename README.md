# Ruwt

> **"Intelligent Digital Couriers for the Modern Web"**

Ruwt (pronounced *Root*) is a social media application designed to bring the historical dynamic of intelligent **courier-mediated communication** to the internet.

Just as Snapchat brought natural ephemerality to digital communication, Ruwt introduces the concept of intelligent **mediated delivery**.

### The Concept

In the physical world, couriers (*ratzim* in Hebrew) delivered messages personally, bridging the gap between distant parties. Ruwt brings this to the digital world with two distinct modes of interaction:

1.  **The Runner (Mediated):** For the broader network, you do not DM users directly. You interact with AI "Runners"—fiduciaries that carry your message. They vet and format your communication based on your intent (e.g., Reconciliation with embittered parties or expanding the reach of your message) and the recipient's context, introducing a layer of intentionality and "latency as a feature."
    
2.  **The City & The Close (Direct):** For humans who know each other, Ruwt offers safe, private spaces.
    *   **Cities:** Communities of shared interest.
    *   **Closes:** Private, invite-only spaces (max 100 users) that function like digital homes.
    *   *Inside these spaces, humans connect directly—without AI mediation or surveillance from the platform.*

---

## Current Status: Phase 1 (The Runner Prototype)

*Currently, the codebase implements the core Runner architecture and the "Rewrite" agent.*

- **Mediated Communication:** The "Rewrite" runner intercepts messages to ensure they align with the goal of kindness.
- **Mobile Client:** A React Native (Expo) app for 1-on-1 interaction with the Runner.
- **Backend Brain:** Hono + Postgres + Gemini 2.0 Flash to power the Runner's "instincts."

*Note: Cities, Closes, and Direct Messaging logic are part of the broader spec and are currently in development.*

---

## Tech Stack

This is a **Bun** monorepo containing the following workspaces:

- **`api`**: The backend logic and "Brain" of the Runners.
  - **Framework**: Hono
  - **Database**: Postgres with `pgvector` (via Drizzle ORM)
  - **AI**: Google Gemini 2.0 Flash
- **`mobile`**: The React Native mobile client (Expo).
- **`web`**: Marketing website (static, hosted on Cloudflare Pages).
- **`shared`**: Shared types, schemas, and prompts.

**Production:**
- **API Hosting**: Fly.io
- **Marketing Site**: Cloudflare Pages (ruwt.social)
- **Auth/Data**: Supabase

---

## Project Structure

```text
.
├── brand
│   └── mark         # Logo SVGs and PNG exports
├── code
│   ├── api          # Hono backend & CLI prototype
│   ├── mobile       # Expo React Native app
│   ├── web          # Marketing website (ruwt.social)
│   ├── shared       # Shared logic & types
│   └── docker-compose.yml
├── docs
│   ├── spec         # Product specifications & philosophy
│   └── context      # Historical context & conversations
└── gtm
    ├── customers    # Customer feedback & conversations
    └── pitch        # Pitch decks and positioning
```

## Getting Started

### Prerequisites
- [Bun](https://bun.sh/) (v1.0+)
- Docker & Docker Compose (for Postgres/pgvector)
- Google Generative AI API Key

### Installation

1. **Clone the repo**
   ```bash
   git clone <repo-url>
   cd ruwt
   ```

2. **Install dependencies**
   ```bash
   cd code
   bun install
   ```

3. **Environment Setup**
   Create a `.env` file in `code/api` (and `code/mobile` if needed) with the following:
   ```env
   DATABASE_URL=postgres://postgres:password@localhost:5433/ruwt
   GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
   ```

4. **Start the Database**
   ```bash
   cd code
   docker-compose up -d
   ```

5. **Run Migrations**
   ```bash
   cd api
   bun run db:migrate
   ```

### Running the Project

#### The CLI (Runner's Brain)
The CLI allows you to interact directly with the `Rewrite` runner to test its logic and "instincts."

```bash
cd code/api
bun run cli
```

#### The API Server
```bash
cd code/api
bun run dev
```

#### The Mobile App
```bash
cd code/mobile
bun run start
```

## Development Philosophy

- **Test Driven**: Tests should mimic real-world conditions.
- **Privacy First**: We prioritize data security and ownership.
- **Naming**: Names should be short, descriptive, and spiritual where appropriate (e.g., `seed.md`, `Rewrite`).

## License

All rights reserved.


