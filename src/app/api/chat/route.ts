// SSE 流式对话 API
// 接收 ChatRequest，返回 ReadableStream<text/event-stream>
// M2 升级：接入 runAgent 调度器，支持 tools 参数与 tool_call/tool_result 事件

import { NextRequest } from "next/server";
import { z } from "zod";
import { runAgent } from "@/server/agent/dispatcher";
import { createProvider } from "@/server/providers";
import { toolRegistry } from "@/server/tools";
import { applyRateLimit, validateText } from "@/server/middleware";
import { recordPerformance } from "@/server/monitoring/performance";
import { optionalAuth } from "@/server/auth";
import { modelConfigService } from "@/server/model-config-service";
import type { AgentStep, Attachment } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AttachmentSchema = z.object({
  id: z.string(),
  type: z.enum(["file", "image"]),
  name: z.string(),
  url: z.string(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
  fileId: z.string().optional(),
});

const BodySchema = z.object({
  sessionId: z.string().optional(),
  agentId: z.string().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant", "tool"]),
        content: z.string(),
        name: z.string().optional(),
        toolCallId: z.string().optional(),
        attachments: z.array(AttachmentSchema).optional(),
      }),
    )
    .min(1),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  enablePlan: z.boolean().optional(),
  enableReflection: z.boolean().optional(),
  requireHITL: z.array(z.string()).optional(),
  enabledTools: z.array(z.string()).optional(),
  maxToolRounds: z.number().int().min(0).max(5).optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
});

function sseEncode(chunk: AgentStep): Uint8Array {
  const payload = `data: ${JSON.stringify(chunk)}\n\n`;
  return new TextEncoder().encode(payload);
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const authCtx = await optionalAuth(req);
  const ip = getClientIp(req);
  const { allowed, headers: rateLimitHeaders } = await applyRateLimit(ip, "/api/chat");
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded", message: "请稍后再试" }), {
      status: 429,
      headers: { "content-type": "application/json", ...rateLimitHeaders },
    });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    const raw = await req.json();
    body = BodySchema.parse(raw);
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid request body", detail: String(err) }), {
      status: 400,
      headers: { "content-type": "application/json", ...rateLimitHeaders },
    });
  }

  const lastUserMsg = [...body.messages].reverse().find((m) => m.role === "user");
  if (lastUserMsg) {
    const validation = validateText(lastUserMsg.content);
    if (!validation.valid) {
      recordPerformance("/api/chat", "POST", Date.now() - startTime, 400);
      return new Response(JSON.stringify({ error: "Invalid input", details: validation.errors }), {
        status: 400,
        headers: { "content-type": "application/json", ...rateLimitHeaders },
      });
    }
  }

  const allTools = toolRegistry.list();
  const tools =
    body.enabledTools && body.enabledTools.length > 0
      ? allTools.filter((t) => body.enabledTools!.includes(t.name))
      : allTools;

  const messagesWithAttachments = body.messages.map((m) => ({
    role: m.role,
    content: m.content,
    name: m.name,
    toolCallId: m.toolCallId,
    attachments: m.attachments as Attachment[] | undefined,
  }));

  let resolvedApiKey = body.apiKey || process.env.OPENAI_API_KEY;
  let resolvedBaseUrl = body.baseUrl || process.env.OPENAI_BASE_URL;
  let resolvedTemperature = body.temperature;

  if (authCtx && !body.apiKey && body.model) {
    try {
      const cfg = await modelConfigService.resolveConfig(authCtx.user.userId, body.model);
      if (cfg) {
        resolvedApiKey = cfg.apiKey;
        resolvedBaseUrl = cfg.baseUrl;
        if (!resolvedTemperature && cfg.temperature != null) {
          resolvedTemperature = cfg.temperature;
        }
      }
    } catch {
      // ignore resolution errors, will fail below if no key
    }
  }

  if (!resolvedApiKey) {
    return new Response(
      JSON.stringify({ error: "未配置 API Key", message: "请在设置页面中为该模型配置 API Key" }),
      { status: 400, headers: { "content-type": "application/json", ...rateLimitHeaders } },
    );
  }

  const effectiveBaseUrl = resolvedBaseUrl || "https://api.openai.com/v1";

  let totalTokens = 0;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const step of runAgent({
          messages: messagesWithAttachments,
          tools: tools.length > 0 ? tools : undefined,
          model: body.model,
          temperature: resolvedTemperature,
          signal: req.signal,
          maxToolRounds: body.maxToolRounds ?? 5,
          enablePlan: body.enablePlan,
          enableReflection: body.enableReflection,
          dbSessionId: body.sessionId,
          getProvider: () =>
            createProvider({
              apiKey: resolvedApiKey!,
              baseUrl: effectiveBaseUrl,
              model: body.model,
            }),
        })) {
          controller.enqueue(sseEncode(step));
          if (step.kind === "done" && step.usage) {
            totalTokens = step.usage.total;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(sseEncode({ kind: "error", message: msg }));
      } finally {
        recordPerformance("/api/chat", "POST", Date.now() - startTime, 200, totalTokens);
        controller.close();
      }
    },
    cancel() {
      recordPerformance(
        "/api/chat",
        "POST",
        Date.now() - startTime,
        499,
        totalTokens,
        "client cancelled",
      );
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
      ...rateLimitHeaders,
    },
  });
}

export async function GET() {
  return new Response(
    JSON.stringify({
      ok: true,
      endpoint: "/api/chat",
      method: "POST",
      tools: toolRegistry.listMeta(),
    }),
    { headers: { "content-type": "application/json" } },
  );
}
