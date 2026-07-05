// 当前用户信息 API

import { NextResponse } from "next/server";
import { requireAuth, authService } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = requireAuth(async (_req, ctx) => {
  // 查找完整用户信息以获取 emailVerified 和 provider
  const user = await authService.findUserById(ctx.user.userId);
  return NextResponse.json({
    user: user
      ? {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: user.emailVerified,
          provider: user.provider,
        }
      : ctx.user,
  });
});
