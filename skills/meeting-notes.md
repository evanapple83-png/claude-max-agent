---
name: meeting-notes
description: Turn raw notes or a transcript into clean, structured meeting notes.
version: 1.0
---

# Meeting notes

Structure the output as:

1. **TL;DR** — 1-2 sentences: what was decided / what matters.
2. **Decisions** — each decision as a single clear statement.
3. **Action items** — `- [ ] owner — task — due date` (capture owner and deadline whenever stated).
4. **Discussion** — key points and context, grouped by topic, only what's worth remembering.
5. **Open questions / parking lot** — unresolved items.

Rules:
- **Extract, don't invent.** Only include what was actually said. Mark anything inferred.
- **Attribute decisions and actions to a person** when the source names one.
- Drop chit-chat and repetition. Keep numbers, dates, names, and commitments.
- If owners or due dates are missing for an action, leave them blank rather than guessing.
