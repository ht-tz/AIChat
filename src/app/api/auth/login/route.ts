// 用户登录 API

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authService } from "@/server/auth";
import { generateCsrfToken } from "@/server/auth/auth-middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const body = LoginSchema.parse(raw);
    const result = await authService.login(body);

    const response = NextResponse.json({ user: result.user });
    response.cookies.set("auth-token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    const csrfToken = generateCsrfToken();
    response.cookies.set("csrf-token", csrfToken, {
      httpOnly: false, // 前端需要读取
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
