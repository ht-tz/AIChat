// M18: LangGraph 工作流执行 API（SSE）
// 学习点：与 /api/multi-agent/run 协议完全兼容，仅引擎不同
// 对比自研：src/app/api/multi-agent/run/route.ts

import { NextRequest } from "next/server";
import { z } from "zod";
import { LangGraphEngine } from "@/server/langchain/graph";
import type { MaEvent } from "@/server/multi-agent/workflow-engine";
import { storeRun } from "@/server/multi-agent/run-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RunSchema = z.object({
  goal: z.string().min(1).max(5000),
  workflowTemplateId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof RunSchema>;
  try {
    body = RunSchema.parse(await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: MaEvent) => {
        const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      try {
        const engine = new LangGraphEngine({
          goal: body.goal,
          workflowTemplateId: body.workflowTemplateId,
          onEvent: sendEvent,
        });

        sendEvent({
          type: "log",
          runId: engine.getRunId(),
          timestamp: Date.now(),
          data: {
            message: `[LangGraph] 图执行已启动，模板: ${engine.getTemplate().name}`,
            engine: "langgraph",
          },
        });

        const result = await engine.execute();

        // 持久化 run（与自研保持一致的存储格式）
        storeRun({
          id: result.runId,
          teamId: body.workflowTemplateId,
          goal: result.goal,
          status: "completed",
          totalStages: result.template.stages.length,
          completedStages: result.template.stages.length,
          totalSteps: result.steps.length,
          completedSteps: result.steps.filter((s) => s.status === "completed").length,
          stages: result.template.stages,
          steps: result.steps,
          finalAnswer: result.finalAnswer,
          durationMs: result.durationMs,
          startedAt: Date.now() - result.durationMs,
          completedAt: Date.now(),
          createdAt: Date.now(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(
            `event: run_failed\ndata: ${JSON.stringify({ error: msg, timestamp: Date.now() })}\n\n`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
