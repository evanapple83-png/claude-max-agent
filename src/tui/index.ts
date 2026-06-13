// ── Hermes TUI (Fase 2 van de Nous-parity) ────────────────────────────────────
// Een standalone terminal-chat bovenop dezelfde Claude-backend (runAgent) die de
// Telegram-fleet en de HTTP-API gebruiken. Start los van de daemon:
//
//   npm run tui
//
// Slash-commands (1-op-1 met de Nous Hermes TUI-kern):
//   /help            overzicht
//   /new  /reset     verse sessie (wist de gespreks-context)
//   /model [naam]    toon of zet het model voor volgende turns
//   /tools full|vault   tool-profiel (operator incl. Bash, of vault-only)
//   /mcp lean|full   MCP-set per turn
//   /cwd [pad]       toon of zet de werkmap
//   /status          sessie-id, model, profiel, cwd
//   /clear           scherm leegmaken
//   /exit  /quit     afsluiten  (of Ctrl+C)
//
// Geen API-key: praat met je Claude Max-abonnement via runAgent, net als de rest.

import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { runAgent } from "../claude.js";
import { config } from "../config.js";
import { searchTurns, upsertUserFact, listUserFacts, memoryStats } from "../memory/store.js";
import { runSandboxed, sandboxName, getSandbox, SANDBOX_BACKENDS } from "../sandbox/index.js";
import { browse, screenshot as webScreenshot, browserAvailable, closeBrowser } from "../browser/index.js";
import { desktopScreenshot } from "../computer/index.js";
import { listSkills, getSkill, createSkill, installSkill, skillInvocationPrompt } from "../skills/index.js";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";

const STATIC_COMMANDS = ["/help", "/new", "/reset", "/model", "/tools", "/mcp", "/cwd", "/status", "/zoek", "/onthou", "/profiel", "/geheugen", "/sandbox", "/browse", "/shot", "/scherm", "/skills", "/skill-new", "/skill-install", "/clear", "/exit", "/quit"] as const;
/** Statische commando's + dynamische skill-naam-commando's (voor autocomplete). */
function allCommands(): string[] {
  return [...STATIC_COMMANDS, ...listSkills().map((s) => `/${s.name}`)];
}

// ANSI-helpers (geen dep)
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

interface TuiState {
  sessionId: string | undefined;
  model: string | undefined;
  tools: "full" | "vault";
  mcp: "lean" | "full";
  cwd: string;
  busy: boolean;
}

const state: TuiState = {
  sessionId: undefined,
  model: config.model, // gedeeld met de backend; /model muteert config.model live
  tools: "full",
  mcp: "lean",
  cwd: config.cwd,
  busy: false,
};

const rl = createInterface({
  input: stdin,
  output: stdout,
  prompt: cyan("hermes › "),
  completer: (line: string) => {
    if (!line.startsWith("/")) return [[], line];
    const cmds = allCommands();
    const hits = cmds.filter((c) => c.startsWith(line));
    return [hits.length ? hits : cmds, line];
  },
});

function banner(): void {
  stdout.write(
    `\n${bold("🛰  Hermes TUI")}  ${dim("— terminal-chat op je Claude Max-abonnement")}\n` +
      dim(`model: ${state.model ?? "SDK-default"} · tools: ${state.tools} · mcp: ${state.mcp} · cwd: ${state.cwd}\n`) +
      dim("Typ je vraag, of /help voor commando's. Ctrl+C om te stoppen.\n\n"),
  );
}

function statusLine(): string {
  return (
    dim("┌ sessie  ") + (state.sessionId ?? dim("(nog geen — verse start)")) + "\n" +
    dim("├ model   ") + (state.model ?? dim("SDK-default")) + "\n" +
    dim("├ tools   ") + state.tools + "\n" +
    dim("├ mcp     ") + state.mcp + "\n" +
    dim("└ cwd     ") + state.cwd
  );
}

function help(): string {
  return [
    bold("Commando's:"),
    `  ${cyan("/new")} ${dim("of")} ${cyan("/reset")}   verse sessie (wist de context)`,
    `  ${cyan("/model")} [naam]    toon of zet het model voor volgende turns`,
    `  ${cyan("/tools")} full|vault  tool-profiel (operator of vault-only)`,
    `  ${cyan("/mcp")} lean|full   MCP-set per turn`,
    `  ${cyan("/cwd")} [pad]       toon of zet de werkmap`,
    `  ${cyan("/status")}          huidige sessie/instellingen`,
    `  ${cyan("/zoek")} <query>    doorzoek eerdere gesprekken (FTS5)`,
    `  ${cyan("/onthou")} sleutel=waarde   bewaar een feit in je user-profiel`,
    `  ${cyan("/profiel")}         toon je user-profiel`,
    `  ${cyan("/geheugen")}        geheugen-statistieken`,
    `  ${cyan("/sandbox")} <cmd>   draai een commando in de actieve sandbox-backend`,
    `  ${cyan("/browse")} <url>    lees een webpagina (titel/tekst/links)`,
    `  ${cyan("/shot")} <url>      screenshot van een webpagina → bestand`,
    `  ${cyan("/scherm")}          screenshot van je bureaublad → bestand`,
    `  ${cyan("/skills")}          lijst beschikbare skills`,
    `  ${cyan("/skill-new")} naam | omschrijving | body   maak een skill`,
    `  ${cyan("/skill-install")} <url|gh:owner/repo>   installeer uit de Hub`,
    `  ${cyan("/<skillnaam>")} <taak>   roep een skill aan`,
    `  ${cyan("/clear")}           scherm leegmaken`,
    `  ${cyan("/exit")} ${dim("of")} ${cyan("/quit")}   afsluiten`,
  ].join("\n");
}

/** Verwerk een slash-command. Retourneert true als het een command was. */
function handleCommand(line: string): boolean {
  const [cmd, ...rest] = line.trim().split(/\s+/);
  const arg = rest.join(" ").trim();
  switch (cmd) {
    case "/help":
      stdout.write(help() + "\n");
      return true;
    case "/new":
    case "/reset":
      state.sessionId = undefined;
      stdout.write(green("🧹 Verse sessie — context gewist.\n"));
      return true;
    case "/model":
      if (arg) {
        state.model = arg === "default" ? undefined : arg;
        config.model = state.model; // live door naar de backend (runAgent leest config.model per call)
        stdout.write(green(`✓ Model → ${state.model ?? "SDK-default"}\n`));
      } else {
        stdout.write(dim(`Huidig model: ${state.model ?? "SDK-default"}. Zet met /model <naam> (of /model default).\n`));
      }
      return true;
    case "/tools":
      if (arg === "full" || arg === "vault") {
        state.tools = arg;
        stdout.write(green(`✓ Tool-profiel → ${arg}\n`));
      } else {
        stdout.write(dim(`Gebruik: /tools full | vault   (nu: ${state.tools})\n`));
      }
      return true;
    case "/mcp":
      if (arg === "lean" || arg === "full") {
        state.mcp = arg;
        stdout.write(green(`✓ MCP-set → ${arg}\n`));
      } else {
        stdout.write(dim(`Gebruik: /mcp lean | full   (nu: ${state.mcp})\n`));
      }
      return true;
    case "/cwd":
      if (arg) {
        state.cwd = arg;
        stdout.write(green(`✓ Werkmap → ${arg}\n`));
      } else {
        stdout.write(dim(`Werkmap: ${state.cwd}. Zet met /cwd <pad>.\n`));
      }
      return true;
    case "/status":
      stdout.write(statusLine() + "\n");
      return true;
    case "/zoek": {
      if (!arg) {
        stdout.write(dim("Gebruik: /zoek <query>\n"));
        return true;
      }
      const hits = searchTurns(arg, 8);
      if (!hits.length) {
        stdout.write(dim("Niets gevonden in eerdere gesprekken.\n"));
        return true;
      }
      stdout.write(bold(`\n${hits.length} resultaat(en):\n`));
      for (const h of hits) {
        const when = h.ts ? h.ts.slice(0, 10) : "?";
        stdout.write(dim(`\n[${when} · ${h.source}]\n`) + h.text.slice(0, 500).trim() + "\n");
      }
      stdout.write("\n");
      return true;
    }
    case "/onthou": {
      const eq = arg.indexOf("=");
      if (eq < 1) {
        stdout.write(dim("Gebruik: /onthou sleutel=waarde   (bv. /onthou voorkeur=geen em-dashes)\n"));
        return true;
      }
      const key = arg.slice(0, eq).trim();
      const value = arg.slice(eq + 1).trim();
      upsertUserFact(key, value);
      stdout.write(green(`✓ Onthouden: ${key} → ${value}\n`));
      return true;
    }
    case "/profiel": {
      const facts = listUserFacts();
      if (!facts.length) {
        stdout.write(dim("Nog geen profiel-feiten. Voeg toe met /onthou sleutel=waarde.\n"));
        return true;
      }
      stdout.write(bold("\nUser-profiel:\n"));
      for (const f of facts) stdout.write(`  ${cyan(f.key)}: ${f.value} ${dim(`(${f.updated.slice(0, 10)})`)}\n`);
      stdout.write("\n");
      return true;
    }
    case "/geheugen": {
      const s = memoryStats();
      stdout.write(s.ok ? dim(`Geheugen: ${s.turns} turns, ${s.facts} profiel-feiten (.data/memory.db)\n`) : red("Geheugen niet beschikbaar.\n"));
      return true;
    }
    case "/sandbox": {
      if (!arg) {
        stdout.write(dim(`Actieve backend: ${sandboxName()} (van ${SANDBOX_BACKENDS.join("/")}, zet met HERMES_SANDBOX).\nGebruik: /sandbox <commando>\n`));
        return true;
      }
      state.busy = true;
      void (async () => {
        const ok = await getSandbox().available();
        if (!ok) stdout.write(red(`Backend '${sandboxName()}' niet beschikbaar — val terug op output hieronder.\n`));
        const res = await runSandboxed(arg, { cwd: state.cwd });
        stdout.write(dim(`[${res.backend} · exit ${res.exitCode}]\n`) + (res.stdout || res.stderr || "(geen output)") + "\n");
        state.busy = false;
        rl.prompt();
      })();
      return true;
    }
    case "/browse": {
      if (!arg) {
        stdout.write(dim("Gebruik: /browse <url>\n"));
        return true;
      }
      state.busy = true;
      void (async () => {
        try {
          if (!(await browserAvailable())) stdout.write(red("Browser niet beschikbaar (Chrome niet gevonden?).\n"));
          const r = await browse(arg.startsWith("http") ? arg : `https://${arg}`);
          stdout.write(bold(`\n${r.title}`) + dim(` — ${r.url}\n`) + r.text.slice(0, 1200).trim() + "\n");
          if (r.links.length) stdout.write(dim(`\n${r.links.length} links, eerste 5:\n`) + r.links.slice(0, 5).map((l) => `  ${l.text || "(geen tekst)"} → ${l.href}`).join("\n") + "\n");
        } catch (err) {
          stdout.write(red(`Browse-fout: ${String((err as Error).message)}\n`));
        }
        state.busy = false;
        rl.prompt();
      })();
      return true;
    }
    case "/shot": {
      if (!arg) {
        stdout.write(dim("Gebruik: /shot <url>\n"));
        return true;
      }
      state.busy = true;
      void (async () => {
        try {
          const buf = await webScreenshot(arg.startsWith("http") ? arg : `https://${arg}`);
          const file = pathJoin(tmpdir(), `hermes-web-${Date.now()}.png`);
          await writeFile(file, buf);
          stdout.write(green(`✓ Screenshot (${Math.round(buf.length / 1024)} KB) → ${file}\n`));
        } catch (err) {
          stdout.write(red(`Screenshot-fout: ${String((err as Error).message)}\n`));
        }
        state.busy = false;
        rl.prompt();
      })();
      return true;
    }
    case "/scherm": {
      state.busy = true;
      void (async () => {
        try {
          const buf = await desktopScreenshot();
          const file = pathJoin(tmpdir(), `hermes-desktop-${Date.now()}.png`);
          await writeFile(file, buf);
          stdout.write(green(`✓ Bureaublad-screenshot (${Math.round(buf.length / 1024)} KB) → ${file}\n`));
        } catch (err) {
          stdout.write(red(`Scherm-fout: ${String((err as Error).message)}\n`));
        }
        state.busy = false;
        rl.prompt();
      })();
      return true;
    }
    case "/skills": {
      const skills = listSkills();
      if (!skills.length) {
        stdout.write(dim("Nog geen skills. Maak er een met /skill-new of /skill-install.\n"));
        return true;
      }
      stdout.write(bold(`\n${skills.length} skill(s):\n`));
      for (const s of skills) stdout.write(`  ${cyan("/" + s.name)} ${dim("— " + (s.description || "(geen omschrijving)"))}\n`);
      stdout.write(dim("\nRoep aan met /<skillnaam> <taak>.\n"));
      return true;
    }
    case "/skill-new": {
      const parts = arg.split("|").map((p) => p.trim());
      if (parts.length < 3 || !parts[0]) {
        stdout.write(dim("Gebruik: /skill-new naam | omschrijving | body\n"));
        return true;
      }
      const s = createSkill(parts[0]!, parts[1]!, parts.slice(2).join(" | "));
      stdout.write(green(`✓ Skill aangemaakt: /${s.name} → ${s.path}\n`));
      return true;
    }
    case "/skill-install": {
      if (!arg) {
        stdout.write(dim("Gebruik: /skill-install <url> of gh:owner/repo[/pad]\n"));
        return true;
      }
      state.busy = true;
      void (async () => {
        const r = await installSkill(arg);
        stdout.write(r.ok ? green(`✓ Geïnstalleerd: /${r.skill!.name}\n`) : red(`Installatie mislukt: ${r.error}\n`));
        state.busy = false;
        rl.prompt();
      })();
      return true;
    }
    case "/clear":
      stdout.write("\x1b[2J\x1b[H");
      return true;
    case "/exit":
    case "/quit":
      rl.close();
      return true;
    default: {
      // Skill-naam slash-command: /<skillnaam> <taak> roept de skill aan.
      const skill = getSkill(cmd!.slice(1));
      if (skill) {
        void ask(skillInvocationPrompt(skill, arg || "Voer deze skill uit."));
        return true;
      }
      stdout.write(red(`Onbekend commando: ${cmd}. Typ /help.\n`));
      return true;
    }
  }
}

async function ask(userText: string): Promise<void> {
  state.busy = true;
  rl.pause();
  let last = "";
  stdout.write("\n");
  try {
    const result = await runAgent({
      userText,
      sessionId: state.sessionId,
      tools: state.tools,
      mcp: state.mcp,
      cwd: state.cwd,
      onText: (full) => {
        if (full.length > last.length) {
          stdout.write(full.slice(last.length));
          last = full;
        }
      },
      onTool: (label) => {
        stdout.write(dim(`\n  · ${label}\n`));
        last = ""; // tool-regel breekt de stream-flow; herstart delta-telling
      },
    });
    // Als er niet gestreamd is (geen onText-calls), print het eindresultaat alsnog.
    if (!last) stdout.write(result.text);
    else if (result.text.length > last.length) stdout.write(result.text.slice(last.length));
    state.sessionId = result.sessionId;
    if (result.isError) stdout.write(red("\n⚠️  (de backend meldde een fout)"));
    stdout.write("\n\n");
  } catch (err) {
    stdout.write(red(`\n❌ Fout: ${String((err as Error).message)}\n\n`));
  } finally {
    state.busy = false;
    rl.resume();
    rl.prompt();
  }
}

// runAgent verwacht GEEN ANTHROPIC_API_KEY (Max-sub). Waarschuw net als index.ts.
if (process.env.ANTHROPIC_API_KEY) {
  stdout.write(red("⚠️  ANTHROPIC_API_KEY is gezet — dit omzeilt je Max-abonnement en rekent per token af. Unset 'm.\n"));
}

banner();
rl.prompt();

rl.on("line", (line) => {
  const text = line.trim();
  if (!text) {
    rl.prompt();
    return;
  }
  if (state.busy) {
    stdout.write(dim("… nog bezig met de vorige vraag, momentje.\n"));
    return;
  }
  if (text.startsWith("/")) {
    handleCommand(text);
    if (!state.busy) rl.prompt();
    return;
  }
  void ask(text);
});

rl.on("close", () => {
  stdout.write(dim("\n👋 Tot ziens.\n"));
  void closeBrowser().finally(() => process.exit(0));
});
