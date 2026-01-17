Ruwt chatbot inside WhatsApp (and link it to Ruwt login + enterprise dashboard)

**Date**: January 17, 2026  
**Status**: Proposed  
**Extends**: [Clone WhatsApp](./01_17_26_12_00_01_clone_whatsapp_with_agent_mediated_messaging.md)  
**Author**: Israel Peter Thompson Afangideh

We want a Ruwt chatbot inside WhatsApp, similar to how we have the chatbot on iOS and Android.

This is a distribution bet: users already live inside WhatsApp. We meet them there.

### The Product
A WhatsApp user can message “Ruwt” inside WhatsApp and get:
- rewriting
- tone slider tuning (or preset selection)
- language/register preservation
- (later) voice note mediation

### Linking to Ruwt Accounts
If their WhatsApp phone number is connected to our login, we treat it as the same identity.

This enables:
- continuity between WhatsApp bot and Ruwt app
- enterprise/admin dashboard visibility for org accounts when they login to the app

### UX Inside WhatsApp
We keep it simple and WhatsApp-native:
- The bot responds with rewritten text that the user can copy/send.
- Provide quick reply buttons as “presets” (Boss, Customer, Partner, etc).
- Minimal commands:
  - `tone` → show and adjust professionalism/warmth/directness/brevity
  - `language` → set auto vs explicit
  - `help`

### Identity and Security
- Linking flow: user messages bot → bot sends a “link code” → user logs into Ruwt app/web → enters code → phone is linked.
- If linked, bot can store defaults (tone vector, language policy).

### Rollout Phases
- **Phase 1**: text-only rewriting inside WhatsApp, presets, link accounts.
- **Phase 2**: support media transcription (user sends voice note → bot returns rewritten text).
- **Phase 3**: full mediated voice note back into WhatsApp (if platform policies allow).

### Success
- Users can use Ruwt value without installing the app.
- Conversion: WhatsApp bot users link accounts and become app users.

### Open Questions
- Which provider do we use (WhatsApp Business API direct vs Twilio)?
- WhatsApp policy constraints: templates, session windows, media sending limits.

