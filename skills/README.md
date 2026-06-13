# Bundled skills

Generic, ready-to-use skills that ship with the agent. They're discovered automatically
(this `skills/` folder is on the load path), so `/skills` is populated out of the box.

A **skill** is a `SKILL.md`-style file: frontmatter (`name`, `description`, `version`) plus
a body of procedural instructions. When you invoke a skill, its body is prepended to your
task as expert context — turning the general agent into a specialist for that one job.

All of these are **original, generic** skills (best-practice methods written for this repo).
They don't include any proprietary or third-party skill content.

## Included (32)

### Design & frontend
| Skill | What it does |
|---|---|
| `design-orchestrator` | Master router for any UI build — pick one direction, enforce an anti-slop + a11y floor, govern motion |
| `design-minimal` | Director: calm, editorial, content-first |
| `design-premium` | Director: high-end, spacious, crafted |
| `design-brutalist` | Director: raw, dense, technical |
| `design-motion` | Tasteful motion & micro-interaction principles |
| `frontend-build` | Semantic, accessible, responsive, fast implementation |
| `accessibility-audit` | Audit a UI against WCAG with concrete fixes |

### Engineering
| Skill | What it does |
|---|---|
| `code-review` · `debug` · `refactor` · `test-writing` | Review, diagnose, restructure, and test code |
| `security-review` | Find common vulnerabilities (defensive) |
| `api-design` · `sql-query` · `regex` | Design APIs, write SQL, write regex |
| `commit-message` · `pr-description` · `changelog` | Git hygiene & release notes |
| `explain-code` | Explain a file or codebase |

### Writing & comms
| Skill | What it does |
|---|---|
| `write-email` · `proofread` · `translate` | Draft, polish, and translate text |
| `technical-writing` · `readme-writer` | Docs, guides, and READMEs |
| `summarize` · `meeting-notes` · `extract-data` | Condense and structure information |

### Research, thinking & meta
| Skill | What it does |
|---|---|
| `deep-research` | Multi-source, cited, verified research |
| `plan-task` | Break a goal into a verifiable plan |
| `prompt-writing` | Write effective LLM prompts |
| `self-learning` | Distil a successful task into a new skill (verification-gated) |
| `safety` | Operating principles for an agent with shell/file/web access |

## Using them

- **Terminal UI:** `npm run tui`, then `/skills` to list, `/<skill-name> <task>` to invoke.
- **HTTP API:** `GET /api/skills`, `GET /api/skills/:name`.

## Adding your own

- Drop a `<name>.md` (or `<name>/SKILL.md`) here, or in `~/.hermes/skills`, or set `HERMES_SKILLS_DIR`.
- Create one from the TUI: `/skill-new name | description | body`.
- Install from a URL or GitHub: `/skill-install <url>` or `/skill-install gh:owner/repo`.
- Or let the agent author its own — see the `self-learning` skill.

Skills you create or install are written to `~/.hermes/skills` (writable); this bundled folder is read-only reference.
