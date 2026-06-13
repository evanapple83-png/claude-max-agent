// ── Telegram delivery helpers ─────────────────────────────────────────────────
// Chunk long replies under Telegram's 4096-char limit, render Markdown → HTML with a
// plain-text fallback, and drive a single "live progress" placeholder message that
// updates with a spinner + streaming text while a long agent run is in flight.

import type { Api, Context } from "grammy";
import { mdToTelegramHtml, stripMd } from "./format.js";

export const TG_LIMIT = 4000; // hard limit is 4096; leave headroom

export function chunk(text: string): string[] {
  if (text.length <= TG_LIMIT) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > TG_LIMIT) {
    let cut = rest.lastIndexOf("\n", TG_LIMIT);
    if (cut < TG_LIMIT * 0.5) cut = TG_LIMIT;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest.trim()) parts.push(rest);
  return parts;
}

const noPreview = { link_preview_options: { is_disabled: true } } as const;

async function deliver(ctx: Context, md: string, editId: number | null): Promise<void> {
  const chatId = ctx.chat!.id;
  const html = mdToTelegramHtml(md);
  try {
    if (editId !== null) await ctx.api.editMessageText(chatId, editId, html, { parse_mode: "HTML", ...noPreview });
    else await ctx.api.sendMessage(chatId, html, { parse_mode: "HTML", ...noPreview });
  } catch {
    const plain = stripMd(md) || "(empty)";
    if (editId !== null) await ctx.api.editMessageText(chatId, editId, plain, noPreview).catch(() => {});
    else await ctx.api.sendMessage(chatId, plain, noPreview).catch(() => {});
  }
}

/** Send a (possibly long) Markdown reply, editing `firstEditId` for the first chunk if given. */
export async function sendReply(ctx: Context, md: string, firstEditId: number | null = null): Promise<void> {
  const parts = chunk(md || "(no output)");
  await deliver(ctx, parts[0]!, firstEditId);
  for (const p of parts.slice(1)) await deliver(ctx, p, null);
}

/** Push a (possibly long) Markdown message to a chat without a Context (e.g. from the scheduler). */
export async function pushMarkdown(api: Api, chatId: number, md: string): Promise<void> {
  for (const part of chunk(md || "(empty)")) {
    const html = mdToTelegramHtml(part);
    try {
      await api.sendMessage(chatId, html, { parse_mode: "HTML", ...noPreview });
    } catch {
      await api.sendMessage(chatId, stripMd(part), noPreview).catch(() => {});
    }
  }
}

/**
 * Live progress on a single placeholder message: spinner, elapsed seconds, current tool
 * activity, and a tail of the streaming text. Wire onText/onTool into runAgent; call stop()
 * before sending the final reply (which edits the same message).
 */
export function liveProgress(ctx: Context, messageId: number) {
  const chatId = ctx.chat!.id;
  const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const start = Date.now();
  let activity = "";
  let tail = "";
  let frame = 0;
  let last = "";
  let done = false;
  let delay = 1200;
  let timer: ReturnType<typeof setTimeout>;

  const render = (): string => {
    const secs = Math.round((Date.now() - start) / 1000);
    const head = `${FRAMES[frame % FRAMES.length]} ${activity || "working…"}  ·  ${secs}s`;
    if (!tail.trim()) return head;
    const MAX = 800;
    const body = tail.length > MAX ? "…" + tail.slice(-MAX) : tail;
    return `${head}\n\n${body}`;
  };

  const tick = async (): Promise<void> => {
    if (done) return;
    frame++;
    const next = render();
    if (next !== last) {
      last = next;
      try {
        await ctx.api.editMessageText(chatId, messageId, next.slice(0, TG_LIMIT), noPreview);
        if (delay > 1200) delay = 1200;
      } catch (err) {
        const retryAfter = (err as { parameters?: { retry_after?: number } })?.parameters?.retry_after;
        delay = typeof retryAfter === "number" ? Math.max(delay, (retryAfter + 0.5) * 1000) : Math.min(delay + 600, 4000);
      }
    }
    if (!done) timer = setTimeout(tick, delay);
  };

  timer = setTimeout(tick, 120);

  return {
    onText: (full: string) => {
      tail = full;
    },
    onTool: (label: string) => {
      activity = label;
    },
    stop: () => {
      done = true;
      clearTimeout(timer);
    },
  };
}

/** Keep a chat action ("typing", …) alive; returns a stop function. */
export function keepActive(
  ctx: Context,
  action: "typing" | "upload_photo" | "upload_video" | "upload_document" = "typing",
): () => void {
  const chatId = ctx.chat!.id;
  const send = () => ctx.api.sendChatAction(chatId, action).catch(() => {});
  send();
  const timer = setInterval(send, 5000);
  return () => clearInterval(timer);
}
