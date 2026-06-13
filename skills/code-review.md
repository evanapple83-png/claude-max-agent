---
name: code-review
description: Review a code change or file for correctness bugs and quality issues.
version: 1.0
---

# Code review

Review in two passes.

**Pass 1 — correctness (the priority).** Look for things that are actually wrong:
- Logic errors, off-by-one, wrong operators, inverted conditions.
- Unhandled errors, null/undefined, empty collections, boundary cases.
- Race conditions, missing `await`, resource leaks (unclosed handles, listeners).
- Security: injection, path traversal, secrets in code, missing auth checks, unsafe input.
- Broken invariants the surrounding code relies on.

**Pass 2 — quality (secondary).** Reuse, simplification, naming, dead code, duplication.

Rules:
- **Report every real finding with file:line, the problem, and a concrete fix.** Include a confidence and severity for each.
- Don't invent issues to seem thorough. If the code is fine, say so.
- Don't rewrite style to taste — flag substance, not preference.
- Verify a finding before reporting it; trace the actual data flow rather than pattern-matching.
