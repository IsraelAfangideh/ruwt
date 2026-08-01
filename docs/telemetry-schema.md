# Telemetry schema

The canonical schema is `dev/src/shared/intelligence/contracts.ts`. It uses
schema version `1` and Zod validation. Each batch allows one organization and
up to 250 events.

The schema accepts session, model, tool, file, command, test, Git, pull request,
deployment, incident, and policy event types. It rejects unknown top-level
fields. It limits strings and token values.

Ruwt disables raw prompt and source code fields. The metadata redactor removes
known credential keys and token-like values before the local service syncs.
The API stores a redaction state and an adapter confidence level.
