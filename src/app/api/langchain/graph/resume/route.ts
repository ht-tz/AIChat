// M19: 断点续跑 API —— 从 HITL 暂停点继续执行
// 支持多次暂停/恢复：工具审批模式下 resume 可能再次暂停在下一个 gate 节点

import { NextRequest } from "next/server";
import { z } from "zod";
import { HITLWorkflowEngine } from "@/server/langchain/checkpoint";
import type { MaEvent } from "@/server/multi-agent/workflow-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ResumeSchema = z.object({
  threadId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof ResumeSchema>;
  try {
    body = ResumeSchema.parse(await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: MaEvent | { type: string; [k: string]: unknown }) => {
        const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      try {
        const llmConfig = {
          apiKey: body.apiKey?.trim() || undefined,
          baseUrl: body.baseUrl?.trim() || undefined,
          model: body.model?.trim() || undefined,
        };

        const result = await HITLWorkflowEngine.resume(
          body.threadId,
          body.decision,
          sendEvent as (event: MaEvent) => void,
          llmConfig,
        );

        if (result.status === "rejected") {
          sendEvent({
            type: "run_failed",
            runId: "",
            timestamp: Date.now(),
            data: { error: "审批被拒绝，工作流终止", threadId: body.threadId },
          });
        } else if (result.status === "paused") {
          // 再次暂停（例如：通过了工具审批门，现在停在终稿审批门）
          sendEvent({
            type: "hitl_paused",
            runId: "",
            timestamp: Date.now(),
            data: {
              threadId: body.threadId,
              status: "paused",
              pausedAt: result.pausedAt,
              pausedReason: result.pausedReason,
              pendingToolCall: result.pendingToolCall ?? null,
              message:
                result.pausedReason === "tool_call"
                  ? `工作流再次暂停：${result.pendingToolCall?.agentRole} 请求调用 ${result.pendingToolCall?.toolName}`
                  : "工作流已暂停，等待终稿审批",
            },
          });
        } else {
          sendEvent({
            type: "log",
            runId: "",
            timestamp: Date.now(),
            data: {
              message: `[HITL] 续跑完成，工作流已结束`,
              threadId: result.threadId,
              finalAnswer: result.finalAnswer?.slice(0, 200),
            },
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        sendEvent({
          type: "run_failed",
          runId: "",
          timestamp: Date.now(),
          data: { error: msg },
        });
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
