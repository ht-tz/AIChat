// 推理 API —— 任务分解

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPlanTree, serializePlanTree } from "@/server/reasoning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  goal: z.string().min(1),
  availableTools: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof BodySchema>;
  try {
    const raw = await req.json();
    body = BodySchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", detail: String(err) },
      { status: 400 },
    );
  }

  try {
    const plan = createPlanTree(body.goal, body.availableTools);
    const serialized = serializePlanTree(plan);
    return NextResponse.json({
      planId: plan.id,
      goal: plan.goal,
      tasks: Array.from(plan.tasks.entries()).map(([id, t]) => ({
        id,
        title: t.title,
        description: t.description,
        toolName: t.toolName,
        dependencies: t.dependencies,
        status: t.status,
        maxRetries: t.maxRetries,
      })),
      executionOrder: plan.executionOrder,
      serialized,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
