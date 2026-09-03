# Ruwt Marketing Constitution

This document defines Israel's core beliefs and worldview. All marketing content, posts, and outreach must align with these principles. If a post contradicts something here, don't publish it.

---

We can be provocative and challenging without being negative. Asking hard questions is hopeful, not fearful.

## Core Beliefs

Understanding Algorithms and System design is still good. Fundamental computer science knowledge is still good. It just is not necessary to build MVPs of products when not at scale yet, and AI coding is an additional skill on top of that.

## What Ruwt Stands For

Ruwt is for AI humanity.

## What We're Against

We're against using fear or outrage to drive marketing or attention.

## Tone & Voice

Hopeful, Empathetic, Direct, Truthful, Honest

## Lines We Won't Cross

We don't trash other platforms. We don't exaggerate. We don't use countdown timers or fake scarcity.

## Target Audience (in your words)

Developers, Founders who want to hire, People who want to learn how to vibe code

## Key Phrases / Language

Never use this character: > when typing written posts, because then I have to remove it before copying and pasting the message as a post.

USE: 'come play', 'come see where you rank', 'prove it', 'cheapest correct solution wins', 'prove you're not replaceable' (Versus only)

NEVER: 'you'll be left behind', 'don't get left out', 'revolutionize', 'disrupt', 'game-changer'

Versus is a race, not a eulogy. Losing copy can be pointed ('that model just took your puzzle'). Do not turn a loss into a verdict on the person's career. Winning copy stays short ('still here'). Keep the other fear lines banned. No fake scarcity.

---

## Challenge Design Guidelines

### Core Principle: Never Punish the User for Platform Issues

If a user fails a challenge, it must be because they don't understand the problem or their AI model isn't capable enough — NEVER because of test harness quirks, input parsing issues, or platform bugs. The user should never need to know how our test runner works internally.

### Difficulty Contract

- **Easy + Premium model** = should pass comfortably. The game is "can you solve it cheaper?"
- **Easy + Mid model** = doable with some user engineering skill
- **Easy + Micro model** = proves real engineering chops — the user deeply understands the problem and guides a weaker model
- **Medium + Premium model** = requires user skill to prompt and iterate effectively
- **Hard** = where even premium models need a skilled human partner

The progression is: first solve it, then solve it cheaper. Not: struggle to solve it at all.

### Technical Requirements

1. **Class-based challenges MUST have test harnesses** — the generic harness calls functions without `new`, which breaks ES6 classes. Write a `solve()` dispatch function that instantiates classes properly.
2. **Complex input formats MUST have test harnesses** — if inputs are command sequences (like "put 1 10", "get 1"), test scenario names, or anything beyond simple JSON-parseable args, write a `solve()` function that parses them.
3. **Iterable/generator returns need harnesses** — the generic harness JSON.stringifies results, which gives `{}` for iterables. Wrap with `Array.from()`.
4. **Test harnesses are server-side only** — never exposed to users or AI chat.
5. **Bug comments in starter code are for AI, not the user** — the description tells the user what's broken; the comments in code help AI models locate the bugs efficiently.

### QA Checklist (before adding any challenge)

- Does the starter code export a class? Add a test harness with `new`.
- Does input require command parsing (multi-step operations)? Add a test harness.
- Does the return value need transformation (iterables, custom objects)? Add a test harness.
- Does the challenge's input format match what `buildTestCode()` in judge.ts expects?

---

*Last updated: 2026-08-29*
