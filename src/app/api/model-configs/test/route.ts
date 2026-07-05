import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createProvider } from "@/server/providers";

const TestSchema = z.object({
  modelId: z.string().min(1),
  baseUrl: z.string().min(1),
  apiKey: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { modelId, baseUrl, apiKey } = TestSchema.parse(body);

    const provider = createProvider({
      apiKey,
      baseUrl,
      model: modelId,
    });

    if (provider.name === "mock") {
      return NextResponse.json(
        { ok: false, error: "无法创建有效的 Provider，请检查配置" },
        { status: 400 },
      );
    }

    const result = await provider.complete({
      messages: [{ role: "user", content: "hi" }],
      model: modelId,
      temperature: 0,
    });

    if (result && result.content) {
      return NextResponse.json({ ok: true, message: "连接成功" });
    }
    return NextResponse.json({ ok: false, error: "连接测试失败：无响应内容" }, { status: 400 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: err.errors }, { status: 400 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
