// OAuth 服务 —— GitHub / Google Authorization Code Flow

import { nanoid } from "nanoid";

export type OAuthProvider = "github" | "google";

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
}

export interface OAuthUserInfo {
  providerUserId: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}

export interface OAuthAuthorizeParams {
  url: string;
  state: string;
}

// 内存 state 存储（防 CSRF）
const memoryStates: Map<string, { provider: OAuthProvider; createdAt: number }> = new Map();

const OAUTH_CONFIGS: Record<OAuthProvider, OAuthConfig> = {
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user",
    scope: "user:email",
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    scope: "openid email profile",
  },
};

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export class OAuthService {
  getConfig(provider: OAuthProvider): OAuthConfig {
    return OAUTH_CONFIGS[provider];
  }

  isConfigured(provider: OAuthProvider): boolean {
    const config = OAUTH_CONFIGS[provider];
    return !!(config.clientId && config.clientSecret);
  }

  /**
   * 生成授权 URL + state 参数
   */
  authorize(provider: OAuthProvider): OAuthAuthorizeParams {
    const config = OAUTH_CONFIGS[provider];
    const state = nanoid(32);
    const redirectUri = `${BASE_URL}/api/auth/oauth/${provider}/callback`;

    // 存储 state（5 分钟有效）
    memoryStates.set(state, { provider, createdAt: Date.now() });

    // 清理过期 state
    const now = Date.now();
    for (const [key, val] of memoryStates) {
      if (now - val.createdAt > 5 * 60 * 1000) {
        memoryStates.delete(key);
      }
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      scope: config.scope,
      state,
      response_type: "code",
    });

    const url = `${config.authorizeUrl}?${params.toString()}`;
    return { url, state };
  }

  /**
   * 验证 state 参数（防 CSRF）
   */
  verifyState(state: string): OAuthProvider | null {
    const entry = memoryStates.get(state);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > 5 * 60 * 1000) {
      memoryStates.delete(state);
      return null;
    }
    memoryStates.delete(state);
    return entry.provider;
  }

  /**
   * 用授权码换取 access_token
   */
  async exchangeCode(
    provider: OAuthProvider,
    code: string,
  ): Promise<{ accessToken: string; refreshToken?: string }> {
    const config = OAUTH_CONFIGS[provider];
    const redirectUri = `${BASE_URL}/api/auth/oauth/${provider}/callback`;

    const body: Record<string, string> = {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    if (provider === "github") {
      headers["Accept"] = "application/json";
    }

    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers,
      body: new URLSearchParams(body).toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OAuth token exchange failed: ${text}`);
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  }

  /**
   * 获取用户信息
   */
  async getUserInfo(provider: OAuthProvider, accessToken: string): Promise<OAuthUserInfo> {
    if (provider === "github") {
      return this.getGitHubUserInfo(accessToken);
    }
    return this.getGoogleUserInfo(accessToken);
  }

  private async getGitHubUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    // 获取基本信息
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!userRes.ok) {
      throw new Error("Failed to fetch GitHub user info");
    }
    const userData = await userRes.json();

    // 获取邮箱（user:email scope）
    let email: string | undefined;
    const emailRes = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (emailRes.ok) {
      const emails = (await emailRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primary = emails.find((e) => e.primary && e.verified);
      email = primary?.email || emails.find((e) => e.verified)?.email;
    }

    return {
      providerUserId: String(userData.id),
      email,
      name: userData.name || userData.login,
      avatarUrl: userData.avatar_url,
    };
  }

  private async getGoogleUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      throw new Error("Failed to fetch Google user info");
    }
    const data = await res.json();

    return {
      providerUserId: data.id,
      email: data.email,
      name: data.name,
      avatarUrl: data.picture,
    };
  }
}

export const oauthService = new OAuthService();
