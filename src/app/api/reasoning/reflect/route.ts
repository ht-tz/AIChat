// 推理 API —— 反思与工具选择

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { reflect, selectToolsByRules, DEFAULT_TOOL_RULES, type ToolRule } from "@/server/reasoning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ReflectSchema = z.object({
  error: z.string().min(1),
  toolName: z.string().optional(),
  toolArgs: z.record(z.unknown()).optional(),
  retryCount: z.number().default(0),
  maxRetries: z.number().default(3),
});

const ToolSelectSchema = z.object({
  availableTools: z.array(z.string()),
  rules: z
    .array(
      z.object({
        toolName: z.string(),
        action: z.enum(["prefer", "allow", "deny"]),
        condition: z.string().optional(),
        priority: z.number().optional(),
      }),
    )
    .default([]),
  userMessage: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  const raw = await req.json();

  // 判断请求类型
  if (raw.error) {
    // 反思请求
    try {
      const body = ReflectSchema.parse(raw);
      const result = reflect(
        body.error,
        body.toolName,
        body.toolArgs,
        body.retryCount,
        body.maxRetries,
      );
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json(
        { error: "Invalid reflection request", detail: String(err) },
        { status: 400 },
      );
    }
  }

  if (raw.availableTools && raw.userMessage) {
    // 工具选择请求
    try {
      const body = ToolSelectSchema.parse(raw);
      const rules = body.rules.length > 0 ? body.rules : DEFAULT_TOOL_RULES;
      const result = selectToolsByRules(body.availableTools, rules, body.userMessage);
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json(
        { error: "Invalid tool selection request", detail: String(err) },
        { status: 400 },
      );
    }
  }

  return NextResponse.json(
    {
      error:
        "Unknown request type. Provide 'error' for reflection or 'availableTools'+'userMessage' for tool selection.",
    },
    { status: 400 },
  );
}
