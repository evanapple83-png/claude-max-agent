// ── Hermes HTTP-API (Fase 1 van de Nous-parity) ───────────────────────────────
// Een OpenAI-compatibele ingang bovenop dezelfde Claude-backend (runAgent) die de
// Telegram-fleet gebruikt. Puur additief: deze server boot ALLEEN als HERMES_HTTP_PORT
// gezet is, dus de bestaande daemon verandert niets tot je 'm bewust aanzet.
//
// Routes (1-op-1 met de Nous Hermes Agent):
//   GET  /health                  → liveness
//   GET  /v1/models               → het actieve Claude-model (Max-sub)
//   POST /v1/chat/completions      → OpenAI-compatibel; stream:true geeft SSE-deltas
//   GET  /api/jobs                 → alle geregistreerde cron-jobs (jobsSnapshot)
//   POST /api/jobs/:name/run       → trigger één job nu
//
// Auth: Bearer-token (HERMES_API_TOKEN), timing-safe vergeleken. Zonder token weigert
// de server elke niet-/health request — net als de auth-gate op de Telegram-bots.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { runAgent } from "../claude.js";
import { config } from "../config.js";
import { jobsSnapshot, triggerJob } from "../jobs.js";
import { searchTurns, listUserFacts, upsertUserFact, memoryStats } from "../memory/store.js";
import { browse } from "../browser/index.js";
import { listSkills, getSkill, installSkill } from "../skills/index.js";
import { UI_HTML } from "./ui.js";

const MODEL_ID = process.env.HERMES_MODEL || "hermes-claude-max";
const MAX_BODY = 256 * 1024; // 256 KB request-limiet (hardening, net als Nous)

/** Timing-safe Bearer-check tegen HERMES_API_TOKEN. */
function authorized(req: IncomingMessage): boolean {
  const expected = process.env.HERMES_API_TOKEN?.trim();
  if (!expected) return false; // geen token geconfigureerd → API dicht (behalve /health)
  const header = req.headers["authorization"];
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const got = Buffer.from(header.slice(7).trim());
  const want = Buffer.from(expected);
  return got.length === want.length && timingSafeEqual(got, want);
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
    "access-control-allow-origin": "*",
  });
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | string;
  content: string;
}

/** Vouw een OpenAI messages-array tot één prompt (stateless, behoudt context). */
function foldMessages(messages: ChatMessage[]): { userText: string; persona?: string } {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n").trim();
  const convo = messages.filter((m) => m.role !== "system");
  // Laatste turn = de eigenlijke vraag; eerdere turns als transcript voor context.
  const transcript = convo
    .map((m) => (m.role === "assistant" ? `Assistant: ${m.content}` : `User: ${m.content}`))
    .join("\n");
  return { userText: transcript || "(leeg)", persona: system || undefined };
}

function chatCompletionObject(id: string, created: number, text: string, sessionId?: string): unknown {
  return {
    id,
    object: "chat.completion",
    created,
    model: MODEL_ID,
    session_id: sessionId, // Hermes-extensie: voor gesprekscontinuïteit (GUI/clients geven 'm terug mee)
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

async function handleChatCompletions(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: { messages?: ChatMessage[]; stream?: boolean; session_id?: string };
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    json(res, 400, { error: { message: "invalid JSON body", type: "invalid_request_error" } });
    return;
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    json(res, 400, { error: { message: "messages[] required", type: "invalid_request_error" } });
    return;
  }
  const { userText, persona } = foldMessages(messages);
  const id = `chatcmpl-${randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);

  // ── Streaming (SSE) ──
  if (body.stream) {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "access-control-allow-origin": "*",
    });
    let last = "";
    const send = (delta: string) => {
      const evt = {
        id,
        object: "chat.completion.chunk",
        created,
        model: MODEL_ID,
        choices: [{ index: 0, delta: { content: delta }, finish_reason: null }],
      };
      res.write(`data: ${JSON.stringify(evt)}\n\n`);
    };
    try {
      const result = await runAgent({
        userText,
        sessionId: body.session_id,
        persona,
        onText: (full) => {
          if (full.length > last.length) {
            send(full.slice(last.length));
            last = full;
          }
        },
      });
      if (result.text.length > last.length) send(result.text.slice(last.length));
      const done = {
        id,
        object: "chat.completion.chunk",
        created,
        model: MODEL_ID,
        session_id: result.sessionId, // GUI/clients geven 'm terug mee voor continuïteit
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      };
      res.write(`data: ${JSON.stringify(done)}\n\n`);
      res.write("data: [DONE]\n\n");
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: { message: String((err as Error).message) } })}\n\n`);
    }
    res.end();
    return;
  }

  // ── Non-streaming ──
  try {
    const result = await runAgent({ userText, sessionId: body.session_id, persona });
    json(res, 200, chatCompletionObject(id, created, result.text, result.sessionId));
  } catch (err) {
    json(res, 500, { error: { message: String((err as Error).message), type: "server_error" } });
  }
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || "/", "http://localhost");
  const path = url.pathname;

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "authorization, content-type",
    });
    res.end();
    return;
  }

  // /health is altijd open (liveness probe)
  if (path === "/health" && req.method === "GET") {
    json(res, 200, { status: "ok", model: MODEL_ID });
    return;
  }

  // GUI-shell (open; de app zelf gebruikt de Bearer-token voor API-calls)
  if ((path === "/" || path === "/ui") && req.method === "GET") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(UI_HTML);
    return;
  }

  // alles daarna achter de Bearer-gate
  if (!authorized(req)) {
    json(res, 401, { error: { message: "unauthorized — set Authorization: Bearer <HERMES_API_TOKEN>", type: "auth_error" } });
    return;
  }

  if (path === "/v1/models" && req.method === "GET") {
    json(res, 200, { object: "list", data: [{ id: MODEL_ID, object: "model", owned_by: "hermes" }] });
    return;
  }
  if (path === "/v1/chat/completions" && req.method === "POST") {
    await handleChatCompletions(req, res);
    return;
  }
  if (path === "/api/jobs" && req.method === "GET") {
    json(res, 200, { object: "list", data: jobsSnapshot() });
    return;
  }
  const runMatch = path.match(/^\/api\/jobs\/([^/]+)\/run$/);
  if (runMatch && req.method === "POST") {
    const ok = triggerJob(decodeURIComponent(runMatch[1]!));
    json(res, ok ? 202 : 404, ok ? { status: "triggered", job: runMatch[1] } : { error: { message: "unknown job" } });
    return;
  }

  // ── Geheugen (Fase 3): FTS5 sessie-zoek + user-profiel ──
  if (path === "/api/memory/search" && req.method === "GET") {
    const q = url.searchParams.get("q") ?? "";
    const limit = Math.min(Number(url.searchParams.get("limit")) || 8, 50);
    json(res, 200, { object: "list", query: q, data: searchTurns(q, limit) });
    return;
  }
  if (path === "/api/memory/profile" && req.method === "GET") {
    json(res, 200, { object: "list", data: listUserFacts(), stats: memoryStats() });
    return;
  }
  if (path === "/api/memory/fact" && req.method === "POST") {
    let body: { key?: string; value?: string };
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      json(res, 400, { error: { message: "invalid JSON body", type: "invalid_request_error" } });
      return;
    }
    if (!body.key || !body.value) {
      json(res, 400, { error: { message: "key and value required", type: "invalid_request_error" } });
      return;
    }
    upsertUserFact(body.key, body.value);
    json(res, 201, { status: "saved", key: body.key });
    return;
  }

  // ── Browser (Fase 6): lees een webpagina ──
  if (path === "/api/browse" && req.method === "GET") {
    const target = url.searchParams.get("url");
    if (!target) {
      json(res, 400, { error: { message: "url query-param vereist", type: "invalid_request_error" } });
      return;
    }
    try {
      const result = await browse(target.startsWith("http") ? target : `https://${target}`);
      json(res, 200, result);
    } catch (err) {
      json(res, 502, { error: { message: String((err as Error).message), type: "browse_error" } });
    }
    return;
  }

  // ── Skills (Fase 7): agentskills.io-compatibel ──
  if (path === "/api/skills" && req.method === "GET") {
    json(res, 200, { object: "list", data: listSkills().map(({ name, description, version }) => ({ name, description, version })) });
    return;
  }
  const skillMatch = path.match(/^\/api\/skills\/([^/]+)$/);
  if (skillMatch && req.method === "GET") {
    const skill = getSkill(decodeURIComponent(skillMatch[1]!));
    if (!skill) {
      json(res, 404, { error: { message: "unknown skill", type: "not_found" } });
      return;
    }
    json(res, 200, skill);
    return;
  }
  if (path === "/api/skills/install" && req.method === "POST") {
    let body: { source?: string };
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      json(res, 400, { error: { message: "invalid JSON body", type: "invalid_request_error" } });
      return;
    }
    if (!body.source) {
      json(res, 400, { error: { message: "source required (url or gh:owner/repo)", type: "invalid_request_error" } });
      return;
    }
    const result = await installSkill(body.source);
    json(res, result.ok ? 201 : 502, result);
    return;
  }

  json(res, 404, { error: { message: `no route for ${req.method} ${path}`, type: "not_found" } });
}

/**
 * Boot de HTTP-API als HERMES_HTTP_PORT gezet is. Inert (no-op) zonder die env-var,
 * dus de bestaande daemon draait ongewijzigd door tot je 'm bewust activeert.
 */
export function startHttpApi(): void {
  const port = Number(process.env.HERMES_HTTP_PORT);
  if (!port) return;
  if (!process.env.HERMES_API_TOKEN?.trim()) {
    console.warn("⚠️  HERMES_HTTP_PORT gezet maar HERMES_API_TOKEN ontbreekt — API weigert alle calls behalve /health. Zet een token.");
  }
  const server = createServer((req, res) => {
    void route(req, res).catch((err) => {
      try {
        json(res, 500, { error: { message: String((err as Error).message), type: "server_error" } });
      } catch {
        /* response al deels verzonden */
      }
    });
  });
  server.listen(port, () => {
    console.log(`🌐 Hermes HTTP-API luistert op :${port} — /v1/chat/completions, /v1/models, /api/jobs`);
  });
}
