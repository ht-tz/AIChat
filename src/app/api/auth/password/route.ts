import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authService, requireAuth } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export const POST = requireAuth(async (req: NextRequest, ctx) => {
  try {
    const raw = await req.json();
    const body = ChangePasswordSchema.parse(raw);
    await authService.changePassword(ctx.user.userId, body.currentPassword, body.newPassword);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
});
