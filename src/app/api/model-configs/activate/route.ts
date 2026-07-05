import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { modelConfigService } from "@/server/model-config-service";
import { authenticateRequest } from "@/server/auth/auth-middleware";

const ActivateSchema = z.object({
  modelId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const authCtx = await authenticateRequest(req);
  const userId = authCtx?.user.userId ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { modelId } = ActivateSchema.parse(body);
    await modelConfigService.activateModel(userId, modelId);
    return NextResponse.json({ ok: true, activeModelId: modelId });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: err.errors }, { status: 400 });
    }
    return NextResponse.json(
      {
        error: "Failed to activate model",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
