// ── Sandbox-factory (Fase 5) ──────────────────────────────────────────────────
// getSandbox() kiest de backend uit HERMES_SANDBOX (default "local"). runSandboxed()
// is de convenience die de rest van Hermes gebruikt. Default-pad blijft host-local,
// dus bestaand gedrag verandert pas als je HERMES_SANDBOX=docker|ssh|modal|daytona zet.

import type { Sandbox, SandboxRunOpts, SandboxResult } from "./types.js";
import { LocalSandbox, DockerSandbox, SshSandbox, ModalSandbox, DaytonaSandbox } from "./backends.js";

const REGISTRY: Record<string, () => Sandbox> = {
  local: () => new LocalSandbox(),
  docker: () => new DockerSandbox(),
  ssh: () => new SshSandbox(),
  modal: () => new ModalSandbox(),
  daytona: () => new DaytonaSandbox(),
};

export const SANDBOX_BACKENDS = Object.keys(REGISTRY);

/** Naam van de actieve backend (uit env, default local). */
export function sandboxName(): string {
  const want = (process.env.HERMES_SANDBOX || "local").toLowerCase();
  return REGISTRY[want] ? want : "local";
}

let cached: Sandbox | null = null;
let cachedName = "";

/** De actieve sandbox (singleton per backend-naam). */
export function getSandbox(name = sandboxName()): Sandbox {
  if (cached && cachedName === name) return cached;
  const make = REGISTRY[name] ?? REGISTRY.local!;
  cached = make();
  cachedName = name;
  return cached;
}

/** Voer een commando uit in de actieve sandbox. Gooit nooit. */
export function runSandboxed(command: string, opts?: SandboxRunOpts): Promise<SandboxResult> {
  return getSandbox().run(command, opts);
}

export type { Sandbox, SandboxRunOpts, SandboxResult };
