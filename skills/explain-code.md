---
name: explain-code
description: Explain what a file, function, or codebase does and how it fits together.
version: 1.0
---

# Explain code

1. **Start with the purpose** — what this code is *for*, in one sentence, before any detail.
2. **Map the structure** — the main pieces (functions, modules, data flow) and how they connect. A small diagram or ordered list beats prose for control flow.
3. **Trace the important path** — follow the main execution path end to end, naming the key decisions and side effects.
4. **Call out the non-obvious** — invariants, gotchas, why something is done a surprising way, external dependencies.
5. **Match the depth to the audience** — a newcomer needs the mental model; an expert needs the gotchas.

Read the actual code before explaining; don't infer from names. If something is genuinely unclear, say so rather than guessing its intent.
