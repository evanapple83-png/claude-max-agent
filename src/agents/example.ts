// ── Example agent ─────────────────────────────────────────────────────────────
// A single generic assistant. Copy this file to build your own specialists: give it a
// distinct `key`, `tokenEnv` (a second @BotFather bot), and `persona`, then register it
// in registry.ts. Everything else (memory, streaming, sessions) comes for free.

import type { Agent } from "./types.js";
import { runAgent } from "../claude.js";
import { sendReply, liveProgress, keepActive } from "../telegram.js";

// Per-chat Claude session id, so the conversation has continuity.
const sessions = new Map<number, string>();

export const exampleAgent: Agent = {
  key: "assistant",
  name: "Assistant",
  emoji: "🤖",
  tokenEnv: "TELEGRAM_BOT_TOKEN",
  start: "Hi! I'm your personal agent, running on *your own* Claude subscription. Send me a task and I'll run it on this machine.",

  async handle(ctx, text) {
    const chatId = ctx.chat!.id;
    const stopTyping = keepActive(ctx);
    const placeholder = await ctx.reply("…");
    const live = liveProgress(ctx, placeholder.message_id);
    try {
      const result = await runAgent({
        userText: text,
        sessionId: sessions.get(chatId),
        onText: live.onText,
        onTool: live.onTool,
      });
      if (result.sessionId) sessions.set(chatId, result.sessionId);
      live.stop();
      await sendReply(ctx, result.text, placeholder.message_id);
    } finally {
      live.stop();
      stopTyping();
    }
  },

  extraCommands(bot) {
    bot.command("new", async (ctx) => {
      sessions.delete(ctx.chat!.id);
      await ctx.reply("🧹 Fresh session — context cleared.");
    });
  },
};
