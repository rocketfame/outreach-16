import { kv } from "@vercel/kv";
import type { AutomationJob } from "@/lib/automation/types";

const memoryJobs = new Map<string, AutomationJob>();
const memoryLocks = new Set<string>();

const JOB_TTL_SECONDS = 60 * 60 * 24;
const ACTIVE_LOCK_KEY = "automation:active";

function isKvAvailable(): boolean {
  try {
    return !!kv && !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;
  } catch {
    return false;
  }
}

function jobKey(jobId: string): string {
  return `automation:job:${jobId}`;
}

export async function saveAutomationJob(job: AutomationJob): Promise<void> {
  const next = { ...job, updatedAt: Date.now() };
  if (isKvAvailable()) {
    await kv.set(jobKey(job.id), next, { ex: JOB_TTL_SECONDS });
    return;
  }
  memoryJobs.set(job.id, next);
}

export async function getAutomationJob(jobId: string): Promise<AutomationJob | null> {
  if (isKvAvailable()) {
    return (await kv.get<AutomationJob>(jobKey(jobId))) || null;
  }
  return memoryJobs.get(jobId) || null;
}

export async function acquireAutomationSlot(jobId: string): Promise<boolean> {
  if (isKvAvailable()) {
    const active = (await kv.get<string>(ACTIVE_LOCK_KEY)) || "";
    if (active && active !== jobId) return false;
    await kv.set(ACTIVE_LOCK_KEY, jobId, { ex: 60 * 10 });
    return true;
  }

  if (memoryLocks.size > 0 && !memoryLocks.has(jobId)) return false;
  memoryLocks.add(jobId);
  return true;
}

export async function releaseAutomationSlot(jobId: string): Promise<void> {
  if (isKvAvailable()) {
    const active = (await kv.get<string>(ACTIVE_LOCK_KEY)) || "";
    if (active === jobId) {
      await kv.del(ACTIVE_LOCK_KEY);
    }
    return;
  }
  memoryLocks.delete(jobId);
}
