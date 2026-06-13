// ── Minimal cron scheduler ────────────────────────────────────────────────────
// Register named jobs with a cron expression; startJobs() schedules them. The HTTP
// API exposes jobsSnapshot() (GET /api/jobs) and triggerJob() (POST /api/jobs/:name/run).

import cron from "node-cron";

export type Lane = "heavy" | "light";

export interface JobOpts {
  name: string;
  /** Standard cron expression, e.g. "0 9 * * *". */
  cron: string;
  lane?: Lane;
  run: () => Promise<void>;
}

interface JobState {
  o: JobOpts;
  lastRun: string | null;
  lastOk: boolean | null;
  running: boolean;
  task?: ReturnType<typeof cron.schedule>;
}

const jobs = new Map<string, JobState>();

export function registerJob(o: JobOpts): void {
  jobs.set(o.name, { o, lastRun: null, lastOk: null, running: false });
}

async function exec(s: JobState): Promise<void> {
  if (s.running) return;
  s.running = true;
  try {
    await s.o.run();
    s.lastOk = true;
  } catch (err) {
    s.lastOk = false;
    console.error(`[job] ${s.o.name} failed:`, String((err as Error)?.message || err).slice(0, 200));
  } finally {
    s.running = false;
    s.lastRun = new Date().toISOString();
  }
}

export function startJobs(): void {
  for (const s of jobs.values()) {
    if (!cron.validate(s.o.cron)) {
      console.warn(`[job] invalid cron for ${s.o.name}: ${s.o.cron}`);
      continue;
    }
    s.task = cron.schedule(s.o.cron, () => void exec(s));
  }
}

export function triggerJob(name: string): boolean {
  const s = jobs.get(name);
  if (!s) return false;
  void exec(s);
  return true;
}

export interface JobSnapshot {
  name: string;
  cron: string;
  lane: Lane;
  lastRun: string | null;
  lastOk: boolean | null;
  running: boolean;
}

export function jobsSnapshot(): JobSnapshot[] {
  return [...jobs.values()].map((s) => ({
    name: s.o.name,
    cron: s.o.cron,
    lane: s.o.lane ?? "light",
    lastRun: s.lastRun,
    lastOk: s.lastOk,
    running: s.running,
  }));
}
