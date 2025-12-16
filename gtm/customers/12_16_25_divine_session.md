# Customer Feedback Session: Divine

**Date**: December 16, 2025  
**Participant**: Divine  
**Platform**: iOS (TestFlight)  
**Session Duration**: ~25 minutes

---

## Context

First live demo of Ruwt with the Peacemaker runner on TestFlight. Divine tested the app's core message rewriting functionality.

## Test Scenarios

### Scenario 1: Accusatory Message
**Input**: "Why would you take my car without asking??"

**AI Response**: "This message is very accusatory. Let's try to keep it more inquisitive to avoid putting the recipient on the defensive."

**Rewrite Offered**: "I noticed my car is gone, do you know anything about that?"

**User Action**: Requested "Make it more natural"

**Second Rewrite**: "I noticed my car is gone, did you happen to borrow it?"

### Scenario 2: Direct Insult
**Input**: "Why are you so annoying and ugly?"

**AI Response**: "That's pretty harsh! When we're upset, it's easy to lash out, but let's try to express the feelings without the insults."

**Rewrite Offered**: "I'm feeling really frustrated and hurt right now. Can we talk about what's going on?"

### Scenario 3: Simple Insult
**Input**: "Youre ugly"

**Result**: Message was sent directly (marked as [SENT])

---

## Issues Identified

### 1. [SENT] Bug (Critical)
The `[SENT]` indicator appeared automatically when the AI approved a message, without the user clicking "Send This". This is confusing UX—users should explicitly confirm before any message is sent.

**Expected**: `[SENT]` only appears after user clicks "Send This" button.

### 2. Meaning Not Preserved (High)
When rewriting "Why are you so annoying and ugly?", the AI changed the subject entirely:
- **Original intent**: Comment about appearance/annoyance
- **Rewrite**: "Can we talk about what's going on?" (completely different topic)

**Expected**: Preserve the user's subject matter, only adjust tone. A better rewrite might be: "I'm finding your behavior frustrating, and honestly I'm not attracted to how you're presenting yourself right now."

### 3. Unnatural Responses (Medium)
Divine noted that the runner's explanations felt stilted and formulaic. The tone was "too therapist-y" rather than conversational.

---

## Positive Feedback

- Core concept resonated—Divine understood the value proposition
- UI was clean and easy to navigate
- "Make Kinder" button was intuitive
- App performance was smooth

---

## Screenshots

*(To be added manually from TestFlight session)*

---

## Next Steps

1. Fix [SENT] bug in ChatScreen.tsx
2. Update Peacemaker system prompt to enforce meaning preservation
3. Consider making runner responses more conversational

