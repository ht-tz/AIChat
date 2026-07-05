// M19: 状态历史 API —— 查询 thread 的所有 Checkpoint（时间旅行）

import { NextRequest } from "next/server";
import { HITLWorkflowEngine } from "@/server/langchain/checkpoint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { threadId: string } }) {
  const { threadId } = params;
  if (!threadId) {
    return new Response(JSON.stringify({ error: "threadId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const history = await HITLWorkflowEngine.getStateHistory(threadId);
    const meta = HITLWorkflowEngine.getThread(threadId);

    return new Response(
      JSON.stringify({
        threadId,
        metadata: meta,
        history,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
