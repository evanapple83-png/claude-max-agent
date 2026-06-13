// ── The agent core: runAgent() ────────────────────────────────────────────────
// Wraps the Claude Agent SDK's query() loop into one call. Runs on your logged-in
// Claude Code subscription — ANTHROPIC_API_KEY must NOT be set. Records every exchange
// to the local SQLite memory (fail-safe) and supports opt-in cross-session recall.

import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import { config } from "./config.js";
import { recordTurn, recallBlock } from "./memory/store.js";

const DEFAULT_SYSTEM = `You are a helpful, capable personal agent operating on the user's own machine.
- Be direct and concrete. Do the work; don't just describe it.
- Only claim what you can verify; state assumptions explicitly.
- When a task is destructive or hard to reverse, confirm before proceeding.`;

export interface RunResult {
  text: string;
  sessionId: string | undefined;
  isError: boolean;
}

export interface RunArgs {
  userText: string;
  /** Claude session_id to resume, or undefined to start fresh. */
  sessionId?: string;
  /** Called with the full accumulated assistant text as it streams in. */
  onText?: (full: string) => void;
  /** Called when a tool starts, with a short human-readable label. */
  onTool?: (label: string) => void;
  /** Replace the default system prompt (appended to the claude_code preset). */
  persona?: string;
  /** Tool profile: "full" (operator incl. Bash) or "vault" (read/web only, no Bash). */
  tools?: "full" | "vault";
  /** Accepted for API compatibility; this minimal core boots no extra MCP servers. */
  mcp?: "lean" | "full";
  /** Working directory for the session (defaults to config.cwd). */
  cwd?: string;
  maxTurns?: number;
}

const FULL_TOOLS = ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch", "Task", "TodoWrite"];
const VAULT_TOOLS = ["Read", "Glob", "Grep", "WebSearch", "WebFetch"];

/** Block the most obviously destructive shell commands as a safety net. */
function isDangerousBash(cmd: string): boolean {
  return /\brm\s+-rf?\s+[~/]|\bmkfs\b|\bdd\s+if=|\b:\(\)\s*\{|\bshutdown\b|\breboot\b|>\s*\/dev\/sd/.test(cmd);
}

function toolLabel(name: string, input: unknown): string {
  const cmd = (input as { command?: string })?.command;
  if (name === "Bash" && cmd) return `⚡ ${cmd.slice(0, 60)}`;
  const path = (input as { file_path?: string; path?: string })?.file_path ?? (input as { path?: string })?.path;
  if (path) return `${name} ${String(path).split("/").pop()}`;
  return name;
}

const RETRY_DELAY_MS = [0, 2000, 5000];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function isTransient(err: unknown): boolean {
  const m = String((err as Error)?.message || err).toLowerCase();
  return /socket|econnreset|etimedout|network|fetch failed|terminated|aborted/.test(m);
}

/**
 * Run one turn against the Claude Agent SDK and return the final text.
 * Retries transient socket/network drops so a single blip never drops a reply.
 */
export async function runAgent(args: RunArgs): Promise<RunResult> {
  const vault = args.tools === "vault";
  const allowed = vault ? VAULT_TOOLS : FULL_TOOLS;
  const allowedSet = new Set(allowed);

  const options: Options = {
    systemPrompt: { type: "preset", preset: "claude_code", append: args.persona ?? DEFAULT_SYSTEM },
    cwd: args.cwd ?? config.cwd,
    resume: args.sessionId,
    settingSources: [], // isolated: don't load the host's global CLAUDE.md / hooks
    permissionMode: "default",
    maxTurns: args.maxTurns ?? 60,
    allowedTools: allowed,
    canUseTool: async (toolName, input) => {
      const command = (input as { command?: unknown })?.command;
      if (toolName === "Bash" && typeof command === "string" && isDangerousBash(command)) {
        return { behavior: "deny", message: `Blocked by safety rule (destructive command): ${command.slice(0, 120)}` };
      }
      if (allowedSet.has(toolName)) {
        args.onTool?.(toolLabel(toolName, input));
        return { behavior: "allow", updatedInput: input };
      }
      return { behavior: "deny", message: `Tool '${toolName}' is not allowed in this profile.` };
    },
  };
  if (config.model) options.model = config.model;

  // Opt-in cross-session recall: prepend relevant past context before the prompt.
  let effectivePrompt = args.userText;
  if (process.env.HERMES_RECALL === "1") {
    try {
      const recalled = recallBlock(args.userText);
      if (recalled) effectivePrompt = `${recalled}\n\n${args.userText}`;
    } catch {
      /* recall is best-effort */
    }
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let accumulated = "";
    let sessionId: string | undefined = args.sessionId;
    let finalText = "";
    let isError = false;
    try {
      for await (const message of query({ prompt: effectivePrompt, options })) {
        if (message.type === "system" && message.subtype === "init") {
          sessionId = message.session_id;
        } else if (message.type === "assistant") {
          for (const block of message.message.content) {
            if (block.type === "text" && block.text) {
              accumulated += block.text;
              args.onText?.(accumulated);
            }
          }
        } else if (message.type === "result") {
          if ("session_id" in message && message.session_id) sessionId = message.session_id;
          if (message.subtype === "success") finalText = message.result;
          else {
            isError = true;
            finalText = accumulated || `⚠️ Stopped: ${message.subtype}`;
          }
        }
      }
      const text = (finalText || accumulated).trim();
      try {
        recordTurn({ source: "runAgent", role: "exchange", text: `Q: ${args.userText}\n\nA: ${text}`, sessionId });
      } catch {
        /* memory write must never block a reply */
      }
      return { text, sessionId, isError };
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || attempt === 3) break;
      console.error(`[agent] transient SDK error (attempt ${attempt}/3) — retrying`, String((err as Error)?.message || err).slice(0, 140));
      await sleep(RETRY_DELAY_MS[attempt] ?? 5000);
    }
  }
  console.error("[agent] runAgent failed:", String((lastErr as Error)?.message || lastErr).slice(0, 200));
  return { text: "⚠️ Lost connection to Claude for a moment. Please try again.", sessionId: args.sessionId, isError: true };
}
