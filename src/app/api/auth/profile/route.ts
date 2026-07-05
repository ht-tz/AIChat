import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authService, requireAuth } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(128).optional(),
});

export const PATCH = requireAuth(async (req: NextRequest, ctx) => {
  try {
    const raw = await req.json();
    const body = UpdateProfileSchema.parse(raw);
    const user = await authService.updateProfile(ctx.user.userId, body);
    return NextResponse.json({ user });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
});
