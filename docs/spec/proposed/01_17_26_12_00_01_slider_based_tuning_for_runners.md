Add slider based tuning to runners (Tone Vector)

**Date**: January 17, 2026  
**Status**: Proposed  
**Extends**: [Keep the runners focused](../12_04_25_14_10_keep_the_runners_focused.md)  
**Author**: Israel Peter Thompson Afangideh

We want users to personalize *how* a runner rewrites without changing *what* the runner is. The runner stays a courier. The sliders tune the courier’s delivery style.

### The Problem
Right now we have “one personality” per runner. But users need a reliable way to adapt tone per situation: boss, girlfriend, customer, cofounder. They want control, not a surprise.

### The Solution: A Tone Vector
Each conversation has a **tone vector** (a small set of sliders 0–10) that the runner must respect when rewriting.

Minimum sliders (v1):
- **Professionalism**: 0 (casual) → 10 (formal)
- **Warmth**: 0 (cold) → 10 (warm)
- **Directness**: 0 (soft / indirect) → 10 (direct)
- **Brevity**: 0 (verbose) → 10 (short)

Optional sliders (later):
- **Humor**
- **Emojis**
- **Assertiveness**

### UX
- **Per conversation default**: every thread has its own slider values.
- **Quick presets**: “Boss”, “Partner”, “Customer”, “Friend”, “Apology”, “Request”, “Boundary”.
- **Fast adjustment**: sliders available from the chat header (one tap).
- **Always visible**: show a small compact “tone chip” summary (e.g. `Pro 9 / Warm 6 / Dir 8 / Brev 7`).

### Runner Contract
All runners that “rewrite” must accept:
- **`toneVector`**: the slider values
- **`languagePolicy`**: (see language spec) keep user language and register
- **`constraints`**: do not change meaning, names, facts, dates

If the runner cannot comply, it must say so explicitly and ask what to do.

### Data Model (Proposed)
- Store tone vector per conversation, with a per-user “default tone vector”.
- Tone vector changes are part of the conversation state (and can be audited for enterprise).

### Rollout Phases
- **Phase 1**: Implement tone vector for the Rewrite/Peacemaker runner only, per conversation.
- **Phase 2**: Add presets + per-contact defaults.
- **Phase 3**: Enterprise policy can lock some sliders or ranges (e.g. professionalism must be ≥ 7 for customer-facing).

### Success
- Users can reliably get the tone they want in < 2 tries.
- Reduced “I didn’t mean that” moments.

### Open Questions
- Should sliders be stored per recipient, per conversation, or both?
- Do we allow “auto” mode where the runner suggests a tone vector based on recipient/context?

