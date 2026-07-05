// 健康检查端点 — GET /api/health

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = {};

  // 数据库连接检查
  try {
    const { db } = await import("@/server/db");
    if (db) {
      await db.execute("SELECT 1");
      checks.database = "ok";
    } else {
      checks.database = "disabled";
    }
  } catch {
    checks.database = "error";
  }

  const allHealthy = Object.values(checks).every((v) => v === "ok" || v === "disabled");

  return NextResponse.json(
    {
      status: allHealthy ? "ok" : "degraded",
      version: process.env.npm_package_version || "0.0.0",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allHealthy ? 200 : 503 },
  );
}
