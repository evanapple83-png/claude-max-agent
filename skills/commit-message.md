---
name: commit-message
description: Write a clear, conventional git commit message from a diff.
version: 1.0
---

# Commit message

1. **Read the diff** and identify the *intent* of the change, not just the mechanics.
2. **Subject line:** imperative mood, ≤ 72 chars, no trailing period. Optionally a Conventional Commits prefix (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
   - Good: `fix: prevent crash when config file is missing`
   - Bad: `fixed stuff`, `Update index.ts`
3. **Body (when the change isn't trivial):** explain *why*, not *what* — the diff already shows what. Wrap at ~72 chars. Note any breaking changes or follow-ups.
4. **One logical change per commit.** If the diff does two unrelated things, say so and suggest splitting.

Output just the commit message, ready to paste. Don't claim the change does more than the diff actually shows.
