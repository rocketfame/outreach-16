import { kv } from "@vercel/kv";
import type { AutomationJob, AutomationQueueInfo } from "@/lib/automation/types";

const memoryJobs = new Map<string, AutomationJob>();
const memoryQueue: string[] = [];
const memorySlots = new Map<string, string>(); // slotKey -> jobId
const memoryStarted = new Set<string>();

const JOB_TTL_SECONDS = 60 * 60 * 24;
const QUEUE_KEY = "automation:queue";
/**
 * Slot lock TTL. Must exceed the route maxDuration (300s) so a healthy job
 * never loses its slot mid-run, but still auto-frees the slot if the
 * function instance dies without reaching releaseAutomationSlot().
 */
const SLOT_TTL_SECONDS = 60 * 10;

/** Average wall-clock per article job, used for queue ETA estimates. */
const AVERAGE_JOB_SECONDS = 480;

export type AutomationJobStoreBackend = "kv" | "memory";

export function requiresPersistentAutomationJobStore(): boolean {
  return process.env.VERCEL === "1";
}

/**
 * How many jobs may generate at once. Each job runs inside its own function
 * invocation, so the ceiling is OpenAI/Undetectable throughput and budget,
 * not compute. Keep 1 unless AUTOMATION_CONCURRENCY says otherwise.
 */
export function automationConcurrency(): number {
  const raw = Number(process.env.AUTOMATION_CONCURRENCY || "1");
  if (!Number.isFinite(raw) || raw < 1) return 1;
  return Math.min(Math.floor(raw), 8);
}

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

function slotKey(index: number): string {
  return `automation:active:${index}`;
}

export async function saveAutomationJob(job: AutomationJob): Promise<AutomationJobStoreBackend> {
  const next = { ...job, updatedAt: Date.now() };
  if (isKvAvailable()) {
    try {
      await kv.set(jobKey(job.id), next, { ex: JOB_TTL_SECONDS });
      return "kv";
    } catch (error) {
      console.error("[automationJobStore] KV error saving job, falling back to in-memory:", error);
    }
  }
  memoryJobs.set(job.id, next);
  return "memory";
}

export async function getAutomationJob(jobId: string): Promise<AutomationJob | null> {
  if (isKvAvailable()) {
    try {
      return (await kv.get<AutomationJob>(jobKey(jobId))) || null;
    } catch (error) {
      console.error("[automationJobStore] KV error reading job, falling back to in-memory:", error);
    }
  }
  return memoryJobs.get(jobId) || null;
}

/**
 * Append a job to the FIFO queue. Returns nothing meaningful — call
 * getAutomationQueueInfo() afterwards for position/ETA.
 */
export async function enqueueAutomationJob(jobId: string): Promise<void> {
  if (isKvAvailable()) {
    try {
      await kv.rpush(QUEUE_KEY, jobId);
      return;
    } catch (error) {
      console.error("[automationJobStore] KV error enqueueing job, falling back to in-memory:", error);
    }
  }
  memoryQueue.push(jobId);
}

export interface ClaimedAutomationJob {
  jobId: string;
  slot: number;
}

/**
 * Atomically claim the next queued job AND a free execution slot for it.
 * lpop is atomic, so two concurrent drains can never claim the same queue
 * entry. If no slot is free, the job is pushed back to the head of the queue.
 *
 * A claim alone does NOT authorize execution — the runner must also win
 * markJobStarted() to guard against duplicate queue entries.
 */
export async function claimNextQueuedJob(): Promise<ClaimedAutomationJob | null> {
  if (isKvAvailable()) {
    try {
      const jobId = await kv.lpop<string>(QUEUE_KEY);
      if (!jobId) return null;
      const slot = await acquireSlot(jobId);
      if (slot === null) {
        await kv.lpush(QUEUE_KEY, jobId);
        return null;
      }
      return { jobId, slot };
    } catch (error) {
      console.error("[automationJobStore] KV error claiming job, falling back to in-memory:", error);
    }
  }

  const jobId = memoryQueue.shift();
  if (!jobId) return null;
  const slot = await acquireSlot(jobId);
  if (slot === null) {
    memoryQueue.unshift(jobId);
    return null;
  }
  return { jobId, slot };
}

/** Acquire a free execution slot via atomic SET NX. Returns the slot index. */
async function acquireSlot(jobId: string): Promise<number | null> {
  const slots = automationConcurrency();

  if (isKvAvailable()) {
    try {
      for (let i = 0; i < slots; i++) {
        const ok = await kv.set(slotKey(i), jobId, { nx: true, ex: SLOT_TTL_SECONDS });
        if (ok) return i;
      }
      return null;
    } catch (error) {
      console.error("[automationJobStore] KV error acquiring slot, falling back to in-memory:", error);
    }
  }

  for (let i = 0; i < slots; i++) {
    if (!memorySlots.has(slotKey(i))) {
      memorySlots.set(slotKey(i), jobId);
      return i;
    }
  }
  return null;
}

/**
 * One-shot execution guard: only the first caller per job wins. Protects
 * against duplicate queue entries (e.g. a self-heal re-enqueue racing a
 * claim) ever running the same generation twice.
 */
export async function markJobStarted(jobId: string): Promise<boolean> {
  if (isKvAvailable()) {
    try {
      const ok = await kv.set(`automation:started:${jobId}`, 1, {
        nx: true,
        ex: JOB_TTL_SECONDS,
      });
      return !!ok;
    } catch (error) {
      console.error("[automationJobStore] KV error marking job started, falling back to in-memory:", error);
    }
  }
  if (memoryStarted.has(jobId)) return false;
  memoryStarted.add(jobId);
  return true;
}

/** Release a specific slot, only if this job still holds it. */
export async function releaseAutomationSlot(slot: number, jobId: string): Promise<void> {
  if (isKvAvailable()) {
    try {
      const holder = await kv.get<string>(slotKey(slot));
      if (holder === jobId) {
        await kv.del(slotKey(slot));
      }
      return;
    } catch (error) {
      console.error("[automationJobStore] KV error releasing slot, falling back to in-memory:", error);
    }
  }

  if (memorySlots.get(slotKey(slot)) === jobId) {
    memorySlots.delete(slotKey(slot));
  }
}

/**
 * Free every slot held by a job. Only for cleanup of jobs known to be dead
 * (stale-running timeout) — for live jobs use releaseAutomationSlot with the
 * exact slot index.
 */
export async function releaseSlotsHeldBy(jobId: string): Promise<void> {
  const slots = automationConcurrency();

  if (isKvAvailable()) {
    try {
      for (let i = 0; i < slots; i++) {
        const holder = await kv.get<string>(slotKey(i));
        if (holder === jobId) {
          await kv.del(slotKey(i));
        }
      }
      return;
    } catch (error) {
      console.error("[automationJobStore] KV error releasing slots, falling back to in-memory:", error);
    }
  }

  for (const [key, holder] of memorySlots) {
    if (holder === jobId) memorySlots.delete(key);
  }
}

export async function isJobHoldingSlot(jobId: string): Promise<boolean> {
  const slots = automationConcurrency();

  if (isKvAvailable()) {
    try {
      for (let i = 0; i < slots; i++) {
        if ((await kv.get<string>(slotKey(i))) === jobId) return true;
      }
      return false;
    } catch (error) {
      console.error("[automationJobStore] KV error checking slot, falling back to in-memory:", error);
    }
  }

  for (const holder of memorySlots.values()) {
    if (holder === jobId) return true;
  }
  return false;
}

async function countActiveSlots(): Promise<number> {
  const slots = automationConcurrency();

  if (isKvAvailable()) {
    try {
      let active = 0;
      for (let i = 0; i < slots; i++) {
        if (await kv.get<string>(slotKey(i))) active++;
      }
      return active;
    } catch (error) {
      console.error("[automationJobStore] KV error counting slots, falling back to in-memory:", error);
    }
  }
  return memorySlots.size;
}

async function readQueue(): Promise<string[]> {
  if (isKvAvailable()) {
    try {
      return (await kv.lrange<string>(QUEUE_KEY, 0, -1)) || [];
    } catch (error) {
      console.error("[automationJobStore] KV error reading queue, falling back to in-memory:", error);
    }
  }
  return [...memoryQueue];
}

/**
 * Re-enqueue a job that is marked queued but sits neither in the queue nor
 * on a slot (an instance died between claiming and starting it). Called from
 * the polling endpoint as a self-healing path.
 */
export async function ensureJobQueued(jobId: string): Promise<void> {
  const queue = await readQueue();
  if (queue.includes(jobId)) return;
  if (await isJobHoldingSlot(jobId)) return;
  await enqueueAutomationJob(jobId);
}

/**
 * Position (1 = next to run) and rough ETA for a queued job. Running jobs
 * count as ahead of everything in the queue. If the job is not found in the
 * queue (e.g. just claimed), it is reported as next to run.
 */
export async function getAutomationQueueInfo(jobId: string): Promise<AutomationQueueInfo> {
  const [queue, active] = await Promise.all([readQueue(), countActiveSlots()]);
  const index = queue.indexOf(jobId);
  const jobsAhead = (index >= 0 ? index : 0) + active;
  const concurrency = automationConcurrency();
  return {
    position: jobsAhead + 1,
    etaSeconds: Math.ceil(jobsAhead / concurrency) * AVERAGE_JOB_SECONDS,
  };
}
