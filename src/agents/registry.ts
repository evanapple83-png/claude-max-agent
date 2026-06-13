// ── Agent registry ────────────────────────────────────────────────────────────
// Every agent listed here gets its own Telegram bot (token from its `tokenEnv`).
// Add your own: write a module like example.ts and import it here.

import { exampleAgent } from "./example.js";
import type { Agent } from "./types.js";

export const agents: Agent[] = [exampleAgent];
