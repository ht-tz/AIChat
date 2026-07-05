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

  // 检查环境变量（不暴露值，只检查是否配置）
  const envChecks = {
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || "(not set)",
    DEFAULT_MODEL: process.env.DEFAULT_MODEL || "(not set)",
    LLM_PROVIDER: process.env.LLM_PROVIDER || "(not set)",
    DATABASE_URL: !!process.env.DATABASE_URL,
    JWT_SECRET: !!process.env.JWT_SECRET,
    ENCRYPTION_KEY: !!process.env.ENCRYPTION_KEY,
  };

  return NextResponse.json(
    {
      status: allHealthy ? "ok" : "degraded",
      version: process.env.npm_package_version || "0.0.0",
      timestamp: new Date().toISOString(),
      checks,
      env: envChecks,
    },
    { status: allHealthy ? 200 : 503 },
  );
}
