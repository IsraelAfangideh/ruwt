# Desktop security boundary

The webview must not receive shell or unrestricted filesystem access. Native
commands expose a path allowlist: read Claude Code / Cursor / Codex session
folders, write only `~/.ruwt`. The collector discards prompt text before the
journal is written. The checked-in Tauri configuration has a restrictive
content security policy.

The present desktop build does not yet have OS keychain storage. Do not store a
cloud ingestion key in the local journal. Use process environment variables
only for local development until secure storage is implemented.
