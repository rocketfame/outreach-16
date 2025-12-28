// app/api/cost-tracker/route.ts
// API endpoint to get current cost tracking data

import { NextResponse } from "next/server";
import { getCostTracker, formatCost, formatTokens } from "@/lib/costTracker";

export async function GET() {
  try {
    const costTracker = getCostTracker();
    const totals = costTracker.getTotalCosts();
    const tokens = costTracker.getTotalTokens();
    const allCosts = costTracker.getAllCosts();
    const sessionDuration = costTracker.getSessionDuration();
    
    console.log("[cost-tracker] GET request - totals:", totals);
    console.log("[cost-tracker] Tokens:", tokens);
    console.log("[cost-tracker] All cost entries:", allCosts.length);
    console.log("[cost-tracker] Session duration:", sessionDuration, "seconds");

    return NextResponse.json({
      success: true,
      totals: {
        tavily: totals.tavily,
        openai: totals.openai,
        total: totals.total,
        formatted: {
          tavily: formatCost(totals.tavily),
          openai: formatCost(totals.openai),
          total: formatCost(totals.total),
        },
      },
      tokens: {
        tavily: tokens.tavily.queries,
        openai: {
          input: tokens.openai.input,
          output: tokens.openai.output,
          total: tokens.openai.total,
        },
        formatted: {
          tavily: `${formatTokens(tokens.tavily.queries)} queries`,
          openai: `${formatTokens(tokens.openai.total)} tokens`,
        },
      },
      breakdown: totals.breakdown,
      sessionDuration,
      entries: allCosts.length,
    });
  } catch (error) {
    console.error("[cost-tracker] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get cost data",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "reset") {
      const costTracker = getCostTracker();
      costTracker.reset();
      return NextResponse.json({ success: true, message: "Cost tracker reset" });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[cost-tracker] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process request",
      },
      { status: 500 }
    );
  }
}

