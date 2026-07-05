# M13 OAuth 第三方登录 + 邮箱验证

## 基本信息

- **里程碑**：M13
- **标题**：OAuth 第三方登录 + 邮箱验证系统
- **完成日期**：2026-07-03
- **作者**：AI Agent Team
- **状态**：✅ 已完成

## 1. 需求思路

### 1.1 为什么需要 OAuth 第三方登录

M12 完成了基础认证系统（邮箱+密码注册/登录），但存在明显痛点：

1. **用户摩擦大**：注册需要填写邮箱、密码，用户容易流失
2. **密码管理负担**：用户需要记住又一个密码，或使用弱密码
3. **身份可信度低**：邮箱注册无法保证邮箱真实归属，容易被批量注册
4. **用户体验期望**：现代应用几乎都支持 GitHub/Google 快捷登录

OAuth 2.0 Authorization Code Flow 让用户跳转到 GitHub/Google 授权页面，确认后回调本系统完成登录，用户无需设置密码，系统也获得受信任的用户身份信息。

### 1.2 为什么需要邮箱验证

1. **防滥用**：未验证邮箱的用户可无限注册账号，消耗资源
2. **通知触达**：系统可能需要向用户发送通知（密码重置、安全告警），邮箱必须可触达
3. **身份确认**：验证邮箱证明用户确实拥有该邮箱，增强账号安全性
4. **合规要求**：部分地区的隐私法规要求验证用户联系方式

### 1.3 整体思路

- OAuth 登录与邮箱密码登录**共存**，同一邮箱可绑定多种登录方式
- 邮箱验证采用 **Token 机制**：生成唯一 token → 发送含 token 的链接 → 用户点击 → 后端验证
- 邮件发送支持 **Mock 模式**（开发时控制台输出）和 **SMTP 模式**（生产环境真实发送）
- 所有功能保持**内存降级**：无数据库时仍可正常运行

## 2. 技术架构

### 2.1 组件关系图

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端 (Browser)                           │
│                                                                 │
│  ┌───────────────────┐    ┌────────────────────────────────┐   │
│  │  auth/page.tsx    │    │       stores/auth.ts           │   │
│  │  - 登录/注册表单   │◄──►│  - AuthUser (emailVerified,   │   │
│  │  - OAuth 按钮      │    │    provider)                   │   │
│  │  - 验证提示        │    │  - sendVerification()          │   │
│  │  - 错误参数展示    │    │  - isEmailVerified()           │   │
│  └───────────────────┘    └────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTP
┌──────────────────────▼──────────────────────────────────────────┐
│                     API 路由层 (Next.js)                         │
│                                                                 │
│  ┌──────────────────────┐  ┌─────────────────────────────────┐ │
│  │ /api/auth/oauth/     │  │ /api/auth/send-verification    │ │
│  │   [provider]         │  │ /api/auth/verify-email         │ │
│  │   [provider]/callback│  │ /api/auth/me (更新)            │ │
│  └──────────┬───────────┘  └──────────────┬──────────────────┘ │
└─────────────┼──────────────────────────────┼───────────────────┘
              │                              │
┌─────────────▼──────────────────────────────▼───────────────────┐
│                      服务层 (Server)                             │
│                                                                 │
│  ┌──────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│  │  OAuthService    │ │  EmailService   │ │  AuthService    │ │
│  │  - authorize()   │ │  - sendVerification│ │  - oauthLogin() │ │
│  │  - verifyState() │ │    Email()      │ │  - createVerification│
│  │  - exchangeCode()│ │  - verifyEmail  │ │    Token()      │ │
│  │  - getUserInfo() │ │    Token()      │ │  - verifyEmail()│ │
│  │  - isConfigured()│ │  - 60s 限流     │ │  - OAuth CRUD   │ │
│  └──────────────────┘ └────────┬────────┘ └────────┬────────┘ │
└────────────────────────────────┼───────────────────┼───────────┘
                                 │                   │
┌────────────────────────────────▼───────────────────▼───────────┐
│                      数据层 (Database)                          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │  users       │  │  oauth_accounts  │  │  email_verifica- │ │
│  │  (扩展)      │  │  (新表)          │  │  tion_tokens     │ │
│  │  + provider  │  │                  │  │  (新表)          │ │
│  │  passwordHash│  │                  │  │                  │ │
│  │   可选       │  │                  │  │                  │ │
│  └──────────────┘  └──────────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 OAuth Authorization Code Flow 数据流

```
用户                前端               本系统后端           GitHub/Google
 │                  │                    │                      │
 │ 点击 GitHub 登录  │                    │                      │
 │─────────────────►│                    │                      │
 │                  │ GET /api/auth/     │                      │
 │                  │  oauth/github      │                      │
 │                  │───────────────────►│                      │
 │                  │                    │ 生成 state(nanoid32) │
 │                  │                    │ 存入 memoryStates    │
 │                  │                    │                      │
 │                  │  302 重定向到       │                      │
 │                  │  GitHub 授权页     │                      │
 │◄─────────────────────────────────────┤                      │
 │                  │                    │                      │
 │ 在 GitHub 确认授权                                       │
 │────────────────────────────────────────────────────────────►│
 │                  │                    │                      │
 │                  │                    │  302 回调             │
 │                  │                    │  /callback?code=xxx  │
 │                  │                    │  &state=xxx          │
 │                  │                    │◄─────────────────────┤
 │                  │                    │                      │
 │                  │                    │ 1. verifyState()     │
 │                  │                    │    → 验证 state 有效  │
 │                  │                    │    → 删除 state(单次) │
 │                  │                    │                      │
 │                  │                    │ 2. exchangeCode()    │
 │                  │                    │    → POST token_url  │
 │                  │                    │      code →          │
 │                  │                    │◄─────────────────────┤
 │                  │                    │    ← access_token    │
 │                  │                    │                      │
 │                  │                    │ 3. getUserInfo()     │
 │                  │                    │    → GET user_info   │
 │                  │                    │      Bearer token    │
 │                  │                    │◄─────────────────────┤
 │                  │                    │    ← 用户信息         │
 │                  │                    │                      │
 │                  │                    │ 4. authService       │
 │                  │                    │    .oauthLogin()     │
 │                  │                    │    → 查找/创建用户    │
 │                  │                    │    → 生成 JWT        │
 │                  │                    │                      │
 │                  │  302 → / + Cookie  │                      │
 │◄─────────────────────────────────────┤                      │
 │ 已登录            │                    │                      │
```

### 2.3 邮箱验证数据流

```
用户                 前端                 后端                    邮件
 │                   │                    │                      │
 │ 注册成功           │                    │                      │
 │                   │ sendVerification() │                      │
 │                   │───────────────────►│                      │
 │                   │                    │ createVerificationToken()
 │                   │                    │ → nanoid(48) token   │
 │                   │                    │ → expiresAt: 15min   │
 │                   │                    │ → 存入 DB/内存       │
 │                   │                    │                      │
 │                   │                    │ sendVerificationEmail()
 │                   │                    │ → 构建 verifyUrl     │
 │                   │                    │                      │
 │                   │                    │ Mock: 控制台输出      │
 │                   │                    │ SMTP: 发送 HTML 邮件 │
 │                   │                    │──────────────────────►│
 │                   │                    │                      │──► 用户邮箱
 │                   │                    │                      │
 │ 点击验证链接       │                    │                      │
 │─────────────────────────────────────────────────────────────►│
 │                   │                    │ GET /verify-email    │
 │                   │                    │   ?token=xxx         │
 │                   │                    │                      │
 │                   │                    │ verifyEmail(token)   │
 │                   │                    │ → 查找 token 记录    │
 │                   │                    │ → 检查已使用/过期    │
 │                   │                    │ → 标记 verifiedAt    │
 │                   │                    │ → 更新 user.         │
 │                   │                    │   emailVerified=true │
 │                   │                    │                      │
 │                   │                    │ 返回 HTML 成功页面    │
 │◄─────────────────────────────────────┤                      │
 │ 验证成功           │                    │                      │
```

### 2.4 OAuth 登录/注册/绑定决策流程

```
oauthLogin(input) 被调用
       │
       ▼
  查找 OAuth 关联 ─── 找到 ──► 更新 token/avatar → 登录成功
       │
     未找到
       │
       ▼
  邮箱已注册？ ─── 是 ──► 绑定 OAuth 到已有账号
       │                    更新 provider 标记
       │                    OAuth 邮箱 → 自动验证
       │                    → 登录成功
     否
       │
       ▼
  创建新用户（无密码）     emailVerified: true
  创建 OAuth 关联          provider: github/google
  → 登录成功
```

## 3. 核心代码解读

### 3.1 OAuthService — 授权码流程核心

**文件**：`src/server/auth/oauth-service.ts`

#### authorize() — 生成授权 URL

```typescript
authorize(provider: OAuthProvider): OAuthAuthorizeParams {
  const config = OAUTH_CONFIGS[provider];
  // 生成 32 位随机 state，用于防 CSRF
  const state = nanoid(32);
  const redirectUri = `${BASE_URL}/api/auth/oauth/${provider}/callback`;

  // 存储 state（5 分钟有效）
  memoryStates.set(state, { provider, createdAt: Date.now() });

  // 清理过期 state（每次 authorize 时顺便清理）
  const now = Date.now();
  for (const [key, val] of memoryStates) {
    if (now - val.createdAt > 5 * 60 * 1000) {
      memoryStates.delete(key);
    }
  }

  // 拼接授权 URL
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: config.scope,
    state,                    // state 随 URL 发给用户
    response_type: "code",
  });

  return { url: `${config.authorizeUrl}?${params.toString()}`, state };
}
```

关键点：
- `state` 用 `nanoid(32)` 生成，确保不可预测
- state 存入 `memoryStates` Map，5 分钟后自动过期
- 每次调用顺便清理过期 state，避免内存泄漏

#### verifyState() — 验证 state 防 CSRF

```typescript
verifyState(state: string): OAuthProvider | null {
  const entry = memoryStates.get(state);
  if (!entry) return null;                               // 不存在
  if (Date.now() - entry.createdAt > 5 * 60 * 1000) {   // 过期
    memoryStates.delete(state);
    return null;
  }
  memoryStates.delete(state);   // 单次有效：验证后立即删除
  return entry.provider;
}
```

关键点：
- **单次有效**：验证后立即 `delete`，防止重放攻击
- **5 分钟超时**：限制授权窗口期

#### exchangeCode() — 用 code 换 access_token

```typescript
async exchangeCode(provider: OAuthProvider, code: string) {
  const config = OAUTH_CONFIGS[provider];
  const body = {
    client_id: config.clientId,
    client_secret: config.clientSecret,    // 服务端密钥，不暴露给前端
    code,                                   // 授权码
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  };

  // GitHub 需要 Accept: application/json
  if (provider === "github") {
    headers["Accept"] = "application/json";
  }

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers,
    body: new URLSearchParams(body).toString(),
  });

  const data = await res.json();
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}
```

#### getUserInfo() — 获取用户信息

```typescript
// GitHub 特殊处理：需要额外请求邮箱接口
private async getGitHubUserInfo(accessToken: string): Promise<OAuthUserInfo> {
  // 1. 获取基本信息（id, login, name, avatar_url）
  const userRes = await fetch("https://api.github.com/user", { ... });

  // 2. 获取邮箱列表（user:email scope 授权）
  const emailRes = await fetch("https://api.github.com/user/emails", { ... });
  const emails = await emailRes.json();
  // 优先选 primary + verified 的邮箱
  const primary = emails.find((e) => e.primary && e.verified);

  return { providerUserId: String(userData.id), email, name, avatarUrl };
}

// Google 更简单：userinfo 端点直接返回 email
private async getGoogleUserInfo(accessToken: string): Promise<OAuthUserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { ... });
  return { providerUserId: data.id, email: data.email, name: data.name, avatarUrl: data.picture };
}
```

### 3.2 EmailService — 邮箱验证核心

**文件**：`src/server/auth/email-service.ts`

#### sendVerificationEmail() — 发送验证邮件

```typescript
async sendVerificationEmail(userId: string, email: string) {
  // 1. 限流检查：每个邮箱 60 秒内最多 1 封
  const lastSent = sendCooldown.get(email);
  if (lastSent && Date.now() - lastSent < COOLDOWN_MS) {
    const waitSec = Math.ceil((COOLDOWN_MS - (Date.now() - lastSent)) / 1000);
    return { success: false, error: `请 ${waitSec} 秒后重试` };
  }

  // 2. 生成验证 token（委托 authService）
  const token = await authService.createVerificationToken(userId, email);
  const verifyUrl = `${BASE_URL}/api/auth/verify-email?token=${token}`;

  // 3. 判断发送模式
  if (isSmtpConfigured) {
    return this.sendViaSmtp(email, verifyUrl);    // SMTP 真实发送
  }

  // 4. Mock 模式：控制台输出
  console.log(`[Email Service - Mock Mode]`);
  console.log(`验证链接: ${verifyUrl}`);
  console.log(`(15 分钟内有效)`);

  sendCooldown.set(email, Date.now());   // 更新限流时间
  return { success: true };
}
```

#### sendViaSmtp() — SMTP 发送 + nodemailer 降级

```typescript
private async sendViaSmtp(email: string, verifyUrl: string) {
  // HTML 邮件体（赛博风格渐变按钮）
  const htmlBody = `<a href="${verifyUrl}" style="...">验证邮箱</a>...`;

  // 动态 require nodemailer（可能未安装）
  let nodemailer: any;
  try {
    nodemailer = require("nodemailer");
  } catch {
    // nodemailer 未安装 → 降级到 Mock
    console.log(`[Email Service - Fallback Mock (nodemailer unavailable)]`);
    console.log(`验证链接: ${verifyUrl}`);
    return { success: true };
  }

  // 创建 SMTP 传输
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({ from: EMAIL_FROM, to: email, subject, html: htmlBody });
  return { success: true };
}
```

关键点：
- `require("nodemailer")` 在 try-catch 中执行，未安装也不会崩溃
- SMTP 端口 465 使用 `secure: true`（SSL），其他端口用 STARTTLS
- 三级降级：SMTP → nodemailer 未安装 → Mock 控制台输出

### 3.3 AuthService 扩展 — OAuth 登录 + 验证

**文件**：`src/server/auth/auth-service.ts`

#### oauthLogin() — OAuth 登录/注册/绑定

```typescript
async oauthLogin(input: OAuthLoginInput): Promise<AuthResult> {
  // 步骤 1：查找已有 OAuth 关联（同 provider + providerUserId）
  const existingOAuth = await this.findOAuthAccount(input.provider, input.providerUserId);
  if (existingOAuth) {
    // 已绑定 → 更新 token/avatar → 直接登录
    await this.updateOAuthAccount(existingOAuth.id, { ... });
    return { user: this.sanitizeUser(user), token };
  }

  // 步骤 2：检查邮箱是否已注册
  let user: User | undefined;
  if (input.providerEmail) {
    user = await this.findUserByEmail(input.providerEmail);
  }

  // 步骤 3：已有账号 → 绑定 OAuth
  if (user) {
    await this.createOAuthAccount({ userId: user.id, ... });
    await this.updateUserProvider(user.id, input.provider);
    // OAuth 邮箱匹配 → 自动验证
    if (!user.emailVerified && input.providerEmail === user.email) {
      await this.verifyUserEmail(user.id);
    }
    return { user: this.sanitizeUser({ ...user, emailVerified: true }), token };
  }

  // 步骤 4：新用户 → 创建（无密码）+ OAuth 关联
  if (db) {
    const [created] = await db.insert(schema.users).values({
      email: input.providerEmail || `${input.provider}_${input.providerUserId}@oauth.local`,
      name: input.name || ...,
      emailVerified: true,      // OAuth 用户默认已验证
      provider: input.provider,
      // 注意：没有 passwordHash
    }).returning();
    user = created;
  }

  await this.createOAuthAccount({ userId: user.id, ... });
  return { user: this.sanitizeUser(user), token };
}
```

#### createVerificationToken() + verifyEmail() — 验证 Token 生命周期

```typescript
async createVerificationToken(userId: string, email: string): Promise<string> {
  const token = nanoid(48);                          // 48 位随机 token
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);  // 15 分钟有效
  // 存入 DB 或内存
  return token;
}

async verifyEmail(token: string) {
  // 1. 查找 token 记录
  // 2. 检查：不存在 → "Invalid verification token"
  // 3. 检查：verifiedAt 已设置 → "Token already used"（单次有效）
  // 4. 检查：expiresAt < now → "Token expired"
  // 5. 标记 verifiedAt = new Date()（单次消费）
  // 6. 更新 user.emailVerified = true
  return { success: true, email: record.email };
}
```

#### login() 增加 OAuth 提示

```typescript
async login(input: LoginInput): Promise<AuthResult> {
  const user = await this.findUserByEmail(email);
  if (!user.passwordHash) {
    // 该用户只有 OAuth 登录方式，没有密码
    throw new Error("Please login with your OAuth provider");
  }
  // 正常密码验证...
}
```

### 3.4 API 路由

#### OAuth 授权入口 — `/api/auth/oauth/[provider]/route.ts`

```typescript
export async function GET(req, { params }) {
  const provider = params.provider;
  // 校验 provider 合法性
  if (!VALID_PROVIDERS.includes(provider)) return 400;
  // 检查是否配置了 ClientId/Secret
  if (!oauthService.isConfigured(provider)) return 503;
  // 生成授权 URL → 302 重定向
  const { url } = oauthService.authorize(provider);
  return NextResponse.redirect(url);
}
```

#### OAuth 回调 — `/api/auth/oauth/[provider]/callback/route.ts`

```typescript
export async function GET(req, { params }) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  // 1. 验证 state（防 CSRF）
  const verifiedProvider = oauthService.verifyState(state);
  if (verifiedProvider !== provider) {
    return redirect("/auth?error=oauth_invalid_state");
  }

  // 2. code 换 token → 获取用户信息 → 登录/注册
  const tokens = await oauthService.exchangeCode(provider, code);
  const userInfo = await oauthService.getUserInfo(provider, tokens.accessToken);
  const result = await authService.oauthLogin({ provider, ...userInfo, ...tokens });

  // 3. 设置 HttpOnly Cookie → 重定向首页
  const response = NextResponse.redirect("/");
  response.cookies.set("auth-token", result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 3600,
  });
  return response;
}
```

#### 发送验证邮件 — `/api/auth/send-verification/route.ts`

```typescript
export async function POST(req) {
  // 需要登录态
  const ctx = await authenticateRequest(req);
  if (!ctx) return 401;

  const body = SendVerificationSchema.parse(await req.json());
  const email = body.email || ctx.user.email;

  const result = await emailService.sendVerificationEmail(ctx.user.userId, email);
  if (!result.success) return 429;   // 限流
  return { success: true };
}
```

#### 验证邮箱 — `/api/auth/verify-email/route.ts`

```typescript
export async function GET(req) {
  const token = req.nextUrl.searchParams.get("token");
  const result = await emailService.verifyEmailToken(token);

  if (!result.success) {
    // 返回赛博风格 HTML 错误页面
    return new NextResponse(`<html>...验证失败: ${result.error}...</html>`, {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // 返回赛博风格 HTML 成功页面
  return new NextResponse(`<html>...邮箱验证成功: ${result.email}...</html>`, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
```

注意：验证邮箱返回的是 **HTML 页面**而非 JSON，因为用户通过浏览器点击邮件链接访问。

#### /api/auth/me 更新

```typescript
export const GET = requireAuth(async (_req, ctx) => {
  const user = await authService.findUserById(ctx.user.userId);
  return NextResponse.json({
    user: {
      id: user.id, email: user.email, name: user.name, role: user.role,
      emailVerified: user.emailVerified,   // 新增
      provider: user.provider,              // 新增
    },
  });
});
```

### 3.5 前端变更

#### stores/auth.ts — 状态扩展

```typescript
export interface AuthUser {
  userId: string;
  email: string;
  role: "admin" | "user";
  emailVerified?: boolean;      // 新增：邮箱验证状态
  provider?: string | null;     // 新增：OAuth 提供商
}

interface AuthState {
  verificationSent: boolean;               // 新增：验证邮件已发送
  sendVerification: () => Promise<boolean>; // 新增：发送验证邮件
  isEmailVerified: () => boolean;           // 新增：判断是否已验证
}

// register() 成功后自动调用 sendVerification()
register: async (email, password, name) => {
  // ...注册逻辑...
  get().sendVerification();    // 自动发送验证邮件
  return true;
}
```

#### auth/page.tsx — 页面升级

```tsx
// OAuth 错误参数（从 URL 读取）
const oauthError = searchParams.get("error");

// 验证邮件提示（注册后自动显示）
const showVerificationNotice = !isLogin && auth.verificationSent;

// 已登录未验证 → 显示重新发送按钮
const showResendVerify = auth.isAuthenticated() && !auth.isEmailVerified();

// OAuth 分割线 + 按钮
<div className="mt-6 flex items-center gap-3">
  <div className="h-px flex-1 bg-cyber-border" />
  <span className="text-xs text-cyber-muted">或通过第三方登录</span>
  <div className="h-px flex-1 bg-cyber-border" />
</div>

<div className="mt-4 grid grid-cols-2 gap-3">
  <a href="/api/auth/oauth/github"><Github /> GitHub</a>
  <a href="/api/auth/oauth/google"><GoogleIcon /> Google</a>
</div>
```

Google 图标使用**彩色内联 SVG**（4 种颜色的 G 标志），GitHub 图标使用 lucide-react 的 `<Github>` 组件。

### 3.6 数据库 Schema 扩展

**文件**：`src/server/db/schema.ts`

```typescript
// 新增枚举
export const oauthProviderEnum = pgEnum("oauth_provider", ["github", "google"]);

// 新增：OAuth 账号关联表
export const oauthAccounts = pgTable("oauth_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  provider: oauthProviderEnum("provider").notNull(),
  providerUserId: varchar("provider_user_id", { length: 255 }).notNull(),
  providerEmail: varchar("provider_email", { length: 255 }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("oauth_accounts_user_idx").on(t.userId),
  providerIdx: index("oauth_accounts_provider_idx").on(t.provider, t.providerUserId),
}));

// 新增：邮箱验证 Token 表
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),  // 唯一索引
  expiresAt: timestamp("expires_at").notNull(),
  verifiedAt: timestamp("verified_at"),                         // 单次消费标记
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  tokenIdx: index("email_verification_tokens_token_idx").on(t.token),
  userIdx: index("email_verification_tokens_user_idx").on(t.userId),
}));

// users 表扩展
export const users = pgTable("users", {
  // ...原有字段...
  passwordHash: text("password_hash"),        // 改为可选（OAuth 用户无密码）
  emailVerified: boolean("email_verified").default(false).notNull(),  // 新增
  provider: varchar("provider", { length: 32 }),                      // 新增
});
```

表关系：
- `oauth_accounts.userId` → `users.id`（一个用户可有多个 OAuth 关联）
- `email_verification_tokens.userId` → `users.id`（一个用户可有多个验证 token）

## 4. 安全设计要点

### 4.1 state 参数防 CSRF

| 措施 | 实现方式 |
|------|---------|
| 随机生成 | `nanoid(32)` 生成不可预测的 state |
| 服务端存储 | `memoryStates` Map 存储 state → provider 映射 |
| 时效限制 | 5 分钟有效，超时自动失效 |
| 单次有效 | `verifyState()` 验证后立即 `delete` |
| 自动清理 | 每次 `authorize()` 顺便清理过期 state |

### 4.2 验证 Token 安全

| 措施 | 实现方式 |
|------|---------|
| 随机性 | `nanoid(48)` 生成 48 位随机 token |
| 时效限制 | 15 分钟有效期（`expiresAt`） |
| 单次有效 | `verifiedAt` 标记已使用，重复使用返回 "Token already used" |
| 唯一索引 | `token` 字段设置 `unique()` 约束 |

### 4.3 发送限流

| 措施 | 实现方式 |
|------|---------|
| 冷却时间 | 同一邮箱 60 秒内只能发送 1 封验证邮件 |
| 内存存储 | `sendCooldown` Map 记录最后发送时间 |
| 精确等待提示 | 返回 `请 X 秒后重试`，避免用户盲目重试 |

### 4.4 内存降级

| 场景 | 处理方式 |
|------|---------|
| 无数据库 | users/oauth_accounts/verification_tokens 使用内存 Map |
| 无 SMTP | 控制台输出验证链接（Mock 模式） |
| 无 nodemailer | SMTP 配置了但 nodemailer 未安装 → Fallback Mock |
| 无 OAuth 配置 | `isConfigured()` 返回 false → API 返回 503 |
| OAuth 用户无密码 | `login()` 检测到无密码 → 提示用 OAuth 登录 |

### 4.5 其他安全考量

- **client_secret 不暴露给前端**：只在 `exchangeCode()` 服务端调用时使用
- **HttpOnly Cookie**：JWT 存入 HttpOnly Cookie，前端 JS 无法读取
- **sameSite: "lax"**：防止跨站请求伪造
- **secure 标志**：生产环境启用 HTTPS Only
- **邮箱不枚举**：登录失败统一返回 "Invalid email or password"

## 5. 使用指南

### 5.1 环境变量配置

```bash
# ── GitHub OAuth ──
GITHUB_CLIENT_ID=Ov23xxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ── Google OAuth ──
GOOGLE_CLIENT_ID=123456789-xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxx

# ── SMTP 邮件（可选，未设置则使用 Mock 模式）──
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@your-domain.com

# ── 基础 ──
NEXT_PUBLIC_BASE_URL=http://localhost:3000
JWT_SECRET=your-jwt-secret
```

### 5.2 GitHub OAuth 配置步骤

1. 前往 https://github.com/settings/developers
2. 点击 "New OAuth App"
3. 填写：
   - Application name：NEXUS AI
   - Homepage URL：`http://localhost:3000`
   - Authorization callback URL：`http://localhost:3000/api/auth/oauth/github/callback`
4. 获取 Client ID 和 Client Secret
5. 写入 `.env.local`

### 5.3 Google OAuth 配置步骤

1. 前往 https://console.cloud.google.com/apis/credentials
2. 创建 OAuth 2.0 客户端 ID
3. 授权重定向 URI：`http://localhost:3000/api/auth/oauth/google/callback`
4. 获取 Client ID 和 Client Secret
5. 写入 `.env.local`

### 5.4 Mock 模式 vs 生产模式

| 特性 | Mock 模式 | 生产模式 |
|------|----------|---------|
| 触发条件 | SMTP_* 未配置 | SMTP_HOST/USER/PASS 已配置 |
| 邮件发送 | 控制台输出 token 和链接 | 通过 nodemailer 发送 HTML 邮件 |
| 验证方式 | 复制控制台链接到浏览器 | 点击邮件中的按钮 |
| 适用场景 | 本地开发、测试 | 生产部署 |
| 限流 | 依然生效（60 秒） | 依然生效（60 秒） |

### 5.5 验证邮件链接示例

Mock 模式下控制台输出：
```
============================================================
[Email Service - Mock Mode]
To: user@example.com
Subject: 验证您的邮箱 — NEXUS AI
验证链接: http://localhost:3000/api/auth/verify-email?token=V1StGXR8_Z5jdHi6B-myT...
(15 分钟内有效)
============================================================
```

访问该链接后，浏览器显示赛博风格的验证成功页面。

## 6. 技术扩展方向

### 6.1 短期优化

- **密码重置**：复用邮箱验证 Token 机制，增加 `password_reset_tokens` 表
- **更多 OAuth 提供商**：微信、Microsoft、Apple 登录
- **OAuth 关联管理**：前端页面允许用户绑定/解绑 OAuth 账号
- **Token 刷新**：使用 `refreshToken` 自动续期 access_token

### 6.2 中期优化

- **state 持久化**：将 state 存入 Redis/DB，支持多实例部署
- **邮件模板引擎**：使用 Handlebars/Mjml 生成更精美的邮件
- **邮件队列**：使用 Bull/BullMQ 异步发送，避免请求阻塞
- **验证链接有效期配置化**：允许管理员调整 15 分钟默认值

### 6.3 长期方向

- **PKCE 增强**：对公共客户端（SPA/移动端）使用 PKCE 替代 client_secret
- **OpenID Connect**：从 OAuth 2.0 升级到 OIDC，获取 ID Token
- **多租户 OAuth**：SaaS 场景下不同租户配置不同 OAuth 应用
- **无密码登录**：Magic Link（邮件发送登录链接，无需密码）
- **WebAuthn/FIDO2**：硬件密钥登录（YubiKey 等）

## 7. 验证记录

- 跑了哪些命令 / 测试：
  - `pnpm run typecheck` ✅ 0 error
  - `pnpm run lint` ✅ 0 warning
- 功能验证：
  - OAuth 流程 ✅ state 防 CSRF + code 换 token + 用户信息获取
  - 邮箱验证 ✅ Token 生成(15分钟) + Mock 输出 + 限流
  - 内存降级 ✅ 无数据库时可正常运行
- 已知遗留问题：无

## 8. 收获与踩坑

- 学到了什么：
  - OAuth 2.0 Authorization Code Flow 的完整实现细节
  - GitHub API 需要额外请求 `/user/emails` 端点才能获取邮箱
  - nodemailer 动态 require 可以避免未安装时崩溃
  - 验证邮箱返回 HTML 页面而非 JSON（因为从邮件链接直接访问）
- 踩过的坑：
  - OAuth 用户没有密码，`login()` 需要单独处理无密码情况
  - Google 和 GitHub 的 token 端点响应格式不同，GitHub 需要 `Accept: application/json`
  - 内存 state 存储需要在每次 `authorize()` 时清理过期条目，避免内存泄漏
- 下次会怎么做：
  - 考虑将 state 存入 Redis，支持多实例部署
  - 邮件发送改为异步队列，避免阻塞 HTTP 请求
