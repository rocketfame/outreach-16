import { BETTERWORDS_WRITING_GUIDANCE } from "@/lib/betterwordsPrompt";

export type LegacyGenerateType = "topics" | "outline" | "draft";

export interface LegacyGenerateBrief {
  niche: string;
  clientSite: string;
  language: string;
  wordCount: string;
}

export interface LegacyPromptPair {
  systemPrompt: string;
  userPrompt: string;
}

export function buildLegacyGeneratePrompts(
  type: LegacyGenerateType,
  brief: LegacyGenerateBrief,
  selectedTopic: string,
  outline: string,
): LegacyPromptPair {
  const sharedBrief = [
    `Niche: ${brief.niche || "Not specified"}`,
    `Client site: ${brief.clientSite || "Not provided"}`,
    `Language: ${brief.language || "English"}`,
    `Target word count: ${brief.wordCount || "Not specified"}`,
  ].join("\n");

  if (type === "topics") {
    return {
      systemPrompt: `You are an assistant that generates SEO-friendly outreach article topic ideas.\n\n${BETTERWORDS_WRITING_GUIDANCE}`,
      userPrompt: `${sharedBrief}\n\nPlease provide roughly 10 specific and practical outreach article topics relevant to the brief above.\nReturn one topic per line and avoid numbering.`,
    };
  }

  if (type === "outline") {
    return {
      systemPrompt: `You create detailed article outlines for outreach / SEO articles.\n\n${BETTERWORDS_WRITING_GUIDANCE}`,
      userPrompt: `Selected topic: ${selectedTopic}\nLanguage: ${brief.language || "English"}\n\nCreate a clear H2/H3 outline as plain text for the selected topic. Include descriptive headings and bullet-friendly talking points.`,
    };
  }

  return {
    systemPrompt: `You write well-structured, natural outreach articles.\n\n${BETTERWORDS_WRITING_GUIDANCE}`,
    userPrompt: `Outline:\n${outline}\n\n${sharedBrief}\n\nWrite a full outreach article draft that follows the outline above. Include headings and natural paragraphs, stay within the desired tone for outreach, and hit the target word count as closely as possible.`,
  };
}
