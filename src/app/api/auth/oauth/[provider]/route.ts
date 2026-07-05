// OAuth 授权入口 —— GET /api/auth/oauth/:provider

import { NextRequest, NextResponse } from "next/server";
import { oauthService, type OAuthProvider } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PROVIDERS: OAuthProvider[] = ["github", "google"];

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const provider = params.provider as OAuthProvider;

  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Unsupported OAuth provider" }, { status: 400 });
  }

  if (!oauthService.isConfigured(provider)) {
    return NextResponse.json({ error: `${provider} OAuth is not configured` }, { status: 503 });
  }

  const { url } = oauthService.authorize(provider);
  return NextResponse.redirect(url);
}
