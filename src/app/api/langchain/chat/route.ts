// M16: LangChain 对话 API
// 学习对比：使用 LangChain ChatModel vs 自研 Provider 进行对话

import { NextRequest, NextResponse } from "next/server";
import { LangChainProvider } from "@/server/langchain/provider";
import { optionalAuth } from "@/server/auth";

export async function POST(req: NextRequest) {
  const authCtx = await optionalAuth(req);

  try {
    const body = await req.json();
    const { messages, model, temperature } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages is required" }, { status: 400 });
    }

    const provider = new LangChainProvider();

    // 流式输出
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const step of provider.stream({
            messages,
            model,
            temperature,
          })) {
            const data = `data: ${JSON.stringify(step)}\n\n`;
            controller.enqueue(encoder.encode(data));

            if (step.kind === "done" || step.kind === "error") {
              controller.close();
              return;
            }
          }
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ kind: "error", message: (err as Error).message })}\n\n`,
            ),
          );
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
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
