# Threat model

The main threats are a compromised webview, path escape, credential disclosure,
cross-organization access, malformed telemetry, replayed requests, and unsafe
desktop updates.

The foundation reduces these threats through a restrictive Tauri content policy,
validated telemetry, metadata redaction, hashed keys, organization checks,
event IDs, bounded batches, local storage permissions, and no shell exposure.
It does not yet provide OS credential storage, signed updates, or adapter path
walk protection. Do not distribute the desktop build until these controls ship.
