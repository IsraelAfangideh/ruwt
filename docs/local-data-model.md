# Local data model

The current local journal stores the queue version, collection pause state,
approved paths, redacted normalized events, retry count, retry schedule, and
sanitized error state. The journal uses mode `0600` and an atomic replacement.

The journal does not store browser sessions or cloud tokens. SQLite migration,
OS keychain support, and schema upgrade tests remain release requirements.
