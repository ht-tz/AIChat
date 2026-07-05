import { NextRequest, NextResponse } from "next/server";
import { getAllRuns } from "@/server/multi-agent/run-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const runs = getAllRuns()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 50)
    .map((r) => ({
      id: r.id,
      goal: r.goal,
      status: r.status,
      totalStages: r.totalStages,
      completedStages: r.completedStages,
      totalSteps: r.totalSteps,
      completedSteps: r.completedSteps,
      durationMs: r.durationMs,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      createdAt: r.createdAt,
    }));

  return NextResponse.json({ runs, total: runs.length });
}
