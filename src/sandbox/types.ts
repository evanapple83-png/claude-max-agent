// ── Sandbox-abstractie (Fase 5 van de Nous-parity) ────────────────────────────
// Eén interface om commando's in verschillende isolatie-backends te draaien:
// local (host), docker (ephemeral hardened container), ssh (remote), modal/daytona
// (serverless). Hermes' eigen commando-runner (capture.ts) routeert hierdoorheen;
// default = "local" = exact het huidige host-gedrag, dus niets verandert tot je
// HERMES_SANDBOX zet.

export interface SandboxRunOpts {
  /** Werkmap (host-pad voor local/docker-mount; remote-pad voor ssh). */
  cwd?: string;
  /** Timeout in ms (default 60s). */
  timeoutMs?: number;
  /** Extra env-variabelen voor het commando. */
  env?: Record<string, string>;
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  /** 0 = succes; >0 = exit-code; -1 = backend niet beschikbaar/geconfigureerd. */
  exitCode: number;
  backend: string;
}

export interface Sandbox {
  readonly name: string;
  /** Preflight: is deze backend bruikbaar (CLI aanwezig, target geconfigureerd)? */
  available(): Promise<boolean>;
  /** Voer één commando uit. Gooit nooit: faal-info zit in exitCode/stderr. */
  run(command: string, opts?: SandboxRunOpts): Promise<SandboxResult>;
}

const DEFAULT_TIMEOUT = 60_000;
const MAX_BUFFER = 1024 * 1024;

export const SANDBOX_DEFAULTS = { DEFAULT_TIMEOUT, MAX_BUFFER };
