// M18 补全：addConditionalEdges 条件路由 API
// 支持两种示例：评审回环（review-loop）和智能分流（router）

import { NextRequest } from "next/server";
import { z } from "zod";
import {
  runReviewLoop,
  runRouterGraph,
  getConditionalEdgeComparison,
} from "@/server/langchain/conditional-edges";
import type { MaEvent } from "@/server/multi-agent/workflow-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LoopSchema = z.object({
  type: z.enum(["review-loop", "router"]),
  goal: z.string().min(1).max(5000).optional(),
  query: z.string().min(1).max(5000).optional(),
  maxIterations: z.number().min(1).max(10).optional(),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof LoopSchema>;
  try {
    body = LoopSchema.parse(await req.json());
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
        if (body.type === "review-loop") {
          const result = await runReviewLoop({
            goal: body.goal || "写一篇关于 AI Agent 的介绍文章",
            maxIterations: body.maxIterations ?? 3,
            onEvent: sendEvent,
          });

          controller.enqueue(
            encoder.encode(
              `event: log\ndata: ${JSON.stringify({
                type: "log",
                runId: result.runId,
                timestamp: Date.now(),
                data: {
                  message: `[回环模式] 完成：${result.iterations} 轮迭代，最终评分 ${result.finalScore}，${result.passed ? "通过" : "未通过"}`,
                  iterations: result.iterations,
                  score: result.finalScore,
                  passed: result.passed,
                },
              })}\n\n`,
            ),
          );
        } else if (body.type === "router") {
          const result = await runRouterGraph(
            body.query || body.goal || "什么是 LRU 缓存？",
            sendEvent,
          );

          controller.enqueue(
            encoder.encode(
              `event: log\ndata: ${JSON.stringify({
                type: "log",
                runId: result.runId,
                timestamp: Date.now(),
                data: {
                  message: `[分流模式] 完成：分类为 ${result.category}`,
                  category: result.category,
                },
              })}\n\n`,
            ),
          );
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

export async function GET() {
  return new Response(JSON.stringify({ comparison: getConditionalEdgeComparison() }), {
    headers: { "Content-Type": "application/json" },
  });
}
