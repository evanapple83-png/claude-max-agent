# Bundled skills

Generic, ready-to-use skills that ship with the agent. They're discovered automatically
(this `skills/` folder is on the load path), so `/skills` is populated out of the box.

A **skill** is a `SKILL.md`-style file: frontmatter (`name`, `description`, `version`) plus
a body of procedural instructions. When you invoke a skill, its body is prepended to your
task as expert context — turning the general agent into a specialist for that one job.

## Included

| Skill | What it does |
|---|---|
| `deep-research` | Multi-source, cited, verified research |
| `summarize` | Faithful, structured summaries |
| `code-review` | Review a change for bugs + quality |
| `debug` | Systematic root-cause debugging |
| `write-email` | Clear, reply-getting emails |
| `proofread` | Light editing without changing meaning |
| `explain-code` | Explain a file/codebase |
| `commit-message` | Conventional commit messages from a diff |
| `extract-data` | Unstructured text → clean JSON |
| `refactor` | Behavior-preserving cleanup |
| `meeting-notes` | Raw notes → decisions + action items |
| `plan-task` | Break a goal into a verifiable plan |

## Using them

- **Terminal UI:** `npm run tui`, then `/skills` to list, `/<skill-name> <task>` to invoke.
- **HTTP API:** `GET /api/skills`, `GET /api/skills/:name`.

## Adding your own

- Drop a `<name>.md` (or `<name>/SKILL.md`) here, or in `~/.hermes/skills`, or set `HERMES_SKILLS_DIR`.
- Create one from the TUI: `/skill-new name | description | body`.
- Install from a URL or GitHub: `/skill-install <url>` or `/skill-install gh:owner/repo`.

Skills you create or install are written to `~/.hermes/skills` (writable); this bundled folder is read-only reference.
