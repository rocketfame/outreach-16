// app/api/trial-usage/route.ts
import { NextRequest, NextResponse } from "next/server";
import { extractTrialToken, getTrialUsage, isMasterToken, isTrialToken, TRIAL_LIMITS } from "@/lib/trialLimits";
import { checkRateLimit, getClientIP } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
  try {
    // Rate limit: 60 req/min per IP
    const ip = getClientIP(req);
    const rl = checkRateLimit(ip, "read");
    if (rl.limited) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.resetIn) } }
      );
    }

    const url = new URL(req.url);
    const trialParam = url.searchParams.get('trial');

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
    console.log('[trial-usage API] Checking if token is valid trial token:', trialToken);
    const isValidTrial = isTrialToken(trialToken);
    console.log('[trial-usage API] Is valid trial token:', isValidTrial);
    
    if (!isValidTrial) {
      console.log('[trial-usage API] Invalid trial token, returning 400');
      return NextResponse.json({
        isMaster: false,
        isTrial: false,
        error: "Invalid trial token",
      }, { status: 400 });
    }
    
    console.log('[trial-usage API] Token is valid, proceeding to get usage');

    // Get usage for trial token
    const usage = await getTrialUsage(trialToken);
    console.log('[trial-usage API] Usage from KV:', usage);

    const articlesRemaining = Math.max(0, TRIAL_LIMITS.MAX_ARTICLES - usage.articlesGenerated);
    const topicDiscoveryRunsRemaining = Math.max(0, TRIAL_LIMITS.MAX_TOPIC_DISCOVERY_RUNS - usage.topicDiscoveryRuns);
    const imagesRemaining = Math.max(0, TRIAL_LIMITS.MAX_IMAGES - usage.imagesGenerated);

    console.log('[trial-usage API] Calculated remaining:', {
      articlesRemaining,
      topicDiscoveryRunsRemaining,
      imagesRemaining,
      articlesGenerated: usage.articlesGenerated,
      topicDiscoveryRuns: usage.topicDiscoveryRuns,
      imagesGenerated: usage.imagesGenerated,
    });

    const response = {
      isMaster: false,
      isTrial: true,
      articlesGenerated: usage.articlesGenerated,
      topicDiscoveryRuns: usage.topicDiscoveryRuns,
      imagesGenerated: usage.imagesGenerated,
      maxArticles: TRIAL_LIMITS.MAX_ARTICLES,
      maxTopicDiscoveryRuns: TRIAL_LIMITS.MAX_TOPIC_DISCOVERY_RUNS,
      maxImages: TRIAL_LIMITS.MAX_IMAGES,
      articlesRemaining,
      topicDiscoveryRunsRemaining,
      imagesRemaining,
    };

    console.log('[trial-usage API] Response:', response);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[trial-usage] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trial usage" },
      { status: 500 }
    );
  }
}
