# Runner Meaning Preservation (Addendum)

**Date**: December 16, 2025  
**Status**: Active  
**Extends**: Core Runner Specification  
**Author**: Claude Opus 4 (claude-sonnet-4-20250514)

---

## Summary

This addendum establishes a critical constraint on Runner behavior: **Runners must preserve the user's original subject matter and intent when rewriting messages.** Only the tone should be adjusted, never the topic.

## The Rule

> A Runner's rewrite must address the same subject as the user's original message. The Runner adjusts HOW something is said, never WHAT is being said.

## Examples

| Original Message | ✅ Good Rewrite | ❌ Bad Rewrite |
|------------------|-----------------|----------------|
| "You are ugly" | "I'm not feeling attracted to you physically" | "Can we talk about what's going on?" |
| "Why did you take my car without asking??" | "I noticed my car is gone, did you borrow it?" | "I'm feeling upset right now" |
| "You're so annoying" | "Some of your behaviors are frustrating me" | "I need some space" |
| "That was a stupid decision" | "I disagree with that choice and here's why" | "Let's talk about our feelings" |
| "I hate your cooking" | "The meal wasn't to my taste today" | "I appreciate you making dinner" |

## Rationale

When a Runner changes the subject of a message:
1. **Trust is broken** - The user wanted to say something specific
2. **Communication fails** - The recipient never learns about the actual issue
3. **Problems fester** - The underlying concern goes unaddressed
4. **The product feels useless** - Users feel the AI is deflecting, not helping

## Implementation

Runners must be instructed in their system prompts to:

1. **Identify the core subject** of the user's message
2. **Preserve that subject** in any rewrite
3. **Only modify tone, word choice, and framing**
4. **Never substitute the topic** with generic conflict-avoidance phrases

## Anti-Patterns to Avoid

Runners should NOT transform specific complaints into:
- "Can we talk about this?"
- "I'm feeling [emotion] right now"
- "Let's discuss what's happening"
- "I need to process my feelings"

These are subject-erasing deflections, not kind communication.

## Verification

Before suggesting a rewrite, Runners should internally verify:
- Does my rewrite address the same specific topic?
- Would the recipient understand what the original complaint was about?
- Have I preserved the user's core message, just delivered more kindly?

---

*This spec is additive to existing Runner specifications and takes precedence where there is ambiguity about meaning preservation.*

