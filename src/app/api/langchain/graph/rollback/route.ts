// M19: 时间旅行 API —— 从指定 Checkpoint 回滚并重新执行

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { HITLWorkflowEngine } from "@/server/langchain/checkpoint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RollbackSchema = z.object({
  threadId: z.string().min(1),
  checkpointId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof RollbackSchema>;
  try {
    body = RollbackSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await HITLWorkflowEngine.rollback(body.threadId, body.checkpointId);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
