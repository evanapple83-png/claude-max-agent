---
name: changelog
description: Generate a clear, user-facing changelog from commits or a diff.
version: 1.0
---

# Changelog

1. **Write for the reader, not the committer.** Describe what changed from the *user's* perspective, not the internal mechanics. "Fixed crash when opening large files" beats "patched null deref in parser".
2. **Group by type:** Added, Changed, Fixed, Removed, Deprecated, Security (Keep a Changelog style).
3. **One entry per meaningful change.** Merge noise (typo fixes, internal refactors) or omit it; surface what users will notice.
4. **Lead with impact.** Each line: what changed and why it matters. Link to issues/PRs if available.
5. **Call out breaking changes loudly** with a clear heading and migration note.
6. **Version and date** the entry; use semver if the project does.

Don't invent changes that aren't in the source. If a commit's intent is unclear, say so rather than guessing user impact.
