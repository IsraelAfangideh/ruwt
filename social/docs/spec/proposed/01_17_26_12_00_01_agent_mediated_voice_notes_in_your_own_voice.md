Agent mediated voice notes (rewritten in your own voice)

**Date**: January 17, 2026  
**Status**: Proposed  
**Extends**: [Clone WhatsApp](./01_17_26_12_00_01_clone_whatsapp_with_agent_mediated_messaging.md)  
**Author**: Israel Peter Thompson Afangideh

We want agents to mediate communication in media beyond text.

Example: you send an angry voice note, your professionalism slider is at 10, and Ruwt notifies you it has a new voice note in **your own voice** (indistinguishable), that says what you said but fits your slider vector.

### The Problem
Voice notes are how people actually communicate. If our mediation only works on text, we lose the battle.

### The Solution
When mediation is ON for a thread, voice notes become:
1. Record (user)
2. Transcribe (system)
3. Rewrite transcript using tone vector + language policy
4. Synthesize a new voice note in the user’s voice
5. User approves → send

This should feel like WhatsApp voice notes, but with a “mediated” step.

### UX
- User records as normal.
- After recording, we show:
  - **Original transcript**
  - **Mediated transcript** (what will be sent)
  - A play button for **“Your mediated voice note”**
- User can:
  - **Send** (mediated)
  - **Send original** (escape hatch)
  - **Edit text** (edit transcript before synthesis)

### Consent and Safety Requirements
We are literally cloning a user’s voice. This requires explicit consent.
- **We must have a “Voice Model Consent” screen** before enabling this feature.
- We should require a short “voice enrollment” step.
- We should allow users to delete their voice model.

Also: we should add internal watermarking or provenance, even if the audio sounds identical.

### Language + Tone
The mediated transcript must respect:
- **Tone vector** (professionalism, warmth, etc)
- **Language/register preservation** (Pidgin stays Pidgin)
- Meaning preservation constraints

### Rollout Phases
- **Phase 1**: Voice notes with transcription + rewrite + user reads/sends as text (no synthesis).
- **Phase 2**: Synthesis in a neutral default voice (no cloning).
- **Phase 3**: “Your own voice” synthesis behind consent + enrollment.

### Success
- Users start using voice notes in Ruwt at similar rates to WhatsApp.
- Reduction in “regret sends” for voice notes.

### Open Questions
- Do we store the original voice note when mediated is sent, for audit/replay?
- How do we handle noisy environments and transcription errors?

