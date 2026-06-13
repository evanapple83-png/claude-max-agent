// ── Browser-automatisering (Fase 6 van de Nous-parity) ────────────────────────
// Hermes-native headless browser (Nous "Browser Use"-equivalent) op playwright-core,
// dat de GEÏNSTALLEERDE Chrome aanstuurt — geen 150MB chromium-download. Bruikbaar
// vanuit elke context (HTTP-API, scheduler, TUI), niet alleen binnen een SDK-turn.
// Fail-safe: faalt een navigatie, dan krijg je een nette fout i.p.v. een crash.

import { chromium, type Browser } from "playwright-core";

let browserPromise: Promise<Browser> | null = null;

/** Lazy singleton-browser; probeert de systeem-Chrome, valt terug op gebundelde chromium. */
async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium
      .launch({ channel: "chrome", headless: true })
      .catch(() => chromium.launch({ headless: true }));
  }
  return browserPromise;
}

export async function browserAvailable(): Promise<boolean> {
  try {
    const b = await getBrowser();
    return b.isConnected();
  } catch {
    return false;
  }
}

export interface BrowseResult {
  url: string;
  title: string;
  text: string;
  links: Array<{ text: string; href: string }>;
}

/** Navigeer + lees zichtbare tekst en links. */
export async function browse(url: string, opts?: { timeoutMs?: number; maxChars?: number }): Promise<BrowseResult> {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: opts?.timeoutMs ?? 30_000 });
    const title = await page.title();
    // De evaluate-callbacks draaien in de browser; DOM via globalThis zodat de Node-tsconfig
    // (geen 'dom' lib) niet over document/HTMLAnchorElement struikelt.
    const rawText = (await page.evaluate(() => (globalThis as { document?: { body?: { innerText?: string } } }).document?.body?.innerText ?? "")) as string;
    const text = rawText.slice(0, opts?.maxChars ?? 8_000);
    const links = (await page.evaluate(() => {
      const d = (globalThis as { document?: { querySelectorAll(s: string): unknown[] } }).document;
      if (!d) return [] as Array<{ text: string; href: string }>;
      return Array.from(d.querySelectorAll("a"))
        .slice(0, 50)
        .map((a: unknown) => {
          const el = a as { textContent?: string; href?: string };
          return { text: (el.textContent || "").trim().slice(0, 80), href: el.href || "" };
        })
        .filter((l) => l.href && l.href.startsWith("http"));
    })) as Array<{ text: string; href: string }>;
    return { url: page.url(), title, text, links };
  } finally {
    await page.close().catch(() => {});
  }
}

/** Volledige-pagina screenshot (PNG-bytes). */
export async function screenshot(url: string, opts?: { timeoutMs?: number; fullPage?: boolean }): Promise<Buffer> {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: opts?.timeoutMs ?? 30_000 });
    return await page.screenshot({ fullPage: opts?.fullPage ?? true, type: "png" });
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Interactieve sessie voor meerstaps-flows (klik/typen/extract) — de echte "Browser Use".
 * Sluit altijd af met close().
 */
export class BrowserSession {
  private page: import("playwright-core").Page | null = null;

  async goto(url: string, timeoutMs = 30_000): Promise<string> {
    const b = await getBrowser();
    this.page ??= await b.newPage();
    await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    return this.page.url();
  }
  async click(selector: string): Promise<void> {
    await this.page?.click(selector, { timeout: 10_000 });
  }
  async fill(selector: string, value: string): Promise<void> {
    await this.page?.fill(selector, value, { timeout: 10_000 });
  }
  async text(): Promise<string> {
    if (!this.page) return "";
    return (await this.page.evaluate(() => (globalThis as { document?: { body?: { innerText?: string } } }).document?.body?.innerText ?? "")) as string;
  }
  async shot(fullPage = true): Promise<Buffer> {
    return (await this.page?.screenshot({ fullPage, type: "png" })) ?? Buffer.alloc(0);
  }
  async close(): Promise<void> {
    await this.page?.close().catch(() => {});
    this.page = null;
  }
}

/** Sluit de gedeelde browser (bijv. bij afsluiten van de TUI). */
export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const b = await browserPromise.catch(() => null);
  await b?.close().catch(() => {});
  browserPromise = null;
}
