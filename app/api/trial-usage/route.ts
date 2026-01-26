// app/api/trial-usage/route.ts
import { NextRequest, NextResponse } from "next/server";
import { extractTrialToken, getTrialUsage, isMasterToken, isTrialToken, TRIAL_LIMITS } from "@/lib/trialLimits";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const trialParam = url.searchParams.get('trial');
    
    // #region agent log
    const logEntry = {location:'trial-usage/route.ts:6',message:'GET /api/trial-usage called',data:{hasTrialParam:!!trialParam,trialParam,url:req.url},timestamp:Date.now(),sessionId:'debug-session',runId:'api-trial-usage',hypothesisId:'api-endpoint'};
    fetch('http://127.0.0.1:7244/ingest/4ecc831d-c253-436f-8b37-add194787558',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEntry)}).catch(()=>{});
    // #endregion
    
    const trialToken = extractTrialToken(req);
    
    // #region agent log
    const tokenLog = {location:'trial-usage/route.ts:12',message:'Trial token extracted',data:{trialToken,hasToken:!!trialToken},timestamp:Date.now(),sessionId:'debug-session',runId:'api-trial-usage',hypothesisId:'api-endpoint'};
    fetch('http://127.0.0.1:7244/ingest/4ecc831d-c253-436f-8b37-add194787558',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(tokenLog)}).catch(()=>{});
    // #endregion
    
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
    
    // #region agent log
    const usageLog = {location:'trial-usage/route.ts:67',message:'Trial usage data prepared',data:response,timestamp:Date.now(),sessionId:'debug-session',runId:'api-trial-usage',hypothesisId:'api-endpoint'};
    fetch('http://127.0.0.1:7244/ingest/4ecc831d-c253-436f-8b37-add194787558',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(usageLog)}).catch(()=>{});
    // #endregion
    
    return NextResponse.json(response);
  } catch (error) {
    // #region agent log
    const errorLog = {location:'trial-usage/route.ts:75',message:'Error in trial-usage endpoint',data:{error:error instanceof Error?error.message:String(error),stack:error instanceof Error?error.stack:undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'api-trial-usage',hypothesisId:'api-endpoint'};
    fetch('http://127.0.0.1:7244/ingest/4ecc831d-c253-436f-8b37-add194787558',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(errorLog)}).catch(()=>{});
    // #endregion
    
    console.error("[trial-usage] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trial usage" },
      { status: 500 }
    );
  }
}
