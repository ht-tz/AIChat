import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createProvider } from "@/server/providers";
import { requireAuth } from "@/server/auth/auth-middleware";

const TestSchema = z.object({
  modelId: z.string().min(1),
  baseUrl: z.string().min(1),
  apiKey: z.string().min(1),
});

export const POST = requireAuth(async (req, _ctx) => {
  try {
    const body = await req.json();
    const { modelId, baseUrl, apiKey } = TestSchema.parse(body);

    // SSRF 防护：只允许 http/https 协议，禁止内网地址
    const url = new URL(baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      return NextResponse.json({ ok: false, error: "仅支持 http/https 协议" }, { status: 400 });
    }
    const hostname = url.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("172.") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return NextResponse.json({ ok: false, error: "不允许访问内网地址" }, { status: 400 });
    }

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
});
