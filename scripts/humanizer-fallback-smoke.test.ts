import {
  HumanizerInsufficientCreditsError,
  createResilientHumanizerService,
  isInsufficientCreditsError,
  type HumanizerService,
} from "@/lib/humanizerClient";
import {
  BETTERWORDS_REWRITE_SYSTEM_PROMPT,
  BETTERWORDS_VERSION,
  buildBetterWordsRewriteInput,
} from "@/lib/betterwordsPrompt";

let failures = 0;

function check(label: string, condition: boolean, detail = "") {
  if (condition) console.log(`PASS ${label}`);
  else {
    failures += 1;
    console.log(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  }
}

async function main() {
  let primaryCalls = 0;
  let fallbackCalls = 0;
  let primaryHasCredits = false;

  const primary: HumanizerService = {
    async humanize(text) {
      primaryCalls += 1;
      if (!primaryHasCredits) throw new HumanizerInsufficientCreditsError();
      return { text: `primary:${text}`, wordsUsed: 2, provider: "undetectable" };
    },
  };
  const fallback: HumanizerService = {
    async humanize(text) {
      fallbackCalls += 1;
      return { text: `fallback:${text}`, wordsUsed: 2, provider: "betterwords" };
    },
  };

  const service = createResilientHumanizerService(primary, fallback);
  const first = await service.humanize("first block");
  check("exact Insufficient credits switches to BetterWords", first.provider === "betterwords");
  check("primary probed once", primaryCalls === 1, `calls=${primaryCalls}`);
  check("fallback called once", fallbackCalls === 1, `calls=${fallbackCalls}`);

  const second = await service.humanize("second block");
  check("circuit breaker keeps remaining blocks on BetterWords", second.provider === "betterwords");
  check("primary stays disabled for the rest of the job", primaryCalls === 1, `calls=${primaryCalls}`);
  check("fallback called for second block", fallbackCalls === 2, `calls=${fallbackCalls}`);

  primaryHasCredits = true;
  const third = await service.humanize("third block");
  check("same job remains on BetterWords even if credits return", third.provider === "betterwords");
  check("primary remains disabled", primaryCalls === 1, `calls=${primaryCalls}`);

  const nextJobService = createResilientHumanizerService(primary, fallback);
  const nextJob = await nextJobService.humanize("new job block");
  check("a new job probes Undetectable again", nextJob.provider === "undetectable");
  check("new job increments primary calls", primaryCalls === 2, `calls=${primaryCalls}`);

  let nonCreditFallbackCalls = 0;
  const failingPrimary: HumanizerService = {
    async humanize() {
      throw new Error("Invalid API key");
    },
  };
  const unusedFallback: HumanizerService = {
    async humanize(text) {
      nonCreditFallbackCalls += 1;
      return { text, wordsUsed: 1, provider: "betterwords" };
    },
  };
  const strictService = createResilientHumanizerService(failingPrimary, unusedFallback);
  let propagated = false;
  try {
    await strictService.humanize("do not mask this error");
  } catch (error) {
    propagated = error instanceof Error && error.message === "Invalid API key";
  }
  check("non-credit errors are not masked", propagated);
  check("non-credit errors do not call BetterWords", nonCreditFallbackCalls === 0);

  check("message classifier recognizes exact provider wording", isInsufficientCreditsError(new Error("Insufficient credits")));
  check("similar credit errors are not treated as exact", !isInsufficientCreditsError(new Error("Not enough credits")));
  check("BetterWords version pinned", BETTERWORDS_VERSION === "2.1.2");
  check(
    "BetterWords prompt preserves protected tokens",
    BETTERWORDS_REWRITE_SYSTEM_PROMPT.includes("LINKREF000") &&
      BETTERWORDS_REWRITE_SYSTEM_PROMPT.includes("same language")
  );
  const wrapped = buildBetterWordsRewriteInput("Текст LINKREF000");
  check("source text wrapped without mutation", wrapped.includes("Текст LINKREF000"));

  if (failures > 0) {
    console.log(`\n${failures} fallback smoke check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("\nAll humanizer fallback smoke checks passed.");
  }
}

void main();
