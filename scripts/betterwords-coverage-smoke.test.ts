import { buildArticlePrompt, buildDirectArticlePrompt } from "@/lib/articlePrompt";
import { buildTopicPrompt } from "@/lib/topicPrompt";
import { buildEditArticlePrompt } from "@/lib/editArticlePrompt";
import { buildLegacyGeneratePrompts } from "@/lib/legacyGeneratePrompt";
import {
  BETTERWORDS_REWRITE_SYSTEM_PROMPT,
  BETTERWORDS_VERSION,
} from "@/lib/betterwordsPrompt";

let failures = 0;

function check(label: string, condition: boolean) {
  if (condition) console.log(`PASS ${label}`);
  else {
    failures += 1;
    console.log(`FAIL ${label}`);
  }
}

function checkBetterWords(label: string, prompt: string) {
  check(`${label} uses BetterWords ${BETTERWORDS_VERSION}`, prompt.includes(`BETTERWORDS ${BETTERWORDS_VERSION}`));
  check(`${label} removes detector-evasion rules`, !prompt.includes("AI detection evasion techniques"));
  check(`${label} preserves editorial voice`, prompt.includes("BetterWords is a quality guardrail, not the dominant writing style"));
  check(`${label} limits STE-style rules to procedures`, prompt.includes("Apply procedural clarity only inside genuine instructions"));
}

check("fallback preserves editorial voice", BETTERWORDS_REWRITE_SYSTEM_PROMPT.includes("editorial voice"));
check("fallback does not force STE", BETTERWORDS_REWRITE_SYSTEM_PROMPT.includes("not a command to turn editorial marketing copy into Simplified Technical English"));
check("fallback scopes procedural clarity", BETTERWORDS_REWRITE_SYSTEM_PROMPT.includes("only when this block actually contains instructions"));

const commonArticle = {
  topicTitle: "A practical test topic",
  topicBrief: "Explain a verifiable process without inventing examples.",
  niche: "Music industry",
  mainPlatform: "Spotify",
  contentPurpose: "Guest post / outreach",
  anchorText: "",
  anchorUrl: "",
  brandName: "",
  keywordList: [],
  trustSourcesList: [],
  language: "English",
  targetAudience: "Music creators",
  wordCount: "1200",
  writingMode: "seo" as const,
};

checkBetterWords("Topic Discovery article", buildArticlePrompt(commonArticle));
checkBetterWords("Direct article", buildDirectArticlePrompt(commonArticle));
checkBetterWords("Topic discovery", buildTopicPrompt({ niche: "Music industry" }));
checkBetterWords("Article editing", buildEditArticlePrompt({
  currentArticleHtml: "<h1>Title</h1><p>Text.</p>",
  articleTitle: "Title",
  editRequest: "Make the paragraph clearer.",
  niche: "Music industry",
  language: "English",
  trustSourcesList: [],
  editHistory: [],
}));

const legacyBrief = {
  niche: "Music industry",
  clientSite: "example.com",
  language: "English",
  wordCount: "1200",
};
for (const type of ["topics", "outline", "draft"] as const) {
  const prompts = buildLegacyGeneratePrompts(type, legacyBrief, "A topic", "An outline");
  checkBetterWords(`Legacy ${type}`, prompts.systemPrompt);
}

if (failures > 0) {
  console.log(`\n${failures} BetterWords coverage check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nAll BetterWords coverage checks passed.");
}
