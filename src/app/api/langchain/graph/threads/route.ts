// M19: Thread 列表 API —— 列出所有 HITL 工作流 thread

import { NextResponse } from "next/server";
import { HITLWorkflowEngine } from "@/server/langchain/checkpoint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const threads = HITLWorkflowEngine.listThreads();
  return NextResponse.json({
    threads,
    total: threads.length,
  });
}
