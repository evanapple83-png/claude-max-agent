---
name: regex
description: Write and explain regular expressions that are correct and maintainable.
version: 1.0
---

# Regex

1. **Pin down the spec** — exactly what should match and, just as important, what should *not*. Gather real examples of both before writing.
2. **Build incrementally** and test against the examples as you go. A regex that "looks right" is usually wrong on an edge case.
3. **Anchor when you mean it** (`^...$`), escape literals (`.` `(` `?` etc.), and be explicit about character classes.
4. **Prefer clarity over cleverness:** named groups `(?<year>\d{4})`, non-capturing groups `(?:...)` where you don't need the capture, and the `x`/verbose flag with comments for anything complex.
5. **Watch for catastrophic backtracking** — nested quantifiers on overlapping patterns (`(a+)+`) can hang on adversarial input. Prefer specific, possessive, or atomic constructs; avoid `.*` soup.
6. **Mind the flavor.** PCRE, JavaScript, Python, POSIX differ (lookbehind, `\d` unicode, flags). Write for the actual engine.
7. **Know when not to.** For nested/recursive structures (HTML, JSON, balanced parens) use a real parser, not regex.

Always explain what the pattern does, group by group, and show it matching the positive examples and rejecting the negatives.
