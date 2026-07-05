// OAuth 回调 —— GET /api/auth/oauth/:provider/callback?code=xxx&state=xxx

import { NextRequest, NextResponse } from "next/server";
import { oauthService, authService, type OAuthProvider } from "@/server/auth";
import { logger } from "@/server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PROVIDERS: OAuthProvider[] = ["github", "google"];

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const provider = params.provider as OAuthProvider;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Unsupported OAuth provider" }, { status: 400 });
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/auth?error=oauth_missing_params", req.url));
  }

  // 验证 state 防 CSRF
  const verifiedProvider = oauthService.verifyState(state);
  if (verifiedProvider !== provider) {
    return NextResponse.redirect(new URL("/auth?error=oauth_invalid_state", req.url));
  }

  try {
    // 换取 access_token
    const tokens = await oauthService.exchangeCode(provider, code);

    // 获取用户信息
    const userInfo = await oauthService.getUserInfo(provider, tokens.accessToken);

    // OAuth 登录或注册
    const result = await authService.oauthLogin({
      provider,
      providerUserId: userInfo.providerUserId,
      providerEmail: userInfo.email,
      name: userInfo.name,
      avatarUrl: userInfo.avatarUrl,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });

    // 设置 Cookie 并重定向到首页
    const response = NextResponse.redirect(new URL("/", req.url));
    response.cookies.set("auth-token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "[OAuth callback] error");
    return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(msg)}`, req.url));
  }
}
