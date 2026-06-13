# 🛰 claude-max-agent

A self-hosted personal agent you talk to from **Telegram** (or a terminal, or a web console), that runs **Claude Code with full tools on your own machine** — on **your own Claude subscription**, with **no per-token API cost**.

```
📱 Telegram ─┐
💻 Terminal  ─┼─► claude-max-agent ─► 🧠 Claude Agent SDK (your subscription)
🌐 Web/API   ─┘     • auth gate           ├─ Bash · Read · Write · Edit · Grep · Web
                    • streaming replies    ├─ SQLite memory + cross-session recall
                    • session continuity   └─ your files & projects on disk
```

It's a small, hackable framework: one example agent plus a stack of optional subsystems (HTTP API, TUI, web console, memory, multi-channel, sandboxing, browser automation, a skills system, and an installer CLI). Copy the example agent to build your own.

---

## ⚠️ Read this first — how billing & terms work

This runs the **Claude Agent SDK on a subscription OAuth token** (via `claude setup-token`), not an API key. Two things you must know:

1. **Personal use only.** Anthropic's terms allow you to use *your own* subscription for *yourself*. They do **not** allow you to serve other people on your seat (no account sharing, no reselling, no multi-tenant). If you want to offer this to others, each person runs their **own** copy on their **own** subscription — that's exactly what this repo is for.
2. **Never set `ANTHROPIC_API_KEY`.** That silently switches the SDK to per-token API billing. Leave it unset so everything rides your subscription. The app warns you loudly if it's set.

> As of mid-2026 Anthropic meters non-interactive Agent SDK usage from a separate monthly credit pool included with Pro/Max plans. Heavy autonomous use draws from that pool. Interactive chats are unaffected.

---

## Quick start

**Prerequisites:** Node.js 22+, and Claude Code installed and logged in with your Anthropic account:

```bash
npm i -g @anthropic-ai/claude-code
claude        # log in once with your Claude Pro/Max account
```

**Install:**

```bash
git clone https://github.com/<you>/claude-max-agent
cd claude-max-agent
npm install
cp .env.example .env
```

**Minimum config** (in `.env`):

```bash
TELEGRAM_BOT_TOKEN=...     # from @BotFather → /newbot
ALLOWED_CHAT_IDS=...       # your numeric id from @userinfobot
# for always-on / detached runs:
CLAUDE_CODE_OAUTH_TOKEN=$(claude setup-token)
```

**Run:**

```bash
npm start            # Telegram bot
npm run dev          # auto-reload
npm run tui          # standalone terminal chat (no Telegram needed)
npm run agent -- doctor   # health check
```

Message your bot on Telegram, or just `npm run tui`. Done. 🎉

---

## Interfaces

| Interface | How | Notes |
|---|---|---|
| **Telegram** | `npm start` | Streaming replies, `/new` to reset, per-chat sessions |
| **Terminal UI** | `npm run tui` | Slash-commands: `/model`, `/zoek`, `/onthou`, `/sandbox`, `/browse`, `/skills`, … |
| **HTTP API** | set `HERMES_HTTP_PORT` + `HERMES_API_TOKEN` | OpenAI-compatible `POST /v1/chat/completions` (+ streaming), jobs, memory, skills |
| **Web console** | open `http://localhost:<port>/` | Chat + Jobs/Skills/Memory panels (served by the HTTP API) |
| **Discord** | set `DISCORD_BOT_TOKEN` | Same agent, second channel |
| **Installer CLI** | `npm run agent -- <cmd>` | `setup`, `doctor`, `status`, `config`, `update` |

---

## Subsystems

- **Memory** — every exchange is recorded to a local SQLite FTS5 store (`.data/memory.db`). Full-text search past conversations; opt into automatic cross-session recall with `HERMES_RECALL=1`. A small user-profile (USER.md-style) too. No external dependency — uses Node's built-in `node:sqlite`.
- **Channels** — a transport abstraction so the same agent runs on Telegram, Discord, and (with adapters) Slack / WhatsApp / Signal / Home Assistant. The hard part (decoupling agents from one transport) is done; new channels implement one small `Channel` interface.
- **Sandboxing** — the agent's own shell commands can run `local` (default, = your machine), `docker` (hardened ephemeral container), `ssh` (remote host), or `modal` / `daytona` (serverless). Set `HERMES_SANDBOX`.
- **Browser automation** — headless browser via `playwright-core` using your installed Chrome (no 150 MB download): `browse(url)`, full-page screenshots, and an interactive session for click/fill/extract.
- **Computer use** — desktop screenshots (macOS `screencapture`). Mouse/keyboard control is **off by default** and gated behind `HERMES_COMPUTER_USE=1` + `cliclick`.
- **Skills** — agentskills.io-compatible `SKILL.md` capabilities. **Ships with 32 generic skills** across design (a `design-orchestrator` + directors), engineering (`code-review`, `debug`, `security-review`, `api-design`, …), writing/comms, research, and meta (`self-learning` so the agent can author its own, `safety`) — see [`skills/`](skills/). Create your own or install from a URL / `gh:owner/repo`. Invoke from the TUI with `/<skill-name>`.
- **Scheduler** — register cron jobs (`registerJob`) that run unattended and are visible/triggerable via the HTTP API.

Each subsystem is additive and fail-safe: nothing breaks the agent if a subsystem can't initialize.

---

## Build your own agents

The repo ships **one** generic agent (`src/agents/example.ts`). To add a specialist:

1. Copy `example.ts`, give it a distinct `key`, a `persona` (passed to `runAgent`), and a `tokenEnv` pointing at a second @BotFather bot token.
2. Register it in `src/agents/registry.ts`.

That's it — memory, streaming, sessions, and the HTTP/Discord surfaces all work automatically. The agent's brain is one function:

```ts
import { runAgent } from "./claude.js";

const result = await runAgent({
  userText: "summarise the README and suggest 3 improvements",
  persona: "You are a concise technical writer.",
  onText: (full) => process.stdout.write(full), // stream
});
console.log(result.text);
```

---

## Security notes

This agent can run **arbitrary shell commands on your machine**. Treat it accordingly:

- **Always set `ALLOWED_CHAT_IDS`** (and `DISCORD_ALLOWED_USER_IDS`). An open bot with shell access is remote code execution.
- The HTTP API requires a Bearer token and binds locally by default. Don't expose it to the internet without auth + a firewall.
- A basic guard blocks the most destructive shell commands, but it is not a sandbox — use `HERMES_SANDBOX=docker` for untrusted work.
- Never commit `.env`. It's gitignored; keep it that way.

---

## Architecture at a glance

```
src/
  index.ts          entry: Telegram bots + HTTP + Discord + scheduler
  claude.ts         runAgent() — the Claude Agent SDK query() loop
  config.ts         env-driven config
  agents/           example agent + registry (add your own here)
  telegram.ts       chunking, streaming live-progress, replies
  memory/           FTS5 SQLite store + recall + user profile
  channels/         transport abstraction + context shim + Discord adapter
  sandbox/          local / docker / ssh / modal / daytona backends
  browser/          headless browser automation (playwright-core)
  computer/         desktop screenshot + (gated) input control
  skills/           agentskills.io SKILL.md loader / creator / installer
  http/             OpenAI-compatible API + web console
  tui/              standalone terminal UI
  cli/              installer CLI (setup / doctor / status / config / update)
  jobs.ts           minimal cron scheduler
```

## License

MIT — see [LICENSE](LICENSE). Use it, fork it, build your own agent on top. Just run it on your own subscription.
