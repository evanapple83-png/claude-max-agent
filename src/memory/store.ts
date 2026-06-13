// ── Hermes geheugen-store (Fase 3 van de Nous-parity) ─────────────────────────
// FTS5 sessie-zoek + user-profiel, bovenop node:sqlite (ingebouwd in Node 24 — geen
// externe dependency, geen native build). Vult de Obsidian-vault aan: Obsidian blijft
// het curatieve langetermijngeheugen, dit is de doorzoekbare ruwe gesprekshistorie
// (cross-session recall) + een gestructureerd user-profiel (USER.md-equivalent).
//
// ALLES is fail-safe: kan de DB niet openen of een query falen, dan degradeert elke
// functie naar een no-op/leeg resultaat. Het geheugen mag de fleet NOOIT breken.

import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".data");
const DB_PATH = join(DATA_DIR, "memory.db");

let db: DatabaseSync | null = null;
let initFailed = false;

/** Lazy singleton; faalt stil (geeft null) zodat callers nooit crashen. */
function getDb(): DatabaseSync | null {
  if (db) return db;
  if (initFailed) return null;
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    const d = new DatabaseSync(DB_PATH);
    d.exec("PRAGMA journal_mode = WAL");
    d.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS turns USING fts5(
         text,
         source UNINDEXED,
         role UNINDEXED,
         session_id UNINDEXED,
         ts UNINDEXED
       )`,
    );
    d.exec(
      `CREATE TABLE IF NOT EXISTS user_facts (
         key     TEXT PRIMARY KEY,
         value   TEXT NOT NULL,
         updated TEXT NOT NULL
       )`,
    );
    db = d;
    return db;
  } catch (err) {
    initFailed = true;
    console.error("[memory] kon DB niet openen (geheugen uit, fleet draait door):", String((err as Error)?.message).slice(0, 160));
    return null;
  }
}

/** Maak een veilige FTS5 MATCH-query: alleen woord-tokens, met OR verbonden (brede recall). */
function toMatchQuery(raw: string): string | null {
  const tokens = (raw.match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((t) => t.length >= 2)
    .slice(0, 24)
    .map((t) => `"${t}"`);
  return tokens.length ? tokens.join(" OR ") : null;
}

export interface TurnRecord {
  text: string;
  source: string; // "telegram:<key>", "tui", "http", "job:<name>", "runAgent"
  role: string; // "user" | "assistant" | "exchange"
  sessionId?: string;
  ts?: string; // ISO; caller levert 'm (geen Date.now() hier nodig)
}

/** Sla één turn op in de doorzoekbare historie. Fail-safe: faalt stil. */
export function recordTurn(rec: TurnRecord): void {
  const d = getDb();
  if (!d) return;
  const text = (rec.text ?? "").trim();
  if (!text) return;
  try {
    d.prepare("INSERT INTO turns(text, source, role, session_id, ts) VALUES (?, ?, ?, ?, ?)").run(
      text.slice(0, 20_000),
      rec.source,
      rec.role,
      rec.sessionId ?? "",
      rec.ts ?? new Date().toISOString(),
    );
  } catch {
    /* geheugen-write mag nooit een reply blokkeren */
  }
}

export interface SearchHit {
  text: string;
  source: string;
  role: string;
  sessionId: string;
  ts: string;
  rank: number;
}

/** FTS5 ranked zoek door alle eerdere turns. Leeg resultaat bij geen match/fout. */
export function searchTurns(query: string, limit = 8): SearchHit[] {
  const d = getDb();
  if (!d) return [];
  const match = toMatchQuery(query);
  if (!match) return [];
  try {
    const rows = d
      .prepare(
        `SELECT text, source, role, session_id AS sessionId, ts, rank
           FROM turns WHERE turns MATCH ? ORDER BY rank LIMIT ?`,
      )
      .all(match, limit) as unknown as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      text: String(r.text ?? ""),
      source: String(r.source ?? ""),
      role: String(r.role ?? ""),
      sessionId: String(r.sessionId ?? ""),
      ts: String(r.ts ?? ""),
      rank: Number(r.rank ?? 0),
    }));
  } catch {
    return [];
  }
}

/**
 * Een geformatteerd recall-blok van relevante eerdere gesprekken, klaar om vóór een
 * prompt te plakken (cross-session recall). Leeg als er niets relevants is.
 */
export function recallBlock(query: string, limit = 4): string {
  const hits = searchTurns(query, limit);
  if (!hits.length) return "";
  const lines = hits.map((h) => {
    const when = h.ts ? h.ts.slice(0, 10) : "?";
    return `- (${when}, ${h.source}) ${h.text.slice(0, 400).replace(/\s+/g, " ").trim()}`;
  });
  return `# Relevante eerdere context (uit het geheugen — gebruik alleen als het klopt)\n${lines.join("\n")}`;
}

// ── User-profiel (USER.md-equivalent / Honcho-light) ──────────────────────────

export function upsertUserFact(key: string, value: string, ts?: string): void {
  const d = getDb();
  if (!d) return;
  const k = key.trim().toLowerCase().slice(0, 80);
  if (!k) return;
  try {
    d.prepare(
      `INSERT INTO user_facts(key, value, updated) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated = excluded.updated`,
    ).run(k, value.trim().slice(0, 2_000), ts ?? new Date().toISOString());
  } catch {
    /* fail-safe */
  }
}

export function deleteUserFact(key: string): boolean {
  const d = getDb();
  if (!d) return false;
  try {
    const res = d.prepare("DELETE FROM user_facts WHERE key = ?").run(key.trim().toLowerCase());
    return Number(res.changes) > 0;
  } catch {
    return false;
  }
}

export interface UserFact {
  key: string;
  value: string;
  updated: string;
}

export function listUserFacts(): UserFact[] {
  const d = getDb();
  if (!d) return [];
  try {
    const rows = d.prepare("SELECT key, value, updated FROM user_facts ORDER BY key").all() as unknown as Array<Record<string, unknown>>;
    return rows.map((r) => ({ key: String(r.key), value: String(r.value), updated: String(r.updated) }));
  } catch {
    return [];
  }
}

/** Render het profiel als USER.md-markdown (voor weergave of prompt-injectie). */
export function userProfileMarkdown(): string {
  const facts = listUserFacts();
  if (!facts.length) return "";
  return `# Wat Hermes over de gebruiker weet\n${facts.map((f) => `- **${f.key}**: ${f.value}`).join("\n")}`;
}

export interface MemoryStats {
  turns: number;
  facts: number;
  ok: boolean;
}

export function memoryStats(): MemoryStats {
  const d = getDb();
  if (!d) return { turns: 0, facts: 0, ok: false };
  try {
    const t = d.prepare("SELECT count(*) AS n FROM turns").get() as { n?: number };
    const f = d.prepare("SELECT count(*) AS n FROM user_facts").get() as { n?: number };
    return { turns: Number(t?.n ?? 0), facts: Number(f?.n ?? 0), ok: true };
  } catch {
    return { turns: 0, facts: 0, ok: false };
  }
}
