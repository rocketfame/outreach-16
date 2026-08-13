import {
  enqueueAutomationJob,
  claimNextQueuedJob,
  markJobStarted,
  releaseAutomationSlot,
  getAutomationQueueInfo,
  getAutomationQueueStatus,
  removeQueuedAutomationJob,
  ensureJobQueued,
  saveAutomationJob,
} from "@/lib/automation/jobStore";
import type { AutomationJob } from "@/lib/automation/types";

function job(id: string): AutomationJob {
  return {
    id, status: "queued",
    request: { topic: null, niche: "Music industry", category: "Spotify", anchor: "", anchorUrl: "", brand: "", brief: "", mode: "human", billing: "auto", language: "English", image: false, imageStyle: "", excludeImageStyles: [], imageQuality: "", coverFormat: "webp", imageRatio: "16:9", minWords: 1200, maxWords: 1800, seoTitleMaxChars: 65, maxCostUsd: 0.4 },
    createdAt: Date.now(), updatedAt: Date.now(),
  };
}

const ok = (label: string, cond: boolean) => console.log(`${cond ? "PASS" : "FAIL"} ${label}`);

async function main() {
  process.env.GENERATION_CONCURRENCY = "3";
  process.env.GENERATION_AVG_JOB_SECONDS = "480";

  // FIFO + positions
  await saveAutomationJob(job("gen_a")); await enqueueAutomationJob("gen_a");
  await saveAutomationJob(job("gen_b")); await enqueueAutomationJob("gen_b");
  await saveAutomationJob(job("gen_c")); await enqueueAutomationJob("gen_c");

  let info = await getAutomationQueueInfo("gen_a");
  ok("position a=1", info.position === 1 && info.etaSeconds === 0);
  info = await getAutomationQueueInfo("gen_c");
  ok("position c=3 starts in first wave", info.position === 3 && info.etaSeconds === 0);

  await saveAutomationJob(job("gen_d")); await enqueueAutomationJob("gen_d");
  await saveAutomationJob(job("gen_e")); await enqueueAutomationJob("gen_e");
  info = await getAutomationQueueInfo("gen_e");
  ok("position e=5 starts in second wave", info.position === 5 && info.etaSeconds === 480);

  // Claims are FIFO and fill the configured three slots.
  const c1 = await claimNextQueuedJob();
  ok("claim head = a", c1?.jobId === "gen_a");
  const c2 = await claimNextQueuedJob();
  const c3 = await claimNextQueuedJob();
  ok("claim second = b", c2?.jobId === "gen_b");
  ok("claim third = c", c3?.jobId === "gen_c");
  ok("no fourth slot", (await claimNextQueuedJob()) === null);

  info = await getAutomationQueueInfo("gen_d");
  ok("position d=4 while first wave runs", info.position === 4 && info.etaSeconds === 480);

  // started guard
  ok("started once", await markJobStarted("gen_a") === true);
  ok("started twice blocked", await markJobStarted("gen_a") === false);

  // Release frees one slot; the next FIFO job starts immediately.
  await releaseAutomationSlot(c1!.slot, "gen_a");
  const c4 = await claimNextQueuedJob();
  ok("claim next = d", c4?.jobId === "gen_d");

  // ensureJobQueued: e is in queue → no duplicate.
  await ensureJobQueued("gen_e");
  info = await getAutomationQueueInfo("gen_e");
  ok("no duplicate for queued e", info.position === 4 && info.etaSeconds === 480);

  // ensureJobQueued re-adds a lost job (not in queue, no slot)
  await saveAutomationJob(job("gen_lost"));
  await ensureJobQueued("gen_lost");
  info = await getAutomationQueueInfo("gen_lost");
  ok("lost job re-enqueued behind e", info.position === 5 && info.etaSeconds === 480);

  ok("queued e can be cancelled", await removeQueuedAutomationJob("gen_e") === true);
  ok("cancelled queue entry is gone", await removeQueuedAutomationJob("gen_e") === false);
  const status = await getAutomationQueueStatus();
  ok("queue status reports pool", status.activeWorkers === 3 && status.concurrency === 3);
  ok("queue status reports depth", status.queueDepth === 1 && status.availableWorkers === 0);

  // Wrong-job release does not free d's slot.
  await releaseAutomationSlot(c4!.slot, "gen_zzz");
  ok("slot survives foreign release", (await claimNextQueuedJob()) === null);
}
main();
