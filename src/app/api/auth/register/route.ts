// 用户注册 API

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authService } from "@/server/auth";
import { generateCsrfToken } from "@/server/auth/auth-middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const body = RegisterSchema.parse(raw);
    const result = await authService.register(body);

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
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
