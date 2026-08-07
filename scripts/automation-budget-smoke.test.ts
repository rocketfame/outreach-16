import {
  AutomationCostCapError,
  AutomationRetryLimitError,
  claimAutomationRetry,
  reserveAutomationCost,
  runWithAutomationBudget,
  settleAutomationCost,
} from "@/lib/automation/budget";
import { isUpstreamNoCreditsError } from "@/lib/textProvider";
import {
  finalizeAutomationUsage,
  getAutomationUsage,
  reserveAutomationUsage,
} from "@/lib/automation/usageStore";

function assert(label: string, condition: boolean): void {
  if (!condition) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
}

async function main(): Promise<void> {
  process.env.MAX_JOB_COST_USD = "0.40";
  process.env.MAX_RETRIES_PER_JOB = "1";

  const metered = await runWithAutomationBudget("job_metered", async () => {
    const first = reserveAutomationCost("article", 0.3);
    settleAutomationCost(first, "article", 0.21);
    const second = reserveAutomationCost("image", 0.05);
    settleAutomationCost(second, "image", 0.05);
  });
  assert("actual job cost is accumulated", metered.snapshot.costUsd === 0.26);

  const capped = await runWithAutomationBudget("job_capped", async () => {
    const first = reserveAutomationCost("article", 0.3);
    settleAutomationCost(first, "article", 0.3);
    reserveAutomationCost("image", 0.11);
  });
  assert("call over $0.40 is blocked before execution", capped.error instanceof AutomationCostCapError);
  assert("blocked call does not increase actual cost", capped.snapshot.costUsd === 0.3);

  const retried = await runWithAutomationBudget("job_retry", async () => {
    claimAutomationRetry("json_retry", 0.1);
    claimAutomationRetry("quality_retry", 0.1);
  });
  assert("second retry is blocked", retried.error instanceof AutomationRetryLimitError);

  const isolated = await Promise.all([
    runWithAutomationBudget("job_a", async () => {
      const id = reserveAutomationCost("a", 0.1);
      await Promise.resolve();
      settleAutomationCost(id, "a", 0.1);
    }),
    runWithAutomationBudget("job_b", async () => {
      const id = reserveAutomationCost("b", 0.2);
      await Promise.resolve();
      settleAutomationCost(id, "b", 0.2);
    }),
  ]);
  assert("parallel job A cost is isolated", isolated[0].snapshot.costUsd === 0.1);
  assert("parallel job B cost is isolated", isolated[1].snapshot.costUsd === 0.2);

  const noCredits = Object.assign(
    new Error("insufficient_quota: no credits remaining"),
    { status: 429 }
  );
  assert("OpenAI insufficient quota is normalized", isUpstreamNoCreditsError(noCredits));

  process.env.DAILY_COST_LIMIT_USD = "0.50";
  process.env.MONTHLY_COST_LIMIT_USD = "1.00";
  const keyId = `test_${Date.now()}`;
  assert("first daily reservation succeeds", (await reserveAutomationUsage(keyId, "usage_a", 0.4)).ok);
  const rejected = await reserveAutomationUsage(keyId, "usage_b", 0.4);
  assert("daily limit rejects before queueing", !rejected.ok && rejected.code === "daily_budget_exceeded");
  await finalizeAutomationUsage("usage_a", 0.2);
  assert("released estimate is replaced by actual cost", (await reserveAutomationUsage(keyId, "usage_c", 0.3)).ok);
  const usage = await getAutomationUsage(keyId);
  assert("usage exposes spend and reservations", usage.spentTodayUsd === 0.2 && usage.reservedTodayUsd === 0.3);
  await finalizeAutomationUsage("usage_c", 0);
}

main();
