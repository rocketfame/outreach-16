import {
  enqueueAutomationJob,
  claimNextQueuedJob,
  markJobStarted,
  releaseAutomationSlot,
  getAutomationQueueInfo,
  ensureJobQueued,
  saveAutomationJob,
} from "@/lib/automation/jobStore";
import type { AutomationJob } from "@/lib/automation/types";

function job(id: string): AutomationJob {
  return {
    id, status: "queued",
    request: { topic: null, niche: "Music industry", category: "Spotify", anchor: "", anchorUrl: "", brand: "", brief: "", mode: "human", language: "English", image: false, imageRatio: "16:9", minWords: 1200, maxWords: 1800 },
    createdAt: Date.now(), updatedAt: Date.now(),
  };
}

const ok = (label: string, cond: boolean) => console.log(`${cond ? "PASS" : "FAIL"} ${label}`);

async function main() {
  // FIFO + positions
  await saveAutomationJob(job("gen_a")); await enqueueAutomationJob("gen_a");
  await saveAutomationJob(job("gen_b")); await enqueueAutomationJob("gen_b");
  await saveAutomationJob(job("gen_c")); await enqueueAutomationJob("gen_c");

  let info = await getAutomationQueueInfo("gen_a");
  ok("position a=1", info.position === 1 && info.etaSeconds === 0);
  info = await getAutomationQueueInfo("gen_c");
  ok("position c=3", info.position === 3 && info.etaSeconds === 960);

  // claim is FIFO and takes slot (concurrency default 1)
  const c1 = await claimNextQueuedJob();
  ok("claim head = a", c1?.jobId === "gen_a");
  const c2 = await claimNextQueuedJob();
  ok("no second slot", c2 === null);

  // position of b now: 1 in queue-ahead=0 + active 1 → position 2
  info = await getAutomationQueueInfo("gen_b");
  ok("position b=2 while a runs", info.position === 2 && info.etaSeconds === 480);

  // started guard
  ok("started once", await markJobStarted("gen_a") === true);
  ok("started twice blocked", await markJobStarted("gen_a") === false);

  // release frees the slot; next claim is b
  await releaseAutomationSlot(c1!.slot, "gen_a");
  const c3 = await claimNextQueuedJob();
  ok("claim next = b", c3?.jobId === "gen_b");

  // ensureJobQueued: c is in queue → no dup
  await ensureJobQueued("gen_c");
  info = await getAutomationQueueInfo("gen_c");
  ok("no dup for queued c (pos 2: b running)", info.position === 2);

  // ensureJobQueued re-adds a lost job (not in queue, no slot)
  await saveAutomationJob(job("gen_lost"));
  await ensureJobQueued("gen_lost");
  info = await getAutomationQueueInfo("gen_lost");
  ok("lost job re-enqueued behind c", info.position === 3);

  // wrong-job release does not free b's slot
  await releaseAutomationSlot(c3!.slot, "gen_zzz");
  ok("slot survives foreign release", (await claimNextQueuedJob()) === null);
}
main();
