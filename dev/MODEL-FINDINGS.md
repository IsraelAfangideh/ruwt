# Model Findings

Observations of real model behavior discovered through QA and user sessions on ruwt.dev.
Each entry includes raw finding, root cause analysis, and suggested tooltip copy.

Use this to:
- Write blog posts about authentic AI behavior in the wild
- Inform in-product tooltips that warn users before they spend credits
- Track which models are suited to which challenge types

---

## Qwen2.5 Coder 32B (`@cf/qwen/qwen2.5-coder-32b-instruct`)

### Inline annotation artifact — drops tokens mid-expression

**Observed**: When fixing code, the model occasionally inserts `// Fixed here` (or similar
past-tense annotations) at the end of a line, dropping the token it was annotating. Example:

```
// Original:
while ((match = regex.exec(input)) !== null) {

// Model output:
while ((match = regex.exec(input)) !== ) { // Fixed here
```

**Root cause**: The model was heavily trained on code review data where inline change
annotations are common. When generating a REPLACE block, it simultaneously tries to
"write the fix" and "explain the fix" in the same token stream. Attention shifts to the
comment, and the original token (`null`) never gets emitted. The `)` that appears after
`!==` is the closing paren of the surrounding expression — the model jumped ahead to close
the structure after deciding to annotate.

**Implication**: This is a feature of the platform, not a bug. It tests whether the user
notices broken output and corrects their prompt. Users who catch it and respond with "the
null check got dropped, don't add inline comments to REPLACE blocks" recover quickly.
Users who don't notice spend credits in a broken loop.

**Tooltip copy**: *"Qwen2.5 Coder 32B sometimes annotates its own edits inline (e.g.
`// Fixed here`), which can drop tokens mid-expression. If you see a SyntaxError after
an edit, check for missing values next to inline comments."*

---

## Llama 3.1 8B (`@cf/meta/llama-3.1-8b-instruct`)

### Reaches for external tools instead of implementing algorithms

**Observed**: On the Expression Interpreter challenge (Impossible tier), Llama 3.1 8B
attempted to evaluate expressions using `child_process.exec()` — passing the expression
string to the shell — rather than implementing a parser.

```javascript
// Model output:
const { exec } = require('child_process');
exec(trimmedLine, (err, stdout) => { ... });
```

**Root cause**: The model recognised "evaluate an expression" as a task it could delegate
to the OS, rather than reason through algorithmically. This is a pattern from training
data where developers use shell exec as a quick shortcut. The model lacks the capacity
(at 8B parameters and 7968 token context) to plan and implement a recursive descent
parser in one shot.

**Implication**: Budget tier is genuinely not suited to complex algorithmic challenges.
This is useful signal for the platform — it validates that model selection is a real
skill, not a cosmetic choice.

**Tooltip copy**: *"Llama 3.1 8B works well for straightforward tasks but struggles with
multi-step algorithms. On parsing, graph, or tree challenges, it may attempt shortcuts
(like shelling out) rather than implementing the algorithm directly."*

---

### Context limit exhausted after 2 exchanges

**Observed**: Llama 3.1 8B has a 7968-token context window. On complex challenges, the
system prompt (challenge description + current code + test cases) consumes ~4000 tokens,
leaving room for only 1–2 exchanges before the context is full and the model returns a
413 error.

**Implication**: Users who write long prompts or paste error output verbatim will hit this
faster. Efficient users who ask concise, targeted questions extract more value per credit
from this model.

**Tooltip copy**: *"Llama 3.1 8B has a small context window (~8k tokens). Keep your
messages short and use `/clear` between major refactors to reset the context."*

---

## Qwen2.5 Coder 32B + Llama 3.3 70B (multiple models)

### Function renaming despite explicit interface

**Observed**: On the Expression Interpreter challenge, Qwen2.5 Coder 32B renamed the
required `evaluate()` function to `interpret()` in its first response. The judge harness
calls `evaluate()` specifically, so all tests returned undefined.

**Root cause**: The model saw "expression interpreter" in the challenge title and defaulted
to the semantically similar name `interpret`. Without strong grounding in the exact
required interface, models will use the name that "sounds right" to them.

**Implication**: Users who paste the full function signature in their prompt ("the function
must be named `evaluate`, not `interpret`") avoid this. Users who give vague prompts pay
for an extra round to rename it.

**Tooltip copy**: *"Always specify exact function names in your prompt. Models will use
semantically similar names if not told otherwise — and the judge requires exact matches."*

---

## General findings (model-agnostic)

### Multi-block SEARCH/REPLACE conflicts on complex refactors

**Observed**: On challenges requiring 4+ simultaneous code changes (adding a tokenizer,
parser, evaluator, and main function body), Mid and Premium tier models generate 7–19
SEARCH/REPLACE blocks in a single response. Blocks 2–N reference the original file state,
conflicting with changes already made by earlier blocks.

**Status**: Fixed in platform (truncate-at-first-block, sequential application with fresh
context per round).

**Blog angle**: "We observed AI coding assistants generating up to 19 simultaneous edits
in a single response. Here's why that's a problem and how sequential application with
fresh context changes the reliability picture."

---

### Models improve reliability significantly when given structured error output

**Observed** across multiple models and challenges: when test failure output is fed back
verbatim (input / expected / actual / error), models fix bugs in 1–2 rounds. When given
only "tests are failing", they guess and often make things worse.

**Implication**: The platform's agent loop (auto-run tests, inject structured results)
measurably improves model accuracy. This is a real platform advantage worth highlighting.

**Blog angle**: "The feedback loop matters as much as the model. Here's the data."

---

*Last updated: 2026-02-28. Add entries as new findings emerge during QA.*
