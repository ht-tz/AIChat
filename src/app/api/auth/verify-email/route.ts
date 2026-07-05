// 验证邮箱 —— GET /api/auth/verify-email?token=xxx

import { NextRequest, NextResponse } from "next/server";
import { emailService } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const result = await emailService.verifyEmailToken(token);

  if (!result.success) {
    // 返回 HTML 页面显示错误
    return new NextResponse(
      `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>验证失败</title>
<style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0a0a1a;color:#e6e8f2}
.card{text-align:center;padding:40px;border-radius:16px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.05)}
h2{color:#ef4444}p{color:#9ca3af;margin-top:12px}a{color:#00F0FF}</style></head>
<body><div class="card"><h2>验证失败</h2><p>${escapeHtml(result.error || "未知错误")}</p>
<p><a href="/">返回首页</a></p></div></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  // 返回 HTML 页面显示成功
  return new NextResponse(
    `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>验证成功</title>
<style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0a0a1a;color:#e6e8f2}
.card{text-align:center;padding:40px;border-radius:16px;border:1px solid rgba(0,240,255,0.3);background:rgba(0,240,255,0.05)}
h2{color:#00F0FF}p{color:#9ca3af;margin-top:12px}a{color:#00F0FF}</style></head>
<body><div class="card"><h2>邮箱验证成功</h2>
<p>${escapeHtml(result.email || "")} 已完成验证</p>
<p><a href="/">返回首页</a></p></div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
