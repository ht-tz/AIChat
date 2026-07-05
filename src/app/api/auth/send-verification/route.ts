// 发送验证邮件 —— POST /api/auth/send-verification

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { emailService, authenticateRequest } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SendVerificationSchema = z.object({
  email: z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // 需要登录
    const ctx = await authenticateRequest(req);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const raw = await req.json();
    const body = SendVerificationSchema.parse(raw);
    const email = body.email || ctx.user.email;

    const result = await emailService.sendVerificationEmail(ctx.user.userId, email);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 429 });
    }

    return NextResponse.json({ success: true, message: "验证邮件已发送" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
