# Integrations

The generic JSON import adapter is real. It accepts a shared-schema event array
or an object with an `events` array.

Claude Code, Cursor, and Codex **session-file scans** are real. Collect now walks
approved folders (`~/.claude/projects`, `~/.cursor/projects`, `~/.codex`), keeps tool names and path classifications, and
discards prompts, diffs, and command text. The Integrations tab reports scanned
file counts. It does not claim a live hook or a connected vendor account.

Git and GitHub adapters remain unimplemented.
