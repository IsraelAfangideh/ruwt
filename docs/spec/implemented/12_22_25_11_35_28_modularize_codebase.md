Modularize the Codebase to fit other runners

**Date**: December 22, 2025  
**Status**: Active  
**Extends**: N/A
**Author**: Israel Peter Thompson Afangideh

We currently have a few essential files such as ChatScreen, Chat Input, Message Bubble, ets. But these are very focused on our first runner, Rewrite. If we tried to add a second runner right now it may be difficult because we do not yet have good code organization.For example the Message Bubble currently has a button hardcoded Make Kinder, but we may have runners in the future that need a different refinement button. Action buttons that we cannot forsee now. Imagine if we had 29 more runners, what would these components look like?

We are moving to a Feature-Based structure. Each runner will inhabit its own directory and expose a uniform interface to ChatScreen.tsx. We prioritize Decoupling over DRY: shared dependencies will be limited to pure UI primitives to prevent cross-runner regressions.

### Example Problem
`MessageBubble.tsx` is hardcoded for the "Rewrite" runner (contains specific "Make Kinder" logic). Adding a second runner requires spaghetti `if/else` logic. Scaling to 30 runners is impossible with current architecture.

### The Solution: "Shell & Slot" Pattern
We will split the codebase into **UI Primitives (Shells)** and **Runner Modules (Logic)**.
* **Shells**: Dumb UI components. Shared styles. Zero business logic.
* **Runners**: Smart components. Contain specific buttons/actions. Import the Shell.

### New Directory Structure
Refactor `code/mobile/src` to isolate runners while keeping a shared design system.

```text
src/
├── components/          
│   └── ui/              <-- NEW: Pure UI (The Shells)
│       ├── BaseBubble.tsx    <-- Extracted styles from MessageBubble
│       └── BaseInput.tsx     <-- Extracted styles from ChatInput
├── runners/             <-- NEW: Feature Modules
    ├── index.ts
│   └── rewrite/         <-- Module 1
│       ├── RewriteBubble.tsx <-- Imports BaseBubble, injects "Make Kinder" buttons
│       └── RewriteInput.tsx 
└── screens/
    └── ChatScreen.tsx   <-- Selects component based on runner ID