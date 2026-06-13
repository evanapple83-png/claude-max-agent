---
name: self-learning
description: Turn a successful, novel task into a reusable skill — so the agent gets more capable over time. Gated on verification.
version: 1.0
---

# Self-learning (write your own skills)

After you finish a task, consider whether the *procedure* you just worked out is worth keeping. If so, distil it into a new skill so next time is one shot.

## When to create a skill

Create one only when ALL of these hold:
1. **It succeeded and you can verify it did** — tests passed, output was confirmed correct, the user accepted it. Never distil a guess or an unverified result; a wrong skill is worse than no skill.
2. **It's reusable** — the same procedure will plausibly come up again, not a one-off.
3. **It's general** — strip the specific names, paths, and values from this run; keep the method. A skill is procedure, not a transcript.
4. **It isn't already covered** — check existing skills first (don't duplicate; improve the existing one instead if close).

## How

Write a `SKILL.md` to the skills directory (default `~/.hermes/skills/<name>/SKILL.md`, or `$HERMES_SKILLS_DIR`). Format:

```
---
name: <kebab-case>
description: <one line — what it does and when to use it>
version: 1.0
---

# <Title>
<concise, ordered procedural instructions — the method, not the example>
```

Keep it tight and prescriptive: the steps, the gotchas you hit, and the verification you used. If you're improving an existing skill, bump its version and note what changed.

## Don't

- Don't create skills for trivial tasks the base agent already does well.
- Don't include secrets, personal data, client names, or run-specific values.
- Don't accumulate near-duplicates — consolidate.
