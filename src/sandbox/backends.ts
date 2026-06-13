// ── Sandbox-backends (Fase 5) ─────────────────────────────────────────────────
// local · docker · ssh · modal · daytona. Allemaal fail-safe: run() gooit nooit,
// faal-info zit in exitCode (-1 = backend niet beschikbaar/geconfigureerd).

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Sandbox, SandboxRunOpts, SandboxResult } from "./types.js";
import { SANDBOX_DEFAULTS } from "./types.js";

const execFileP = promisify(execFile);
const { DEFAULT_TIMEOUT, MAX_BUFFER } = SANDBOX_DEFAULTS;

interface ExecErr {
  stdout?: string;
  stderr?: string;
  code?: number;
  message?: string;
}

const BASE_ENV = { CLICOLOR: "0", NO_COLOR: "1", TERM: "dumb" } as const;

/** Wrap execFile zodat het nooit gooit en altijd een SandboxResult geeft. */
async function exec(file: string, args: string[], backend: string, opts?: SandboxRunOpts, extraEnv?: Record<string, string>): Promise<SandboxResult> {
  try {
    const { stdout, stderr } = await execFileP(file, args, {
      cwd: opts?.cwd,
      timeout: opts?.timeoutMs ?? DEFAULT_TIMEOUT,
      maxBuffer: MAX_BUFFER,
      env: { ...process.env, ...BASE_ENV, ...extraEnv, ...(opts?.env ?? {}) },
    });
    return { stdout: String(stdout), stderr: String(stderr), exitCode: 0, backend };
  } catch (err) {
    const e = err as ExecErr;
    return {
      stdout: String(e.stdout ?? ""),
      stderr: String(e.stderr ?? e.message ?? ""),
      exitCode: typeof e.code === "number" ? e.code : 1,
      backend,
    };
  }
}

// ── local ─────────────────────────────────────────────────────────────────────
export class LocalSandbox implements Sandbox {
  readonly name = "local";
  async available(): Promise<boolean> {
    return true;
  }
  run(command: string, opts?: SandboxRunOpts): Promise<SandboxResult> {
    // Spiegelt het bestaande capture.ts-gedrag: /bin/zsh -fc <cmd>.
    return exec("/bin/zsh", ["-fc", command], "local", opts);
  }
}

// ── docker (ephemeral, hardened) ───────────────────────────────────────────────
export class DockerSandbox implements Sandbox {
  readonly name = "docker";
  private image = process.env.HERMES_SANDBOX_IMAGE || "alpine:3.20";
  async available(): Promise<boolean> {
    const r = await exec("docker", ["version", "--format", "{{.Server.Version}}"], "docker", { timeoutMs: 8_000 });
    return r.exitCode === 0;
  }
  run(command: string, opts?: SandboxRunOpts): Promise<SandboxResult> {
    const args = [
      "run", "--rm", "-i",
      "--network", process.env.HERMES_SANDBOX_NETWORK || "none",
      "--memory", process.env.HERMES_SANDBOX_MEMORY || "512m",
      "--cpus", process.env.HERMES_SANDBOX_CPUS || "1",
      "--pids-limit", "256",
      "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges",
    ];
    if (opts?.cwd) args.push("-v", `${opts.cwd}:/work`, "-w", "/work");
    else args.push("-w", "/work");
    for (const [k, v] of Object.entries(opts?.env ?? {})) args.push("-e", `${k}=${v}`);
    args.push(this.image, "sh", "-c", command);
    // env van het commando geeft docker via -e door, niet via process-env.
    return exec("docker", args, "docker", { cwd: undefined, timeoutMs: opts?.timeoutMs });
  }
}

// ── ssh (remote host) ──────────────────────────────────────────────────────────
function shQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
export class SshSandbox implements Sandbox {
  readonly name = "ssh";
  private target = process.env.HERMES_SSH_TARGET || ""; // bv. user@host
  async available(): Promise<boolean> {
    if (!this.target) return false;
    const r = await exec("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8", this.target, "true"], "ssh", { timeoutMs: 12_000 });
    return r.exitCode === 0;
  }
  run(command: string, opts?: SandboxRunOpts): Promise<SandboxResult> {
    if (!this.target) return Promise.resolve({ stdout: "", stderr: "HERMES_SSH_TARGET niet gezet", exitCode: -1, backend: "ssh" });
    const remote = opts?.cwd ? `cd ${shQuote(opts.cwd)} && ${command}` : command;
    return exec("ssh", ["-o", "BatchMode=yes", this.target, remote], "ssh", { timeoutMs: opts?.timeoutMs });
  }
}

// ── modal (serverless) ─────────────────────────────────────────────────────────
// Vereist de modal-CLI + een account (`modal token set`). Zonder configuratie geeft
// run() exitCode -1 met een duidelijke melding i.p.v. te falen.
export class ModalSandbox implements Sandbox {
  readonly name = "modal";
  private bin = process.env.HERMES_MODAL_BIN || "modal";
  async available(): Promise<boolean> {
    const r = await exec(this.bin, ["--version"], "modal", { timeoutMs: 8_000 });
    return r.exitCode === 0;
  }
  async run(command: string, opts?: SandboxRunOpts): Promise<SandboxResult> {
    if (!(await this.available())) {
      return { stdout: "", stderr: "modal-CLI niet gevonden — installeer + `modal token set` om deze backend te gebruiken.", exitCode: -1, backend: "modal" };
    }
    // Voer het commando uit in een ephemeral Modal-container (sandbox).
    return exec(this.bin, ["run", "--", "sh", "-c", command], "modal", { timeoutMs: opts?.timeoutMs ?? 120_000 });
  }
}

// ── daytona (serverless dev-sandbox) ───────────────────────────────────────────
export class DaytonaSandbox implements Sandbox {
  readonly name = "daytona";
  private bin = process.env.HERMES_DAYTONA_BIN || "daytona";
  async available(): Promise<boolean> {
    const r = await exec(this.bin, ["version"], "daytona", { timeoutMs: 8_000 });
    return r.exitCode === 0;
  }
  async run(command: string, opts?: SandboxRunOpts): Promise<SandboxResult> {
    if (!(await this.available())) {
      return { stdout: "", stderr: "daytona-CLI niet gevonden — installeer + login om deze backend te gebruiken.", exitCode: -1, backend: "daytona" };
    }
    return exec(this.bin, ["exec", "--", "sh", "-c", command], "daytona", { timeoutMs: opts?.timeoutMs ?? 120_000 });
  }
}
