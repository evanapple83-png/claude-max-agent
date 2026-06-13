---
name: refactor
description: Improve the structure of code without changing its behavior.
version: 1.0
---

# Refactor

1. **Behavior must not change.** A refactor that alters output is a rewrite — say so explicitly if that's needed.
2. **Make sure there's a safety net** — tests, or a way to verify before/after behavior. If there are none, note the risk.
3. **One transformation at a time** — rename, extract, inline, dedupe — and verify after each. Don't mix a refactor with a feature change.
4. **Reduce, don't add.** Remove duplication, dead code, and needless abstraction. Don't introduce patterns the code doesn't need ("just in case").
5. **Keep diffs reviewable.** Smaller, focused changes over one giant reshuffle.
6. **Match the surrounding style** — naming, structure, idioms. Refactored code should look like it belongs.

After: state what you changed, why it's better, and how you confirmed behavior is unchanged.
