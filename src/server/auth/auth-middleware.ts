// 认证中间件 —— 验证 JWT 或 API Key

import { NextRequest, NextResponse } from "next/server";
import { authService, type TokenPayload } from "./auth-service";

export interface AuthContext {
  user: TokenPayload;
  token: string;
}

export async function authenticateRequest(req: NextRequest): Promise<AuthContext | null> {
  const authHeader = req.headers.get("authorization");

  // 1. 尝试 API Key
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token.startsWith("ak_")) {
      const user = await authService.validateApiKey(token);
      if (user) {
        return {
          user: {
            userId: user.id,
            email: user.email,
            role: user.role,
          },
          token,
        };
      }
    }

    // 2. 尝试 JWT
    const payload = authService.verifyToken(token);
    if (payload) {
      return { user: payload, token };
    }
  }

  // 3. 尝试 Cookie
  const cookieToken = req.cookies.get("auth-token")?.value;
  if (cookieToken) {
    const payload = authService.verifyToken(cookieToken);
    if (payload) {
      return { user: payload, token: cookieToken };
    }
  }

  return null;
}

export function requireAuth(
  handler: (req: NextRequest, ctx: AuthContext) => Promise<NextResponse> | NextResponse,
) {
  return async (req: NextRequest) => {
    const ctx = await authenticateRequest(req);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(req, ctx);
  };
}

export function requireRole(
  roles: Array<"admin" | "user">,
  handler: (req: NextRequest, ctx: AuthContext) => Promise<NextResponse> | NextResponse,
) {
  return requireAuth((req, ctx) => {
    if (!roles.includes(ctx.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handler(req, ctx);
  });
}

export async function optionalAuth(req: NextRequest): Promise<AuthContext | null> {
  return authenticateRequest(req);
}
