// 性能监控 API

import { NextRequest, NextResponse } from "next/server";
import {
  getStats,
  getRecentRecords,
  clearRecords,
  recordPerformance,
} from "@/server/monitoring/performance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = new URL(req.url);
  const hours = Number(searchParams.get("hours")) || 24;
  const limit = Number(searchParams.get("limit")) || 50;

  const stats = getStats(hours);
  const recent = getRecentRecords(limit);

  const duration = Date.now() - startTime;
  recordPerformance("/api/performance/stats", "GET", duration, 200);

  return NextResponse.json({
    stats,
    recent,
  });
}

export async function DELETE() {
  clearRecords();
  return NextResponse.json({ success: true, message: "Performance records cleared" });
}
