# Desktop security boundary

The webview must not receive shell or unrestricted filesystem access. The local
service must validate approved paths and redact data before network transfer.
The checked-in Tauri configuration has a restrictive content security policy.

The present desktop build does not yet have OS keychain storage. Do not store a
cloud ingestion key in the local journal. Use process environment variables
only for local development until secure storage is implemented.
