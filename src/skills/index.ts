// ── Skills-laag (Fase 7 van de Nous-parity) ───────────────────────────────────
// agentskills.io-compatibele skills: herbruikbare capability-bestanden (SKILL.md met
// frontmatter) die Hermes ontdekt, als slash-command kan aanroepen, zelf kan aanmaken
// (autonomous skill creation) en uit een Skills Hub kan installeren.
//
// Formaat (open standaard, ook wat Claude Code gebruikt):
//   ---
//   name: mijn-skill
//   description: wat het doet
//   version: 1.0
//   ---
//   # instructies / procedurele kennis…
//
// Een skill is óf `<dir>/<naam>.md` óf `<dir>/<naam>/SKILL.md`. Fail-safe: kan een dir
// niet gelezen worden, dan degraderen we naar een lege lijst.

import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface Skill {
  name: string;
  description: string;
  version?: string;
  /** De instructie-body (alles na de frontmatter). */
  body: string;
  /** Pad op schijf. */
  path: string;
}

/** Skills-mappen: env-override → ~/.hermes/skills → project .hermes/skills → bundled skills/. */
function skillDirs(): string[] {
  const dirs = [
    process.env.HERMES_SKILLS_DIR,
    join(homedir(), ".hermes", "skills"),
    join(process.cwd(), ".hermes", "skills"),
    join(process.cwd(), "skills"), // skills bundled with the repo
  ].filter((d): d is string => !!d);
  return [...new Set(dirs)];
}

/** Primaire schrijf-map voor nieuwe/geïnstalleerde skills. */
function primaryDir(): string {
  return process.env.HERMES_SKILLS_DIR || join(homedir(), ".hermes", "skills");
}

/** Minimale frontmatter-parser (geen YAML-dep nodig). */
function parseSkillFile(raw: string, fallbackName: string, path: string): Skill {
  let name = fallbackName;
  let description = "";
  let version: string | undefined;
  let body = raw;
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (m) {
    body = m[2] ?? "";
    for (const line of m[1]!.split("\n")) {
      const kv = line.match(/^(\w+)\s*:\s*(.+)$/);
      if (!kv) continue;
      const key = kv[1]!.toLowerCase();
      const val = kv[2]!.trim().replace(/^["']|["']$/g, "");
      if (key === "name") name = val;
      else if (key === "description") description = val;
      else if (key === "version") version = val;
    }
  }
  return { name, description, version, body: body.trim(), path };
}

/** Ontdek + parse alle skills. */
export function listSkills(): Skill[] {
  const found: Skill[] = [];
  const seen = new Set<string>();
  for (const dir of skillDirs()) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.toLowerCase() === "readme.md") continue; // not a skill
      const full = join(dir, entry);
      try {
        const st = statSync(full);
        let file: string | null = null;
        let fallback = entry;
        if (st.isDirectory()) {
          const skillMd = join(full, "SKILL.md");
          if (existsSync(skillMd)) file = skillMd;
        } else if (entry.endsWith(".md")) {
          file = full;
          fallback = entry.replace(/\.md$/, "");
        }
        if (!file) continue;
        const skill = parseSkillFile(readFileSync(file, "utf-8"), fallback, file);
        if (seen.has(skill.name)) continue; // eerste map wint
        seen.add(skill.name);
        found.push(skill);
      } catch {
        /* skip onleesbare entry */
      }
    }
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

export function getSkill(name: string): Skill | null {
  const want = name.trim().toLowerCase();
  return listSkills().find((s) => s.name.toLowerCase() === want) ?? null;
}

export function searchSkills(query: string): Skill[] {
  const q = query.trim().toLowerCase();
  if (!q) return listSkills();
  return listSkills().filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
}

function slug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "skill";
}

/** Autonomous skill creation: schrijf een nieuwe SKILL.md naar de primaire skills-map. */
export function createSkill(name: string, description: string, body: string, version = "1.0"): Skill {
  const dir = primaryDir();
  const s = slug(name);
  const skillDir = join(dir, s);
  mkdirSync(skillDir, { recursive: true });
  const content = `---\nname: ${s}\ndescription: ${description.replace(/\n/g, " ").trim()}\nversion: ${version}\n---\n\n${body.trim()}\n`;
  const file = join(skillDir, "SKILL.md");
  writeFileSync(file, content, "utf-8");
  return parseSkillFile(content, s, file);
}

export interface InstallResult {
  ok: boolean;
  skill?: Skill;
  error?: string;
}

/**
 * Skills Hub-installer. Bronnen:
 *   - https://…/SKILL.md  (directe raw-url)
 *   - gh:owner/repo[/pad] (haalt SKILL.md uit een GitHub-repo via raw.githubusercontent.com)
 */
export async function installSkill(source: string): Promise<InstallResult> {
  try {
    let url = source.trim();
    let nameHint = "geinstalleerde-skill";
    if (url.startsWith("gh:")) {
      const rest = url.slice(3).replace(/^\/+/, "");
      const parts = rest.split("/");
      const owner = parts[0];
      const repo = parts[1];
      const path = parts.slice(2).join("/") || "SKILL.md";
      nameHint = repo || nameHint;
      url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
    } else {
      nameHint = url.split("/").slice(-2, -1)[0] || nameHint;
    }
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: `download faalde (HTTP ${res.status})` };
    const raw = await res.text();
    const parsed = parseSkillFile(raw, nameHint, "");
    const skill = createSkill(parsed.name, parsed.description, parsed.body, parsed.version);
    return { ok: true, skill };
  } catch (err) {
    return { ok: false, error: String((err as Error).message) };
  }
}

/**
 * Bouw de prompt-prefix voor een skill-aanroep (skill-name slash-command):
 * de skill-body als procedurele context vóór de taak van de gebruiker.
 */
export function skillInvocationPrompt(skill: Skill, task: string): string {
  return `# Actieve skill: ${skill.name}\n${skill.description}\n\n${skill.body}\n\n---\n# Taak\n${task}`;
}
