// M19: HITL 工作流启动 API
// 启动带 interrupt_before 的工作流，执行到 approval_gate 自动暂停

import { NextRequest } from "next/server";
import { z } from "zod";
import { HITLWorkflowEngine } from "@/server/langchain/checkpoint";
import type { MaEvent } from "@/server/multi-agent/workflow-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const StartSchema = z.object({
  goal: z.string().min(1).max(5000),
  workflowTemplateId: z.string().optional(),
  threadId: z.string().optional(),
  hitlMode: z.enum(["final", "tool"]).optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof StartSchema>;
  try {
    body = StartSchema.parse(await req.json());
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
        const llmConfig = {
          apiKey: body.apiKey?.trim() || undefined,
          baseUrl: body.baseUrl?.trim() || undefined,
          model: body.model?.trim() || undefined,
        };

        const engine = new HITLWorkflowEngine({
          goal: body.goal,
          workflowTemplateId: body.workflowTemplateId,
          threadId: body.threadId,
          hitlMode: body.hitlMode,
          onEvent: sendEvent,
          llmConfig,
        });

        sendEvent({
          type: "log",
          runId: engine.getRunId(),
          timestamp: Date.now(),
          data: {
            message: `[HITL] 启动带人工审批的工作流，模板: ${engine.getTemplate().name}`,
            threadId: engine.getThreadId(),
            hitl: true,
          },
        });

        const result = await engine.start();

        controller.enqueue(
          encoder.encode(
            `event: hitl_paused\ndata: ${JSON.stringify({
              type: "hitl_paused",
              runId: result.runId,
              timestamp: Date.now(),
              data: {
                threadId: result.threadId,
                status: result.status,
                pausedAt: result.pausedAt,
                pausedReason: result.pausedReason,
                hitlMode: result.hitlMode,
                pendingToolCall: result.pendingToolCall ?? null,
                action: "请调用 /api/langchain/graph/resume 提交审批决定",
              },
            })}\n\n`,
          ),
        );
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
