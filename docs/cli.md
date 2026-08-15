# Ruwt CLI

The CLI uses the local service module. It supports `status`, `insights`,
`collect`, `doctor`, `integrations`, `sync`, `pause`, `resume`, `import`,
`export`, `privacy`, `logs`, and `version`.

Run `cd desktop && npm run cli -- status`. The sync command requires
`RUWT_INGESTION_URL` and `RUWT_INGESTION_KEY`. The CLI does not log either
value.
