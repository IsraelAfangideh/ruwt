# Architecture review — Ruwt Agentic Engineering Intelligence

## Current architecture

The `/dev` application is a React 19 and Vite single-page application. It uses
React Native Web, React Navigation, a shared warm technical design system, and
Vitest. Cloudflare Pages Functions provide the API. Cloudflare D1 stores
application data through Drizzle. Supabase manages browser sessions. Stripe
webhooks and checkout already provide billing foundations.

The repository also contains separate health, social, trade, executor, and
cloud-machine products. This work only extends `/dev` and adds a narrowly
scoped desktop foundation. Existing assessment, IDE, billing, and organization
routes remain unchanged.

## Strengths

- The application has tested Cloudflare Functions and D1 migrations.
- The application already has Supabase request authentication.
- The organization and membership tables provide a reuse path for tenancy.
- The existing design system supports a coherent product extension.
- The repository has Vitest, ESLint, TypeScript strict checks, and deployment
  workflows.

## Weaknesses and relevant debt

- The current organization role model only supports owner, admin, member, and
  viewer.
- The current API has no tenant-scoped telemetry boundary or API key service.
- The web navigation has no engineering intelligence surface.
- The repository has no desktop runtime or local collection service.
- Some existing function handlers use broad error logging. New telemetry code
  must avoid logging event content.

## Proposed extension

The extension adds a versioned telemetry contract in `dev/shared/intelligence`.
Cloudflare Functions validate batched events, enforce organization membership
or ingestion keys, protect duplicate event IDs, and store accepted events in
D1. Derived analytics, policies, and deterministic insights run over the same
stored events. The React web surface reads only organization-scoped summaries.

The desktop foundation lives in `desktop/`. It contains a Tauri shell design,
the local service contract, a durable queue implementation, local redaction,
and a CLI interface. It shares the TypeScript event contract with web code.
The first checked-in desktop surface is an unsigned developer foundation. It
does not claim signed distribution or vendor collection where vendor formats
cannot be verified in this environment.

## Web and cloud architecture

```text
Desktop collector / generic importer
          | validated batch, idempotency key
          v
Cloudflare Pages Functions -> D1 telemetry tables -> analytics and insights
          |                                               |
          +------------ authenticated organization API ---+
                                                          v
                                               React intelligence workspace
```

Every telemetry query takes an organization ID from the authenticated request
or the API key record. The service verifies membership before it reads or
writes data. The client does not make authorization decisions.

## Desktop architecture

The desktop UI, the CLI, and the collectors communicate with one local
service. The service owns approved-path checks, redaction, adapter checkpoints,
the durable event queue, and sync retries. The webview receives narrow commands
only. The Tauri configuration must deny shell and broad filesystem access.

## Migration and compatibility

The migration only adds tables. It does not alter existing assessment tables.
The application keeps existing navigation and APIs. The new intelligence route
is additive and feature-flagged. A failed migration can roll back by disabling
the feature flag because existing routes do not depend on its tables.

## Delivery phases

1. Add contracts, D1 schema, ingestion, authorization, and tests.
2. Add analytics, policy evaluation, insights, demo data, and web views.
3. Add the Tauri and local-service release foundation.
4. Add verified vendor adapters and signed distribution when vendor fixtures
   and signing credentials are available.
