// ── Discord-adapter (Fase 4, eerste niet-Telegram-kanaal) ─────────────────────
// Implementeert het Channel-contract op discord.js en koppelt een bestaande agent
// (default: de generalist hermes-agent) aan een Discord-bot via de context-shim.
// Inert tot DISCORD_BOT_TOKEN gezet is — net als de Telegram-bots die zonder token
// worden overgeslagen. Raakt het Telegram-pad niet.

import { Client, GatewayIntentBits, Partials, AttachmentBuilder } from "discord.js";
import type { Channel, OutMedia } from "./types.js";
import { makeShimContext } from "./contextShim.js";
import type { Agent } from "../agents/types.js";

class DiscordChannel implements Channel {
  readonly name = "discord";
  readonly supportsEdit = true;
  readonly supportsMarkdown = true;
  readonly maxMessageLength = 2000;

  constructor(private readonly client: Client) {}

  private async textChannel(chatId: string) {
    const ch = await this.client.channels.fetch(chatId).catch(() => null);
    return ch && ch.isTextBased() ? ch : null;
  }

  async sendMessage(chatId: string, text: string): Promise<string> {
    const ch = await this.textChannel(chatId);
    if (!ch || !("send" in ch)) return "";
    const msg = await ch.send(text);
    return msg.id;
  }

  async editMessage(chatId: string, messageId: string, text: string): Promise<void> {
    const ch = await this.textChannel(chatId);
    if (!ch) return;
    const msg = await ch.messages.fetch(messageId).catch(() => null);
    if (msg && msg.editable) await msg.edit(text).catch(() => {});
  }

  async deleteMessage(chatId: string, messageId: string): Promise<void> {
    const ch = await this.textChannel(chatId);
    if (!ch) return;
    const msg = await ch.messages.fetch(messageId).catch(() => null);
    if (msg && msg.deletable) await msg.delete().catch(() => {});
  }

  private async sendFile(chatId: string, m: OutMedia, name: string): Promise<void> {
    const ch = await this.textChannel(chatId);
    if (!ch || !("send" in ch)) return;
    const file = typeof m.source === "string" ? m.source : new AttachmentBuilder(m.source, { name: m.filename ?? name });
    await ch.send({ content: m.caption, files: [file] }).catch(() => {});
  }
  async sendPhoto(chatId: string, m: OutMedia): Promise<void> {
    await this.sendFile(chatId, m, "image.png");
  }
  async sendVideo(chatId: string, m: OutMedia): Promise<void> {
    await this.sendFile(chatId, m, "video.mp4");
  }
  async sendDocument(chatId: string, m: OutMedia): Promise<void> {
    await this.sendFile(chatId, m, "file.bin");
  }

  async sendChatAction(chatId: string): Promise<void> {
    const ch = await this.textChannel(chatId);
    if (ch && "sendTyping" in ch) await ch.sendTyping().catch(() => {});
  }

  async downloadAttachment(fileRef: string): Promise<Buffer> {
    const res = await fetch(fileRef);
    return Buffer.from(await res.arrayBuffer());
  }
}

/**
 * Start de Discord-adapter en koppel 'm aan `agent`. Inert (no-op) zonder
 * DISCORD_BOT_TOKEN. DISCORD_ALLOWED_USER_IDS (comma-gescheiden) is de auth-gate;
 * leeg = iedereen mag (afgeraden).
 */
export function startDiscord(agent: Agent): void {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  if (!token) return;

  const allowed = (process.env.DISCORD_ALLOWED_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  const channel = new DiscordChannel(client);

  client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;
    if (allowed.length && !allowed.includes(msg.author.id)) {
      await msg.reply("⛔ Deze bot is privé. Deze gebruiker is niet geautoriseerd.").catch(() => {});
      return;
    }
    const text = msg.content.trim();
    if (!text) return;
    const ctx = makeShimContext(channel, { chatId: msg.channelId, userId: msg.author.id, text, raw: msg });
    try {
      await agent.handle(ctx, text);
    } catch (err) {
      await msg.reply(`❌ ${String((err as Error).message).slice(0, 300)}`).catch(() => {});
    }
  });

  client.once("ready", () => {
    console.log(`💬 Discord-adapter ingelogd als ${client.user?.tag} → agent '${agent.key}'`);
  });

  void client.login(token).catch((err) => {
    console.error("[discord] login mislukt:", String((err as Error).message).slice(0, 160));
  });
}
