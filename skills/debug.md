---
name: debug
description: Systematically diagnose and fix a bug instead of guessing.
version: 1.0
---

# Debug

1. **Reproduce it.** Find the smallest reliable way to trigger the bug. If you can't reproduce, you can't confirm a fix.
2. **Read the actual error** — full message, stack trace, and the line it points to. Don't skim it.
3. **Form one hypothesis** about the root cause and state it explicitly.
4. **Test the hypothesis cheaply** — add a log, inspect a value, check an assumption — before changing code.
5. **Fix the root cause, not the symptom.** A try/catch that hides the error is not a fix.
6. **Verify** the fix actually resolves the reproduction, and check you didn't break an adjacent case.
7. **Report honestly:** what was wrong, why, what you changed, and how you verified it. If a test fails, say so with the output.

When stuck, narrow the search space by bisection: confirm what *does* work, then move toward what doesn't.
