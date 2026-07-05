// 启动多智能体运行 (SSE 流式响应)
// M18: 支持 engine 参数切换自研 / LangGraph 引擎

import { NextRequest } from "next/server";
import { z } from "zod";
import { WorkflowEngine, WORKFLOW_TEMPLATES, type MaEvent } from "@/server/multi-agent";
import { LangGraphEngine } from "@/server/langchain/graph";
import { storeRun } from "@/server/multi-agent/run-store";
import { authenticateRequest } from "@/server/auth/auth-middleware";
import { modelConfigService } from "@/server/model-config-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RunSchema = z.object({
  goal: z.string().min(1).max(5000),
  workflowTemplateId: z.string().optional(),
  customStages: z.array(z.any()).optional(),
  /** M18: 引擎切换 —— "builtin" (默认) | "langgraph" */
  engine: z.enum(["builtin", "langgraph"]).optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
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

  const engineKind = body.engine ?? "builtin";
  const encoder = new TextEncoder();

  const authCtx = await authenticateRequest(req);
  const userId = authCtx?.user.userId;
  let apiKey = body.apiKey?.trim() || undefined;
  let baseUrl = body.baseUrl?.trim() || undefined;
  const model = body.model?.trim() || undefined;

  if (!apiKey && userId && model) {
    const resolved = await modelConfigService.resolveForRequest(userId, model);
    if (resolved) {
      apiKey = resolved.apiKey;
      baseUrl = resolved.baseUrl;
    }
  }

  const llmConfig = {
    apiKey,
    baseUrl,
    model,
  };

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: MaEvent) => {
        const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      try {
        if (engineKind === "langgraph") {
          // ===== LangGraph 引擎 =====
          const engine = new LangGraphEngine({
            goal: body.goal,
            workflowTemplateId: body.workflowTemplateId,
            onEvent: sendEvent,
            llmConfig,
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
        } else {
          // ===== 自研引擎（默认） =====
          const engine = new WorkflowEngine({
            goal: body.goal,
            workflowTemplateId: body.workflowTemplateId,
            customStages: body.customStages,
            onEvent: sendEvent,
            llmConfig,
          });

          const initialRun = engine.getRun();
          sendEvent({
            type: "log",
            runId: initialRun.id,
            timestamp: Date.now(),
            data: {
              message: `[自研] 工作流引擎已启动，共 ${initialRun.totalStages} 个阶段 / ${initialRun.totalSteps} 个任务`,
              engine: "builtin",
            },
          });

          await engine.execute();
          const finalRun = engine.getRun();
          storeRun(finalRun);
        }
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
