Clone WhatsApp (standards + features) but add agent mediated communication

**Date**: January 17, 2026  
**Status**: Proposed  
**Extends**: [The OG Spec](../11_25_25.md)  
**Author**: Israel Peter Thompson Afangideh

We are going to clone WhatsApp. Not “inspired by”. Clone it. The product mental model is:
- WhatsApp is to Ruwt as VS Code is to Cursor.
- Or TypeScript is to JavaScript.

The baseline is WhatsApp standards and features. Our differentiator is that **agents/runners can mediate communication** while still feeling like WhatsApp.

### Why
People already know how to message in WhatsApp. We should not ask them to learn a new messaging mental model just to get tone mediation and courier capabilities.

### Product Principle
**WhatsApp parity is the default.** Any Ruwt-specific concept must feel additive, not confusing.

### Core UX (WhatsApp Parity)
Ruwt mobile + web should match these expectations:
- **Chat list**: last message preview, timestamp, unread badge, pinned chats, archived.
- **DM thread**: bubbles, timestamps, replies, message forwarding, copy, delete, edit (if we choose), reactions (later).
- **Delivery semantics**: sent, delivered, read (double checks), typing indicator.
- **Attachments**: images, video, documents.
- **Voice notes**: record, playback, waveform/time, background audio handling.
- **Search**: search chats and messages.
- **Contact model**: phone-number-first identity (with optional username later).

We do not need to “invent” new UI here. We copy what works.

### Where the Runner/Agent Lives
We introduce an **agent layer** that can be ON/OFF per thread:
- **Off**: behaves like WhatsApp.
- **On**: outgoing messages are mediated (rewrite, translate, tone vector, policy) before sending.

Visually, this should be extremely subtle:
- A small “mediated” toggle in the thread header.
- A compact chip showing current runner + tone vector (see slider spec).

### Agent Mediated Communication
When mediation is ON, we support:
- **Rewrite before send** (default): user types → runner rewrites → user approves → send.
- **Auto-send policy** (enterprise later): can allow send-without-approval depending on org policy.
- **Meaning preservation**: runner must not change facts, numbers, names, commitments.
- **Language preservation**: runner keeps language/register (see language spec).

### Enterprise Discount Mechanism (High Level)
We can offer a discount to companies whose users message customers on Ruwt instead of WhatsApp by:
- **Measuring**: volume of customer interactions mediated/sent on Ruwt.
- **Attribution**: org-owned phone numbers / accounts.
- **Reporting**: admin dashboard shows usage that qualifies (see enterprise spec).

### Rollout Phases
- **Phase 1 (Parity MVP)**: DMs, chat list, read receipts, basic media, voice notes.
- **Phase 2 (Quality bar)**: fast sync, offline-first, reliable notifications, search, archive.
- **Phase 3 (Ruwt advantage)**: mediation toggle, runner selection, tone vector, language policy.
- **Phase 4 (Business)**: enterprise seat mgmt + dashboard + policies + discounts.

### Non-Goals (for v1)
- Communities/Channels (WhatsApp “Channels” equivalent)
- Payments
- Full multi-device sync complexity on day 1 (but we should architect for it)

### Success
- A WhatsApp user can use Ruwt instantly with no onboarding.
- Mediation feels like a “power feature” not a new app.

### Open Questions
- Do we ship “edit message” (WhatsApp now has it) in v1 or later?
- Do we support group chats in Phase 1 or Phase 2?

