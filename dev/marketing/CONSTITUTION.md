# Ruwt Marketing Constitution

This document defines Israel's core beliefs and worldview. All marketing content, posts, and outreach must align with these principles. If a post contradicts something here, don't publish it.

---

We can be provocative and challenging without being negative. Asking hard questions is hopeful, not fearful.

## Core Beliefs

Understanding Algorithms and System design is still good. Fundamental computer science knowledge is still good. It just is not necessary to build MVPs of products when not at scale yet, and AI coding is an additional skill on top of that.

AI is a skill. Like any skill, people learn it best by practicing together, watching each other, and getting better over time — not by being scared into it.

The best way to get good at using AI is to practice in a community of people who are also trying to get good at it. Leaderboards are for inspiration, not intimidation.

## What Ruwt Stands For

Ruwt is for AI humanity.

Our mission is to help people get better at using AI, get discovered for being good at it, and get hired because of it. We are a community where:

- **People help each other get better at using AI.** Challenges, hints, replays, and shared strategies — not gatekeeping.
- **People who are good at AI get discovered.** Profiles, replays, and leaderboards make skill visible to employers and peers.
- **People get more jobs.** We connect developers who demonstrate real AI skill with companies that value it. Ruwt is a talent signal, not just a testing tool.
- **People learn how to use AI through practice, not pressure.** Hints, progressive difficulty, and community replays teach the craft — not just measure it.

## What We're Against

We're against using fear or outrage to drive marketing or attention.

We're against competitive framing that makes people feel bad about themselves. "Prove you're better than everyone" is zero-sum thinking — it attracts a small number of confident people and alienates everyone else. We don't want to be the platform that makes developers anxious. We want to be the platform that makes them better.

We're against gatekeeping AI skills. The point is not to separate the "good" from the "bad" — it's to help everyone improve and to make skill visible to people who want to hire.

## Tone & Voice

Hopeful, Empathetic, Direct, Truthful, Honest, Invitational

We sound like a friend who's good at something and wants to help you get good at it too. Not a drill sergeant. Not a hype machine. Not a gatekeeper.

## Lines We Won't Cross

- We don't trash other platforms. We don't exaggerate. We don't use countdown timers or fake scarcity.
- We don't use fear-based messaging. No "you'll be left behind," no "AI is coming for your job," no "prove you're not replaceable."
- We don't frame skill as a zero-sum competition. Leaderboards exist to inspire and to surface talent — not to make people feel inadequate.
- We don't gatekeep. Hints, replays, and learning resources are part of the product, not locked behind a paywall of shame.

## Target Audience (in your words)

- **Developers who want to get better at AI coding** — they're curious, they're practicing, they want to improve and be recognized for it.
- **Developers who want to be discovered** — they're skilled, they want their ability to be visible to employers without relying solely on resumes and networking.
- **Founders and hiring managers** — they want to find developers who are genuinely good at using AI, and they want signal they can trust.
- **People learning to vibe code** — they're new to AI-assisted development and want a supportive place to practice with hints and community.

## Key Phrases / Language

Never use this character: > when typing written posts, because then I have to remove it before copying and pasting the message as a post.

USE: 'come practice', 'come play', 'see where you stand', 'get discovered', 'get better together', 'learn by doing', 'your skills, visible', 'cheapest correct solution wins'

RETIRE: 'prove you're better than anyone', 'beat', 'compete against' (when framed as adversarial)

NEVER: 'you'll be left behind', 'prove you're not replaceable', 'don't get left out', 'revolutionize', 'disrupt', 'game-changer'

---

## Brand Evolution Note (2026-02-22)

We are deliberately moving away from competitive, fear-adjacent positioning ("Prove You Can Use AI Better Than Anyone") toward community-focused positioning. The old framing:
- Appeals to a narrow audience that's already confident
- Creates anxiety in the much larger audience that's still learning
- Invites backlash ("who are you to judge?")
- Doesn't reflect what we actually believe

The new framing centers on:
- **Community** — people helping each other improve
- **Discoverability** — making AI skill visible to employers
- **Jobs** — connecting skilled developers with companies
- **Learning** — hints, replays, and progressive challenges that teach

This is not a soft pivot. Leaderboards, cost efficiency, and real challenges stay. We're changing the *why*, not the *what*. The product still measures real skill. The difference is we frame it as "get better and get noticed" instead of "prove you're the best."

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

*Last updated: 2026-02-23*
