Runners must always respect language (and register) like pronouns and tense

**Date**: January 17, 2026  
**Status**: Proposed  
**Extends**: [Keep the runners focused](../12_04_25_14_10_keep_the_runners_focused.md)  
**Author**: Israel Peter Thompson Afangideh

We already expect runners to preserve meaning. Now we make it explicit: **they must also preserve language and register**.

Example: if someone writes in Nigerian Pidgin, the rewrite must be in Nigerian Pidgin, and it must match the slider tuning (professionalism, warmth, etc) without switching into “formal English”.

### The Problem
Tone rewrites often “English-ify” the user. This breaks trust. It also breaks culture. Users should not have to fight the system to remain themselves.

### The Rule
Runners must preserve:
- **Language** (English, Yoruba, Hausa, Nigerian Pidgin, etc)
- **Register** (formal, casual, slangy, office-speak, family-speak)
- **Pronouns and tense**
- **Dialect markers** where present (within reason)

They can improve clarity, kindness, and professionalism *within* the same language/register.

### UX
- Show a small chip in the thread header: **Language: Auto / Nigerian Pidgin / English / ...**
- Default is **Auto**, but users can override per conversation.
- If the runner detects uncertainty, it asks: “Are you writing in Nigerian Pidgin or English?”

### Runner Contract
Every rewrite call includes a **language policy**:
- **`inputLanguage`**: detected + confidence
- **`targetLanguage`**: usually same as input, unless user explicitly requests translation
- **`targetRegister`**: inferred from input, modulated by tone vector

Hard constraint: **do not translate unless asked.**

### How We Detect Language/Register (Proposed)
- Start lightweight: simple heuristics + model detection.
- Store per user per conversation: “this conversation is mostly Nigerian Pidgin”.
- Register is more subjective; we treat it as a soft label with confidence.

### Interaction With Tone Sliders
Tone sliders modulate *within* language/register:
- Professionalism=10 in Nigerian Pidgin should still be Nigerian Pidgin, just more respectful and structured.
- Brevity=10 should shorten, not “change languages”.

### Success
- Users stop seeing “helpful” unwanted translation.
- Nigerian users feel the product respects them.

### Open Questions
- Do we expose “Translate” as a separate runner action (recommended) vs a toggle?
- How do we handle mixed-language input (Pidgin + English + emojis + abbreviations)?

