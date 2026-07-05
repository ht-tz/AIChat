// A/B 测试 API
// POST /api/ab-test —— 对比两个提示词模板的输出

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { executeABTest } from "@/server/prompts/playground-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VariableSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  defaultValue: z.string().optional(),
});

const TemplateSchema = z.object({
  systemPrompt: z.string().min(1),
  variables: z.array(VariableSchema).default([]),
  name: z.string(),
});

const BodySchema = z.object({
  templateA: TemplateSchema,
  templateB: TemplateSchema,
  variableValues: z.record(z.string()).default({}),
  userMessage: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof BodySchema>;
  try {
    const raw = await req.json();
    body = BodySchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", detail: String(err) },
      { status: 400 },
    );
  }

  try {
    const result = await executeABTest({
      templateA: body.templateA,
      templateB: body.templateB,
      variableValues: body.variableValues,
      userMessage: body.userMessage,
      model: body.model,
      temperature: body.temperature,
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
