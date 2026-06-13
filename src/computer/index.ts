// ── Computer-use / desktop-control (Fase 6 van de Nous-parity) ────────────────
// Veilig deel: desktop-screenshot via de macOS-ingebouwde `screencapture` (read-only).
// Risicovol deel (muis/toets): standaard UIT — vereist HERMES_COMPUTER_USE=1 ÉN de
// `cliclick`-CLI. Zo beweegt Hermes nooit ongevraagd je echte muis/toetsenbord.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile, unlink } from "node:fs/promises";

const execFileP = promisify(execFile);
let shotCounter = 0;

/** Screenshot van het hele bureaublad (PNG-bytes). Read-only, veilig. */
export async function desktopScreenshot(): Promise<Buffer> {
  const path = join(tmpdir(), `hermes-desktop-${process.pid}-${shotCounter++}.png`);
  await execFileP("screencapture", ["-x", path]); // -x = geen sluitergeluid
  try {
    return await readFile(path);
  } finally {
    await unlink(path).catch(() => {});
  }
}

export interface InputResult {
  ok: boolean;
  reason?: string;
}

function inputEnabled(): boolean {
  return process.env.HERMES_COMPUTER_USE === "1";
}

async function cliclickAvailable(): Promise<boolean> {
  try {
    await execFileP("cliclick", ["-V"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

/** Gemeenschappelijke gate voor alle input-acties. */
async function guard(): Promise<InputResult | null> {
  if (!inputEnabled()) return { ok: false, reason: "computer-use input staat uit — zet HERMES_COMPUTER_USE=1 om muis/toets toe te staan." };
  if (!(await cliclickAvailable())) return { ok: false, reason: "cliclick niet gevonden — `brew install cliclick` om input te gebruiken." };
  return null;
}

export async function click(x: number, y: number): Promise<InputResult> {
  const blocked = await guard();
  if (blocked) return blocked;
  await execFileP("cliclick", [`c:${Math.round(x)},${Math.round(y)}`]);
  return { ok: true };
}

export async function typeText(text: string): Promise<InputResult> {
  const blocked = await guard();
  if (blocked) return blocked;
  await execFileP("cliclick", [`t:${text}`]);
  return { ok: true };
}

export async function pressKey(key: string): Promise<InputResult> {
  const blocked = await guard();
  if (blocked) return blocked;
  await execFileP("cliclick", [`kp:${key}`]);
  return { ok: true };
}

/** Status voor weergave (zonder iets uit te voeren). */
export async function computerUseStatus(): Promise<{ screenshot: boolean; input: boolean; reason: string }> {
  const input = inputEnabled() && (await cliclickAvailable());
  const reason = !inputEnabled()
    ? "input uit (HERMES_COMPUTER_USE niet 1)"
    : (await cliclickAvailable())
      ? "input aan"
      : "input aan-gevraagd maar cliclick ontbreekt";
  return { screenshot: true, input, reason };
}
