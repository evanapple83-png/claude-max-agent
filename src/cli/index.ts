// ── Hermes installer-CLI (Fase 8 van de Nous-parity) ──────────────────────────
// `hermes setup | doctor | status | config | update`. Draai via: npm run hermes -- <cmd>
// Puur additief: aparte ingang, raakt de draaiende daemon niet.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

const execFileP = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ENV_PATH = join(ROOT, ".env");
const LABEL = process.env.AGENT_LAUNCHD_LABEL || "com.claude-max-agent.app";

const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

// ── .env helpers ───────────────────────────────────────────────────────────────
function readEnv(): Record<string, string> {
  if (!existsSync(ENV_PATH)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(ENV_PATH, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return out;
}

function setEnvVar(key: string, value: string): void {
  let lines = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf-8").split("\n") : [];
  const idx = lines.findIndex((l) => new RegExp(`^\\s*${key}\\s*=`).test(l));
  if (idx >= 0) lines[idx] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
  writeFileSync(ENV_PATH, lines.join("\n"), "utf-8");
}

function mask(key: string, value: string): string {
  if (!value) return c.dim("(leeg)");
  return /TOKEN|SECRET|KEY|PASSWORD/i.test(key) ? value.slice(0, 4) + "…" + value.slice(-2) : value;
}

// ── doctor ──────────────────────────────────────────────────────────────────────
type Verdict = "ok" | "warn" | "fail";
interface Check {
  label: string;
  verdict: Verdict;
  detail: string;
}

async function tryExec(file: string, args: string[], timeout = 8_000): Promise<{ ok: boolean; out: string }> {
  try {
    const { stdout: o } = await execFileP(file, args, { timeout });
    return { ok: true, out: String(o).trim() };
  } catch (e) {
    return { ok: false, out: String((e as { message?: string }).message ?? "") };
  }
}

async function doctor(): Promise<void> {
  const env = readEnv();
  const checks: Check[] = [];

  // Node
  const major = Number(process.versions.node.split(".")[0]);
  checks.push({ label: "Node ≥ 20", verdict: major >= 20 ? "ok" : "fail", detail: `v${process.versions.node}` });

  // Geen API-key (cruciaal — zou Max-sub breken)
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY || !!env.ANTHROPIC_API_KEY;
  checks.push({
    label: "Geen ANTHROPIC_API_KEY (draait op Max-sub)",
    verdict: hasApiKey ? "fail" : "ok",
    detail: hasApiKey ? "GEZET — dit rekent per token af! Verwijderen." : "niet gezet, goed",
  });

  // Telegram-config
  checks.push({ label: "TELEGRAM_BOT_TOKEN", verdict: env.TELEGRAM_BOT_TOKEN ? "ok" : "fail", detail: env.TELEGRAM_BOT_TOKEN ? "gezet" : "ontbreekt" });
  checks.push({ label: "ALLOWED_CHAT_IDS", verdict: env.ALLOWED_CHAT_IDS ? "ok" : "warn", detail: env.ALLOWED_CHAT_IDS ? "gezet" : "leeg = iedereen mag (afgeraden)" });
  checks.push({ label: "CLAUDE_CODE_OAUTH_TOKEN (detached)", verdict: env.CLAUDE_CODE_OAUTH_TOKEN ? "ok" : "warn", detail: env.CLAUDE_CODE_OAUTH_TOKEN ? "gezet" : "ontbreekt — nodig voor launchd (claude setup-token)" });

  // node:sqlite + FTS5 (geheugen)
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(":memory:");
    db.exec("CREATE VIRTUAL TABLE t USING fts5(b)");
    db.close();
    checks.push({ label: "node:sqlite + FTS5 (geheugen)", verdict: "ok", detail: "werkt" });
  } catch (e) {
    checks.push({ label: "node:sqlite + FTS5 (geheugen)", verdict: "fail", detail: String((e as Error).message).slice(0, 60) });
  }

  // Chrome (browser)
  checks.push({ label: "Google Chrome (browser)", verdict: existsSync("/Applications/Google Chrome.app") ? "ok" : "warn", detail: existsSync("/Applications/Google Chrome.app") ? "aanwezig" : "niet gevonden — /browse werkt dan niet" });

  // Docker (sandbox)
  const dock = await tryExec("docker", ["version", "--format", "{{.Server.Version}}"]);
  checks.push({ label: "Docker-daemon (sandbox-backend)", verdict: dock.ok ? "ok" : "warn", detail: dock.ok ? `server ${dock.out}` : "daemon uit — alleen local-sandbox beschikbaar" });

  // Daemon (launchd)
  const uid = typeof process.getuid === "function" ? process.getuid() : 501;
  const svc = await tryExec("launchctl", ["print", `gui/${uid}/${LABEL}`]);
  const running = svc.ok && /state = running/.test(svc.out);
  checks.push({ label: "Hermes-daemon (launchd)", verdict: running ? "ok" : "warn", detail: running ? "running" : "niet geladen (npm start of launchctl bootstrap)" });

  // Render
  stdout.write(c.bold("\n🩺 Hermes doctor\n\n"));
  const icon = { ok: c.green("✓"), warn: c.yellow("!"), fail: c.red("✗") };
  for (const ch of checks) stdout.write(`  ${icon[ch.verdict]} ${ch.label.padEnd(42)} ${c.dim(ch.detail)}\n`);
  const fails = checks.filter((x) => x.verdict === "fail").length;
  const warns = checks.filter((x) => x.verdict === "warn").length;
  stdout.write("\n" + (fails ? c.red(`${fails} kritiek`) + ", " : "") + (warns ? c.yellow(`${warns} waarschuwing(en)`) + ", " : "") + c.green(`${checks.length - fails - warns} ok`) + "\n");
  process.exit(fails ? 1 : 0);
}

// ── status ────────────────────────────────────────────────────────────────────
async function status(): Promise<void> {
  const env = readEnv();
  const uid = typeof process.getuid === "function" ? process.getuid() : 501;
  const svc = await tryExec("launchctl", ["print", `gui/${uid}/${LABEL}`]);
  const running = svc.ok && /state = running/.test(svc.out);
  const channels = ["TELEGRAM_BOT_TOKEN", "DISCORD_BOT_TOKEN"].filter((k) => env[k]).map((k) => k.split("_")[0]!.toLowerCase());
  stdout.write(c.bold("\n🛰  Hermes status\n\n"));
  stdout.write(`  daemon    ${running ? c.green("running") : c.yellow("uit")}\n`);
  stdout.write(`  model     ${env.HERMES_MODEL || c.dim("SDK-default")}\n`);
  stdout.write(`  kanalen   ${channels.length ? channels.join(", ") : c.dim("alleen Telegram (geen extra geconfigureerd)")}\n`);
  stdout.write(`  sandbox   ${env.HERMES_SANDBOX || "local"}\n`);
  stdout.write(`  HTTP-API  ${env.HERMES_HTTP_PORT ? c.green(":" + env.HERMES_HTTP_PORT) : c.dim("uit")}\n`);
  stdout.write(`  recall    ${env.HERMES_RECALL === "1" ? c.green("aan") : c.dim("uit")}\n\n`);
}

// ── config ──────────────────────────────────────────────────────────────────────
function config(args: string[]): void {
  const [op, key, ...rest] = args;
  if (op === "get" && key) {
    stdout.write(`${key}=${mask(key, readEnv()[key] ?? "")}\n`);
  } else if (op === "set" && key && rest.length) {
    setEnvVar(key, rest.join(" "));
    stdout.write(c.green(`✓ ${key} opgeslagen in .env\n`));
  } else if (op === "list") {
    const env = readEnv();
    for (const k of Object.keys(env).sort()) stdout.write(`  ${k.padEnd(28)} ${c.dim(mask(k, env[k]!))}\n`);
  } else {
    stdout.write(c.dim("Gebruik: hermes config get <KEY> | set <KEY> <waarde> | list\n"));
  }
}

// ── update ──────────────────────────────────────────────────────────────────────
async function update(): Promise<void> {
  stdout.write(c.bold("\n⬆️  Hermes update\n\n"));
  if (existsSync(join(ROOT, ".git"))) {
    stdout.write(c.dim("git pull…\n"));
    const g = await tryExec("git", ["-C", ROOT, "pull", "--ff-only"], 60_000);
    stdout.write((g.ok ? c.green("✓ ") : c.yellow("! ")) + g.out.split("\n")[0] + "\n");
  } else {
    stdout.write(c.dim("(geen git-repo — sla git pull over)\n"));
  }
  stdout.write(c.dim("npm install…\n"));
  const n = await tryExec("npm", ["install"], 300_000);
  stdout.write((n.ok ? c.green("✓ deps up-to-date\n") : c.red("✗ npm install faalde\n")));
  stdout.write(c.dim("typecheck…\n"));
  const t = await tryExec("npx", ["tsc", "--noEmit"], 180_000);
  stdout.write((t.ok ? c.green("✓ typecheck groen\n") : c.red("✗ typecheck-fouten\n")) + "\n");
}

// ── setup-wizard ──────────────────────────────────────────────────────────────
async function setup(): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });
  const ask = (q: string): Promise<string> => new Promise((r) => rl.question(q, (a) => r(a.trim())));
  const env = readEnv();
  stdout.write(c.bold("\n🛠  Hermes setup\n") + c.dim("Enter = huidige waarde behouden.\n\n"));

  const tg = await ask(`TELEGRAM_BOT_TOKEN ${env.TELEGRAM_BOT_TOKEN ? c.dim("(" + mask("TOKEN", env.TELEGRAM_BOT_TOKEN) + ")") : c.dim("(van @BotFather)")}: `);
  if (tg) setEnvVar("TELEGRAM_BOT_TOKEN", tg);
  const ids = await ask(`ALLOWED_CHAT_IDS ${env.ALLOWED_CHAT_IDS ? c.dim("(" + env.ALLOWED_CHAT_IDS + ")") : c.dim("(jouw id van @userinfobot)")}: `);
  if (ids) setEnvVar("ALLOWED_CHAT_IDS", ids);

  stdout.write(c.dim("\nVoor detached/launchd-draaien heb je een Max-sub-token nodig:\n  claude setup-token\n"));
  const oauth = await ask(`CLAUDE_CODE_OAUTH_TOKEN ${env.CLAUDE_CODE_OAUTH_TOKEN ? c.dim("(gezet)") : c.dim("(plak of leeg)")}: `);
  if (oauth) setEnvVar("CLAUDE_CODE_OAUTH_TOKEN", oauth);

  rl.close();
  stdout.write(c.green("\n✓ .env bijgewerkt. Run `npm run hermes -- doctor` om te checken.\n\n"));
}

// ── dispatch ──────────────────────────────────────────────────────────────────
function help(): void {
  stdout.write(
    c.bold("\n🛰  hermes — installer-CLI\n\n") +
      `  ${c.cyan("setup")}              interactieve wizard (.env invullen)\n` +
      `  ${c.cyan("doctor")}             diagnose (Node, Max-sub, geheugen, docker, daemon…)\n` +
      `  ${c.cyan("status")}             korte status (daemon, model, kanalen)\n` +
      `  ${c.cyan("config")} get|set|list   .env-waarden lezen/zetten\n` +
      `  ${c.cyan("update")}             git pull + npm install + typecheck\n\n` +
      c.dim("  Draai via: npm run hermes -- <commando>\n\n"),
  );
}

const cmd = process.argv[2];
const rest = process.argv.slice(3);
switch (cmd) {
  case "setup": await setup(); break;
  case "doctor": await doctor(); break;
  case "status": await status(); break;
  case "config": config(rest); break;
  case "update": await update(); break;
  default: help();
}
