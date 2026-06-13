import type { Bot, Context } from "grammy";

/**
 * One specialist agent behind the shared backend. Each agent is exposed as its own
 * Telegram bot (token from `tokenEnv`), but they all share this process and memory.
 * Adding an agent = write a module that implements this interface + register it in
 * agents/registry.ts.
 */
export interface Agent {
  /** Stable id, used in logs and as a scope key. */
  key: string;
  /** Display name. */
  name: string;
  /** One emoji for logs / the /start message. */
  emoji: string;
  /** Env var holding this agent's Telegram bot token (from @BotFather). */
  tokenEnv: string;
  /** /start blurb. */
  start: string;
  /** Handle a plain text message. The whole bot IS this agent, so any text is for it. */
  handle(ctx: Context, text: string): Promise<void>;
  /** Optionally handle a received image (already downloaded to localPath). */
  handlePhoto?(ctx: Context, localPath: string, caption: string): Promise<void>;
  /** Optionally register extra slash commands on this agent's bot. */
  extraCommands?(bot: Bot): void;
}
