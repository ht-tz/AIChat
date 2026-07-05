// API 密钥管理 API

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authService, requireAuth } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  name: z.string().min(1),
  expiresInDays: z.number().int().min(1).optional(),
});

const DeleteSchema = z.object({
  keyId: z.string().uuid(),
});

export const GET = requireAuth(async (_req, ctx) => {
  const keys = await authService.listApiKeys(ctx.user.userId);
  return NextResponse.json({ keys });
});

export const POST = requireAuth(async (req, ctx) => {
  try {
    const raw = await req.json();
    const body = CreateSchema.parse(raw);
    const key = await authService.createApiKey(ctx.user.userId, body.name, body.expiresInDays);
    return NextResponse.json({ key });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
});

export const DELETE = requireAuth(async (req, ctx) => {
  try {
    const raw = await req.json();
    const body = DeleteSchema.parse(raw);
    const ok = await authService.revokeApiKey(ctx.user.userId, body.keyId);
    if (!ok) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
});
