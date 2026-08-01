# Cloud data model

Migration `0065_agentic_engineering_intelligence.sql` adds API keys, desktop
installations, telemetry events, policies, violations, insights, audit records,
and the feature flag. Each new row contains an `org_id` where tenant ownership
applies. API keys retain a SHA-256 hash only.

The migration is additive. It does not change existing assessment, project,
profile, or billing tables.
