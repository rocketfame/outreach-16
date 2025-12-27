// app/api/cost-tracker/route.ts
// API endpoint to get current cost tracking data

import { NextResponse } from "next/server";
import { getCostTracker, formatCost } from "@/lib/costTracker";

export async function GET() {
  try {
    const costTracker = getCostTracker();
    const totals = costTracker.getTotalCosts();
    const allCosts = costTracker.getAllCosts();
    const sessionDuration = costTracker.getSessionDuration();

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

