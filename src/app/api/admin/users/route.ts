import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authService, requireAuth } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = requireAuth(async (_req: NextRequest, ctx) => {
  try {
    const users = await authService.listUsers(ctx.user.userId);
    return NextResponse.json({ users });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes("Admin") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
});

const UpdateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "user"]),
});

export const PATCH = requireAuth(async (req: NextRequest, ctx) => {
  try {
    const raw = await req.json();
    const body = UpdateRoleSchema.parse(raw);
    await authService.updateUserRole(ctx.user.userId, body.userId, body.role);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes("Admin") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
});

const DeleteSchema = z.object({
  userId: z.string().uuid(),
});

export const DELETE = requireAuth(async (req: NextRequest, ctx) => {
  try {
    const raw = await req.json();
    const body = DeleteSchema.parse(raw);
    await authService.deleteUser(ctx.user.userId, body.userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes("Admin") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
});
