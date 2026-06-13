---
name: readme-writer
description: Write a README that gets someone from "what is this" to "it works" fast.
version: 1.0
---

# README writer

Order it the way a newcomer reads:

1. **One-line description** — what it is and who it's for, above the fold.
2. **What it does** — a few sentences or bullets on the value, optionally a small diagram or screenshot.
3. **Quick start** — the shortest path to a working result: prerequisites, install, minimum config, run. Copy-pasteable commands that actually work.
4. **Usage** — the common things people will do, with examples.
5. **Configuration** — options/env vars, in a table, with defaults.
6. **How it works / architecture** — only as much as a contributor needs.
7. **Caveats, security notes, license.**

Rules:
- **Lead with the user's goal, not the project's history.** Nobody reads the philosophy before the install.
- Every command should be runnable as written. Test them.
- Be honest about limitations and prerequisites up front — don't let people discover them at step 7.
- Keep it current: a README that lies is worse than none.
