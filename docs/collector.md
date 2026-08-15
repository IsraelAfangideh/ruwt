# Collector and adapter boundary

The local service owns queueing, redaction, imports, retries, and export. It
does not scan a complete file system. A later adapter must use explicit,
approved paths and return events through the shared schema.

The generic JSON importer works now. Sync posts to **ruwt.ai** by default
(`https://ruwt.ai/api/intelligence/events`). Override with `RUWT_INGESTION_URL`
for local or preview environments. **ruwt.dev** is a separate product and is not
the ingestion target.

Claude Code, Cursor, Codex, and Git adapters are not active because this
checkout has no verified local fixtures.
An adapter must report its identifier, version, source paths, compatibility,
last read, health, supported event types, and limitations before release.
