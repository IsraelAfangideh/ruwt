# Collector and adapter boundary

The local service owns queueing, redaction, imports, retries, and export. It
does not scan a complete file system. Collection uses explicit approved paths
and returns events through the shared schema.

Collect now (desktop Insights, or `npm run cli -- collect`) reads Claude Code,
Cursor, and Codex session files from those approved folders. Insights are
computed on the machine from the local journal. Nothing in that path needs
ruwt.ai.

The generic JSON importer works now. Sync posts to **ruwt.ai** by default
(`https://ruwt.ai/api/intelligence/events`). Override with `RUWT_INGESTION_URL`
for local or preview environments. **ruwt.dev** is a separate product and is not
the ingestion target.
