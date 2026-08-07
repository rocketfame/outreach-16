import { estimateOpenAIImageCost } from "@/lib/costTracker";
import type {
  AutomationCoverRequest,
  AutomationGenerateRequest,
} from "@/lib/automation/types";

function round(value: number): number {
  return Number(value.toFixed(4));
}

function resolvedImageQuality(value: string): "low" | "medium" | "high" {
  const requested = value.trim().toLowerCase();
  if (requested === "low" || requested === "medium" || requested === "high") {
    return requested;
  }
  const configured = (process.env.HERO_IMAGE_QUALITY || "medium").trim().toLowerCase();
  return configured === "low" || configured === "high" ? configured : "medium";
}

/** Conservative pre-queue forecast. The runtime meter remains authoritative. */
export function estimateAutomationRequestCost(request: AutomationGenerateRequest): number {
  const sourceAndClassification = 0.11;
  const textAndPostProcessing = request.mode === "human" ? 0.21 : 0.19;
  const image = request.image
    ? estimateOpenAIImageCost("gpt-image-2", "1536x864", resolvedImageQuality(request.imageQuality))
    : 0;
  return round(sourceAndClassification + textAndPostProcessing + image);
}

export function estimateCoverRequestCost(request: AutomationCoverRequest): number {
  return round(
    estimateOpenAIImageCost("gpt-image-2", "1536x864", resolvedImageQuality(request.imageQuality))
  );
}
