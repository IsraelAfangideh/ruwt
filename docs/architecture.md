# Agentic Engineering Intelligence architecture

The current extension remains inside `/dev`. React renders the organization
workspace. Cloudflare Pages Functions validate telemetry. Cloudflare D1 keeps
accepted normalized events. Supabase authenticates browser requests.

The desktop foundation sends one versioned batch endpoint. The client cannot
choose another organization when it uses a browser session. An ingestion key
also maps to one organization.

```text
Local service -> redaction -> POST /api/intelligence/events -> D1
                                                               |
React Intelligence <- GET /api/intelligence/overview <- analytics rules
```

The current function deployment remains Cloudflare Pages. Existing challenge,
assessment, IDE, and billing routes remain unchanged.
