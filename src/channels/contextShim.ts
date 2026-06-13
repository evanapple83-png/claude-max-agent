// ── Context-shim (Fase 4, keystone) ───────────────────────────────────────────
// Bouwt uit een Channel + InboundMessage een object dat structureel compatibel is met
// de subset van grammy's Context die de 45 agents daadwerkelijk gebruiken — zodat
// `agent.handle(ctx, text)` ongewijzigd op elk nieuw platform draait.
//
// De agents leunen op het Telegram-patroon "stuur placeholder → bewerk 'm herhaaldelijk"
// (48× ctx.api.editMessageText). grammy message_id's zijn getallen; onze Channels geven
// string-id's terug. De shim bridget dat met een numeriek↔string-map, zodat live-progress
// ook werkt op platforms die bewerken ondersteunen (Discord/Slack). Op platforms zonder
// bewerken (WhatsApp/Signal) valt een edit terug op een nieuw bericht.

import type { Context } from "grammy";
import type { Channel, InboundMessage, OutMedia } from "./types.js";
import { stripMd } from "../format.js";

/** &amp; → & enz. — vangt Telegram-HTML op die via telegram.ts-helpers kan lekken. */
function unescapeHtml(s: string): string {
  return s
    .replace(/<\/?[a-z][^>]*>/gi, "") // strip HTML-tags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Render agent-tekst naar wat dit kanaal aankan (markdown of plat). */
function toChannelText(channel: Channel, text: string): string {
  const cleaned = unescapeHtml(text);
  return channel.supportsMarkdown ? cleaned : stripMd(cleaned);
}

/** Knip op de max. berichtlengte van het kanaal, bij voorkeur op een newline. */
function chunk(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.5) cut = max;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest.trim()) parts.push(rest);
  return parts;
}

/** Stabiele numerieke hash van een string-chatId, voor ctx.chat.id (agents gebruiken 'm als sleutel). */
function numericId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Maak een grammy-Context-compatibele shim voor één binnenkomend bericht.
 * Geef het resultaat aan `agent.handle(ctx, text)`. De cast naar Context is bewust:
 * we implementeren alleen de leden die de agents echt aanroepen (geïnventariseerd uit
 * de codebase) en degraderen Telegram-specifieke calls netjes.
 */
export function makeShimContext(channel: Channel, inbound: InboundMessage): Context {
  const chatId = inbound.chatId;
  const chatNum = numericId(chatId);
  const userNum = numericId(inbound.userId);

  // message-id-brug: numeriek (wat agents verwachten) → echte platform-id (string)
  const realById = new Map<number, string>();
  let counter = 1;
  const registerReal = (realId: string): number => {
    const n = counter++;
    realById.set(n, realId);
    return n;
  };

  /** Stuur (mogelijk lange) tekst; geef de message_id van het EERSTE deel terug. */
  async function send(text: string): Promise<number> {
    const parts = chunk(toChannelText(channel, text) || "(leeg)", channel.maxMessageLength);
    let firstNum = 0;
    for (let i = 0; i < parts.length; i++) {
      const realId = await channel.sendMessage(chatId, parts[i]!);
      const n = registerReal(realId);
      if (i === 0) firstNum = n;
    }
    return firstNum;
  }

  async function edit(messageId: number, text: string): Promise<void> {
    const realId = realById.get(messageId);
    const rendered = toChannelText(channel, text);
    if (channel.supportsEdit && realId) {
      await channel.editMessage(chatId, realId, rendered.slice(0, channel.maxMessageLength)).catch(() => {});
    } else {
      // geen bewerken → stuur als nieuw bericht (live-progress degradeert netjes)
      await channel.sendMessage(chatId, rendered.slice(0, channel.maxMessageLength)).catch(() => {});
    }
  }

  const media = (source: Buffer | string, caption?: string): OutMedia => ({ source, caption });

  // De api-subset die agents + telegram.ts-helpers aanroepen. chatId-argumenten worden
  // genegeerd ten gunste van de gebonden inbound-chat (de shim leeft per bericht).
  const api = {
    sendMessage: async (_chatId: unknown, text: string) => {
      const n = await send(text);
      return { message_id: n, chat: { id: chatNum } };
    },
    editMessageText: async (_chatId: unknown, messageId: number, text: string) => {
      await edit(messageId, text);
      return { message_id: messageId };
    },
    deleteMessage: async (_chatId: unknown, messageId: number) => {
      const realId = realById.get(messageId);
      if (realId) await channel.deleteMessage(chatId, realId).catch(() => {});
      return true;
    },
    sendChatAction: async (_chatId: unknown, action: string) => {
      await channel.sendChatAction?.(chatId, action).catch(() => {});
      return true;
    },
    getFile: async (_fileRef: string) => {
      // Telegram-specifiek (media-download via file-id). Op nieuwe kanalen loopt inkomende
      // media via channel.downloadAttachment + agent.handlePhoto, niet via getFile.
      throw new Error(`getFile wordt niet ondersteund op kanaal '${channel.name}'`);
    },
  };

  const ctx = {
    // identiteit
    chat: { id: chatNum, type: "private" as const },
    from: { id: userNum, is_bot: false, first_name: "user" },
    message: { message_id: 0, text: inbound.text, chat: { id: chatNum } },
    match: "",
    update: {},
    // de api-laag
    api,
    // directe reply-helpers
    reply: async (text: string) => {
      const n = await send(text);
      return { message_id: n, chat: { id: chatNum } };
    },
    replyWithPhoto: async (source: Buffer | string, opts?: { caption?: string }) => {
      await channel.sendPhoto(chatId, media(source, opts?.caption));
      return { message_id: registerReal("photo") };
    },
    replyWithVideo: async (source: Buffer | string, opts?: { caption?: string }) => {
      await channel.sendVideo(chatId, media(source, opts?.caption));
      return { message_id: registerReal("video") };
    },
    replyWithDocument: async (source: Buffer | string, opts?: { caption?: string }) => {
      await channel.sendDocument(chatId, media(source, opts?.caption));
      return { message_id: registerReal("doc") };
    },
    replyWithMediaGroup: async (items: Array<{ media: Buffer | string; caption?: string }>) => {
      for (const it of items) await channel.sendPhoto(chatId, media(it.media, it.caption));
      return [{ message_id: registerReal("group") }];
    },
    replyWithChatAction: async (action: string) => {
      await channel.sendChatAction?.(chatId, action).catch(() => {});
      return true;
    },
  };

  // Bewuste cast: ctx dekt de gebruikte Context-subset (duck-typing-shim).
  return ctx as unknown as Context;
}
