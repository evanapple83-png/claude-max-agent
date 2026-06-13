---
name: pr-description
description: Write a clear pull-request description that makes review easy.
version: 1.0
---

# PR description

Structure:

1. **What & why** — one or two sentences: what this PR does and the problem it solves. Link the issue.
2. **Changes** — a short bullet list of the meaningful changes (not a file-by-file dump).
3. **How to test / verify** — concrete steps the reviewer can follow, or the tests that cover it.
4. **Screenshots / output** — for UI or visible behavior, before/after.
5. **Risk & rollout** — anything risky, breaking, or needing a migration/feature-flag; how to roll back.
6. **Notes for reviewers** — call out the parts that need the most scrutiny, and any deliberate trade-offs.

Rules:
- Keep it scannable — a reviewer should grasp the change in 30 seconds.
- Describe what the diff actually does; don't overclaim.
- One logical change per PR. If it does several unrelated things, say so and suggest splitting.
