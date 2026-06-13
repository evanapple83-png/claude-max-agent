// ── Entry point ───────────────────────────────────────────────────────────────
// Starts a Telegram bot per registered agent, plus the HTTP API/GUI, the Discord
// channel, and the cron scheduler. Each surface is inert until its env var is set.

import { Bot } from "grammy";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";
import { agents } from "./agents/registry.js";
import { exampleAgent } from "./agents/example.js";
import { startHttpApi } from "./http/server.js";
import { startDiscord } from "./channels/discord.js";
import { startJobs } from "./jobs.js";

const isAuthorized = (id?: number): boolean =>
  config.allowedChatIds.length === 0 || (id !== undefined && config.allowedChatIds.includes(id));

if (config.allowedChatIds.length === 0) {
  console.warn("⚠️  ALLOWED_CHAT_IDS is empty — ANYONE who finds a bot can command it. Set your chat ID.");
}

let started = 0;

for (const agent of agents) {
  const token = process.env[agent.tokenEnv]?.trim();
  if (!token) {
    console.warn(`⏭  ${agent.emoji} ${agent.name}: ${agent.tokenEnv} not set — skipping (create a bot in @BotFather).`);
    continue;
  }

  const bot = new Bot(token);

  // Auth gate: only allowed chat IDs may command any bot.
  bot.use(async (ctx, next) => {
    if (!isAuthorized(ctx.chat?.id)) {
      await ctx.reply("⛔ This bot is private. This chat is not authorized.");
      return;
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    await ctx.reply(agent.start, { parse_mode: "Markdown" }).catch(() => ctx.reply(agent.start));
  });

  agent.extraCommands?.(bot);

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (!text || text.startsWith("/")) return;
    try {
      await agent.handle(ctx, text);
    } catch (err) {
      await ctx.reply("❌ " + String((err as Error).message).slice(0, 300)).catch(() => {});
    }
  });

  if (agent.handlePhoto) {
    bot.on("message:photo", async (ctx) => {
      try {
        const photos = ctx.message.photo;
        const largest = photos[photos.length - 1];
        if (!largest) return;
        const file = await ctx.api.getFile(largest.file_id);
        const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
        const buf = Buffer.from(await res.arrayBuffer());
        await mkdir(".data/incoming", { recursive: true });
        const path = join(".data/incoming", `${Date.now()}.jpg`);
        await writeFile(path, buf);
        await agent.handlePhoto!(ctx, path, ctx.message.caption ?? "");
      } catch (err) {
        await ctx.reply("❌ " + String((err as Error).message).slice(0, 300)).catch(() => {});
      }
    });
  }

  void bot.start();
  console.log(`${agent.emoji} ${agent.name} online.`);
  started++;
}

// Cron scheduler. Register jobs in your own modules with registerJob(...), then they run here.
startJobs();

// OpenAI-compatible HTTP API + web console. Inert until HERMES_HTTP_PORT is set.
startHttpApi();

// Discord channel (routes to the example agent). Inert until DISCORD_BOT_TOKEN is set.
startDiscord(exampleAgent);

if (started === 0) {
  console.warn("ℹ️  No Telegram bot started (TELEGRAM_BOT_TOKEN not set). The TUI (`npm run tui`) and HTTP API still work.");
}
