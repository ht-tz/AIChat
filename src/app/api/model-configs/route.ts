import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { modelConfigService } from "@/server/model-config-service";
import { authenticateRequest } from "@/server/auth/auth-middleware";

const SaveSchema = z.object({
  modelId: z.string().min(1),
  label: z.string().default(""),
  vendor: z.string().default(""),
  baseUrl: z.string().min(1),
  apiKey: z.string().min(1, "API Key 不能为空"),
  temperature: z.number().min(0).max(2).default(0.7),
});

export async function GET(req: NextRequest) {
  const authCtx = await authenticateRequest(req);
  const userId = authCtx?.user.userId ?? null;
  if (!userId) {
    return NextResponse.json({ configs: [], activeModelId: null });
  }

  try {
    const configs = await modelConfigService.listConfigs(userId);
    const activeModelId = await modelConfigService.getActiveModelId(userId);
    return NextResponse.json({ configs, activeModelId });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load configs", detail: String(err) },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const authCtx = await authenticateRequest(req);
  const userId = authCtx?.user.userId ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const input = SaveSchema.parse(body);
    const config = await modelConfigService.saveConfig(userId, input);
    return NextResponse.json({ config });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: err.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to save config", detail: String(err) },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const authCtx = await authenticateRequest(req);
  const userId = authCtx?.user.userId ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const modelId = url.searchParams.get("modelId");
  if (!modelId) {
    return NextResponse.json({ error: "modelId is required" }, { status: 400 });
  }

  try {
    await modelConfigService.deleteConfig(userId, modelId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to delete config", detail: String(err) },
      { status: 500 },
    );
  }
}

export async function PUT() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
