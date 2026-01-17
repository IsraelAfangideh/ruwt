Add a new runner: Respond

**Date**: January 17, 2026  
**Status**: Proposed  
**Extends**: [Modularize the Codebase to fit other runners](../12_22_25_11_35_28_modularize_codebase.md)  
**Author**: Israel Peter Thompson Afangideh

We need a new runner called **Respond**.

- **Rewrite**: takes a message and rewrites it (same meaning, different tone).
- **Respond**: takes a message and produces a **congruent response** (a reply you can send back).

We should learn from and mimic our Rewrite implementation where it makes sense.

### The Product Behavior
Given an inbound message (from your boss, your girlfriend, a customer), Respond suggests a reply that:
- stays on-topic
- matches the user’s intent and relationship context
- respects language/register (Pidgin stays Pidgin)
- can be tuned by sliders (professionalism etc) when we wire that in

Respond is a courier assistant, not a friend. It should not start new topics or therapize. It should help the user reply.

### UX (Mobile + Web)
Respond should feel like Rewrite:
- user pastes/inputs the message they received
- runner returns:
  - a brief **thought** (optional)
  - an actionable **response** the user can copy/send

Button expectations (similar pattern to `RewriteBubble`):
- **Copy**
- **Send**
- (later) **Make Warmer / Make More Direct** as runner actions driven by the tone vector

### API Contract (Proposed)
Add a new endpoint:
- `POST /runners/respond/chat`

Add shared types in `@ruwt/shared` similar to Rewrite:
- `RESPOND_IDENTITY`
- `RespondChatRequestSchema`
- `RespondChatResponseSchema`
- `generateRespondPrompt(...)`

The response should be strict JSON, same as Rewrite.

Proposed JSON Schema:
```json
{
  "explanation": "One short sentence about the response approach.",
  "response": "The actual reply the user can send."
}
```

### Prompt Shape (High Level)
Rewrite prompt says “YOU NEVER REPLY, YOU ONLY TRANSFORM TEXT”.
Respond prompt should instead say:
- you produce a reply to the inbound message
- do not invent facts
- do not volunteer commitments the user didn’t make
- keep language/register
- keep it congruent with relationship context (boss vs girlfriend)

### Database Updates + Migrations (Required)
We need to represent runner “capability” in the database so clients and the API can treat Rewrite/Respond differently without hardcoding.

Proposed DB change:
- Add a new column to `runners`:
  - `kind`: text, not null, default `'rewrite'`
  - allowed values (for now): `'rewrite' | 'respond'`

Migration:
- Create a new drizzle migration that:
  - adds `kind` to `runners` with default `'rewrite'`
  - backfills existing rows

Seed change:
- Update `code/api/src/seed.ts` to insert a second runner:
  - name: `Respond`
  - kind: `respond`
  - system prompt: response-generation specific

### Backend Implementation Notes
Mirror `services/rewrite.ts` with:
- `services/respond.ts`
  - fetch runner by name (`Respond`)
  - fetch user memories
  - build respond system instruction via shared prompt generator
  - enforce JSON output with `responseMimeType: "application/json"`

Wire route in `code/api/src/index.ts` similar to `/runners/rewrite/chat`.

### Rollout Phases
- **Phase 1**: text-only Respond runner (paste message → suggested reply).
- **Phase 2**: thread-aware respond (uses chat history from the UI, not just one message).
- **Phase 3**: integrate tone vector + language policy formally (once those specs are implemented).

### Success
- Users can get a good reply in 1–2 iterations.
- Respond does not hallucinate, does not overstep, does not change languages.

### Open Questions
- Should Respond always ask “who is this person to you?” if unknown (boss/customer/partner), or rely on presets?
- Do we store inbound messages for future context (and enterprise audit), or keep it ephemeral initially?

