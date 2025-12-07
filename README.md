# Ruwt

> **"The HTTPS of Human Connection"**

Ruwt (pronounced *ruwts*) is an Agent-First social protocol designed to replace direct instant messaging with **mediated communication**. Instead of users messaging each other directly, they interact through AI "Runners" that act as fiduciaries.

We introduce **latency as a feature**. The Runner intercepts messages, vets them against the user's computed identity and goals (e.g., "Peace"), and rewrites or blocks toxicity before it hits the network.

## The Concept

In the physical world, couriers (*ratzim* in Hebrew) delivered messages personally. Ruwt brings this concept to the digital world.

- **No Direct DMs**: You do not interact with the sender directly; you interact with the Runner.
- **The Runner**: An AI agent powered by a vector database of your history and values. It acts as a buffer, ensuring communication aligns with your stated intent (e.g., reconciliation).
- **Sovereignty**: You can override the Runner (the "Unhinged" option), but doing so is logged against your reputation.

## Tech Stack

This is a **Bun** monorepo containing the following workspaces:

- **`api`**: The backend logic and "Brain" of the Runners.
  - **Framework**: Hono
  - **Database**: Postgres with `pgvector` (via Drizzle ORM)
  - **AI**: Google Gemini 2.0 Flash
- **`mobile`**: The React Native mobile client (Expo).
- **`shared`**: Shared types, schemas, and prompts.

## Project Structure

```text
.
├── code
│   ├── api          # Hono backend & CLI prototype
│   ├── mobile       # Expo React Native app
│   ├── shared       # Shared logic & types
│   └── docker-compose.yml
├── spec             # Product specifications & philosophy
└── sales            # Pitch decks and positioning
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
The CLI allows you to interact directly with the `Peacemaker` runner to test its logic and "instincts."

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
- **Naming**: Names should be short, descriptive, and spiritual where appropriate (e.g., `seed.md`, `Peacemaker`).

## License

All rights reserved.


