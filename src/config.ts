// ── Configuration ─────────────────────────────────────────────────────────────
// All config comes from environment variables (see .env.example). Loaded once at
// startup. `model` is intentionally mutable so the TUI can switch models at runtime.

import "dotenv/config";
import { homedir } from "node:os";

export const config = {
  /** Telegram bot token from @BotFather. */
  telegramToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || "",
  /** Numeric chat IDs allowed to command the bot (from @userinfobot). Empty = allow anyone (NOT recommended). */
  allowedChatIds: (process.env.ALLOWED_CHAT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number),
  /** Working directory the agent operates from (where Bash/file tools run). */
  cwd: process.env.HERMES_CWD?.trim() || homedir(),
  /** Optional model override (e.g. claude-opus-4-8). Undefined = SDK default. Mutable at runtime. */
  model: (process.env.HERMES_MODEL?.trim() || undefined) as string | undefined,
};

// Loud warning if someone sets an API key — that bypasses the subscription and bills per token.
if (process.env.ANTHROPIC_API_KEY) {
  console.warn(
    "⚠️  ANTHROPIC_API_KEY is set — this BYPASSES your Claude subscription and bills per token.\n" +
      "   Unset it so the agent runs on your logged-in Claude Code subscription.",
  );
}
