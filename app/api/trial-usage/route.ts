// app/api/trial-usage/route.ts
import { NextRequest, NextResponse } from "next/server";
import { extractTrialToken, getTrialUsage, isMasterToken, isTrialToken, TRIAL_LIMITS } from "@/lib/trialLimits";

export async function GET(req: NextRequest) {
  try {
    const trialToken = extractTrialToken(req);
    
    // If no token, treat as master (unlimited)
    if (!trialToken) {
      return NextResponse.json({
        isMaster: true,
        isTrial: false,
        articlesGenerated: 0,
        topicDiscoveryRuns: 0,
        imagesGenerated: 0,
        maxArticles: null,
        maxTopicDiscoveryRuns: null,
        maxImages: null,
        articlesRemaining: null,
        topicDiscoveryRunsRemaining: null,
        imagesRemaining: null,
      });
    }

    // Check if master token
    if (isMasterToken(trialToken)) {
      return NextResponse.json({
        isMaster: true,
        isTrial: false,
        articlesGenerated: 0,
        topicDiscoveryRuns: 0,
        imagesGenerated: 0,
        maxArticles: null,
        maxTopicDiscoveryRuns: null,
        maxImages: null,
        articlesRemaining: null,
        topicDiscoveryRunsRemaining: null,
        imagesRemaining: null,
      });
    }

    // Check if valid trial token
    if (!isTrialToken(trialToken)) {
      return NextResponse.json({
        isMaster: false,
        isTrial: false,
        error: "Invalid trial token",
      }, { status: 400 });
    }

    // Get usage for trial token
    const usage = await getTrialUsage(trialToken);
    
    return NextResponse.json({
      isMaster: false,
      isTrial: true,
      articlesGenerated: usage.articlesGenerated,
      topicDiscoveryRuns: usage.topicDiscoveryRuns,
      imagesGenerated: usage.imagesGenerated,
      maxArticles: TRIAL_LIMITS.MAX_ARTICLES,
      maxTopicDiscoveryRuns: TRIAL_LIMITS.MAX_TOPIC_DISCOVERY_RUNS,
      maxImages: TRIAL_LIMITS.MAX_IMAGES,
      articlesRemaining: Math.max(0, TRIAL_LIMITS.MAX_ARTICLES - usage.articlesGenerated),
      topicDiscoveryRunsRemaining: Math.max(0, TRIAL_LIMITS.MAX_TOPIC_DISCOVERY_RUNS - usage.topicDiscoveryRuns),
      imagesRemaining: Math.max(0, TRIAL_LIMITS.MAX_IMAGES - usage.imagesGenerated),
    });
  } catch (error) {
    console.error("[trial-usage] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trial usage" },
      { status: 500 }
    );
  }
}
