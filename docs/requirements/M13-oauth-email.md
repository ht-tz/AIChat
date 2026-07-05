# M13 · OAuth 第三方登录 + 邮箱验证

## 基本信息

- **里程碑**：M13
- **标题**：OAuth 第三方登录 + 邮箱验证（OAuth & Email Verification）
- **负责人**：AI Agent
- **创建日期**：2026-07-03
- **状态**：🚧 进行中

## 1. 背景与目标

M12 已完成基础邮箱密码认证体系，但用户体验仍有两大痛点：

1. **注册门槛高**：用户必须填写邮箱和密码，无法快速使用已有 GitHub / Google 账号登录
2. **邮箱未验证**：注册后邮箱未经确认，无法保证用户身份真实，也无法向用户发送通知邮件

M13 在 M12 基础上扩展两大功能：
- **OAuth 第三方登录**：支持 GitHub 和 Google 授权登录，新用户自动创建账号，老用户可绑定
- **邮箱验证**：注册时发送验证邮件，验证后更新 `emailVerified`，未验证时提醒用户

## 2. 用户故事

1. 作为新用户，我希望用 GitHub / Google 账号一键登录，以便快速开始使用平台
2. 作为已注册用户，我希望绑定 GitHub / Google 账号，以便后续使用第三方方式登录
3. 作为用户，我希望注册后收到验证邮件并完成验证，以便确认我的邮箱地址有效
4. 作为用户，我希望未收到验证邮件时可以重新发送，以便避免邮件丢失导致无法验证
5. 作为管理员，我希望系统对敏感操作有 rate limiting，以便防止恶意滥用

## 3. 功能范围

### 3.1 包含（In Scope）

- GitHub OAuth 登录（Authorization Code Flow）
- Google OAuth 登录（Authorization Code Flow）
- 新用户 OAuth 登录自动创建账号
- 已注册用户绑定 OAuth 账号
- 注册时发送验证邮件
- 重发验证邮件
- 验证链接点击完成邮箱验证
- 开发环境 Mock 邮件模式（控制台输出 token）
- 生产环境 SMTP 邮件发送
- OAuth state 参数防 CSRF
- 验证 token 单次有效、15 分钟过期
- 发送验证邮件 rate limiting
- 敏感信息（OAuth access_token）加密存储
- 前端登录页面 OAuth 按钮
- 前端注册成功提示 + 未验证提醒

### 3.2 不包含（Out of Scope）

- 更多 OAuth 提供商（微信、Apple 等，后续迭代）
- 双因素认证（2FA）
- 邮箱验证后的欢迎邮件
- OAuth token 自动刷新（refresh_token 存储但暂不实现刷新流程）
- 已绑定 OAuth 账号的解绑功能（后续迭代）
- 密码重置 / 忘记密码流程（后续迭代）

## 4. 需求思路

### 4.1 OAuth 登录流程

```
用户点击「GitHub 登录」按钮
  → 前端调用 GET /api/auth/oauth/github → 返回授权 URL + state
  → 前端重定向到 GitHub 授权页
  → 用户授权后 GitHub 回调 /api/auth/oauth/github/callback?code=xxx&state=xxx
  → 后端用 code 换取 access_token，获取用户信息
  → 判断是否已有关联用户：
      是 → 更新 token，签发 JWT，重定向到首页
      否 → 自动创建用户 + oauth_accounts 记录，签发 JWT，重定向到首页
```

### 4.2 OAuth 账号绑定流程

```
已登录用户在设置页点击「绑定 GitHub」
  → 前端调用 GET /api/auth/oauth/github（携带 JWT）
  → 重定向到 GitHub 授权页
  → 回调时后端识别已登录用户 → 创建 oauth_accounts 关联
  → 重定向回设置页，显示绑定成功
```

### 4.3 邮箱验证流程

```
用户注册 → 后端创建用户（emailVerified=false）→ 生成验证 token → 发送邮件
  → 用户点击邮件中的验证链接
  → GET /api/auth/verify-email?token=xxx
  → 后端校验 token（未过期、未使用）→ 更新 emailVerified=true，标记 verifiedAt
  → 重定向到登录页，显示验证成功
```

## 5. 技术架构

### 5.1 数据库扩展

#### 新增 oauth_accounts 表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uuid | PK, default gen | 主键 |
| userId | uuid | FK → users.id, NOT NULL | 关联用户 |
| provider | varchar | NOT NULL | 提供商：github / google |
| providerUserId | varchar | NOT NULL | 第三方用户 ID |
| providerEmail | varchar | | 第三方邮箱 |
| accessToken | text | NOT NULL | 加密存储的 access_token |
| refreshToken | text | | 加密存储的 refresh_token |
| avatarUrl | text | | 第三方头像 URL |
| createdAt | timestamp | default now() | 创建时间 |

索引：`UNIQUE(provider, providerUserId)`

#### 新增 email_verification_tokens 表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uuid | PK, default gen | 主键 |
| userId | uuid | FK → users.id, NOT NULL | 关联用户 |
| email | varchar | NOT NULL | 待验证邮箱 |
| token | varchar | NOT NULL, UNIQUE | 验证令牌 |
| expiresAt | timestamp | NOT NULL | 过期时间 |
| verifiedAt | timestamp | nullable | 验证完成时间 |
| createdAt | timestamp | default now() | 创建时间 |

#### users 表扩展

新增字段：

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| provider | varchar | nullable | 注册来源：github / google / email |

### 5.2 API 端点设计

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/auth/oauth/:provider` | optionalAuth | 生成授权 URL + state，返回 `{ url, state }` |
| GET | `/api/auth/oauth/:provider/callback?code=&state=` | 无 | OAuth 回调，换 token、创建/关联用户、签发 JWT、重定向 |
| POST | `/api/auth/send-verification` | requireAuth | 发送验证邮件，body `{ email }` |
| GET | `/api/auth/verify-email?token=xxx` | 无 | 验证邮箱，更新 emailVerified |
| GET | `/api/auth/me` | requireAuth | 返回当前用户信息（含 emailVerified） |

### 5.3 后端服务层

#### 新增 OAuthService 类（`src/server/auth/oauth-service.ts`）

```
OAuthService
  - getAuthorizationUrl(provider, userId?) → { url, state }
  - handleCallback(provider, code, state) → { user, token }
  - findOAuthAccount(provider, providerUserId) → OAuthAccount | null
  - createOAuthAccount(data) → OAuthAccount
  - linkOAuthAccount(userId, provider, code) → OAuthAccount
  - encryptToken(token) → string
  - decryptToken(encrypted) → string
```

#### 新增 EmailService 类（`src/server/auth/email-service.ts`）

```
EmailService
  - sendVerificationEmail(userId, email) → { token }
  - verifyEmail(token) → { success, email }
  - generateVerificationToken() → string
  - sendEmail(to, subject, html) → void（Mock 模式走控制台）
```

#### 扩展 AuthService（`src/server/auth/auth-service.ts`）

```
AuthService（新增方法）
  - findUserByOAuth(provider, providerUserId) → User | null
  - createUserFromOAuth(provider, providerEmail, name, avatarUrl) → User
```

### 5.4 前端变更

#### 登录页面（`src/app/auth/page.tsx`）

- 在邮箱密码登录区域下方添加分割线（"— 或使用第三方登录 —"）
- 添加 GitHub 和 Google 登录按钮
- 点击按钮 → 调用 `/api/auth/oauth/:provider` → 重定向到授权页

#### 注册成功后

- 隐藏表单，显示"请查收验证邮件"提示页
- 提供"重新发送验证邮件"按钮

#### 已登录未验证提醒

- 在顶部导航栏或页面顶部显示黄色提醒条："您的邮箱尚未验证，请查收验证邮件或重新发送"
- 提供"重新发送"链接

#### 新增 Zustand store 扩展（`src/stores/auth.ts`）

```
新增方法：
  - sendVerification() → 调用 POST /api/auth/send-verification
  - oauthLogin(provider) → 调用 GET /api/auth/oauth/:provider 并重定向
```

### 5.5 安全设计

| 安全项 | 实现方式 |
|--------|----------|
| CSRF 防护 | OAuth state 参数：生成随机 state，存入内存 Map/Redis，回调时校验 |
| Token 保密 | OAuth access_token / refresh_token 使用 AES-256-GCM 加密后存库 |
| 验证 Token | 单次有效，使用后标记 verifiedAt；15 分钟过期 |
| Rate Limiting | 同一邮箱 60 秒内仅允许发送 1 次验证邮件 |
| JWT 安全 | 复用 M12 的 JWT 签发与验证逻辑 |

### 5.6 邮件服务设计

**Mock 模式**（开发环境，未配置 SMTP）：
- 不发送真实邮件
- 在控制台输出验证链接：`[Mock Email] Verification URL: http://localhost:3000/api/auth/verify-email?token=xxx`
- 通过环境变量 `EMAIL_MOCK=true` 或 SMTP 未配置时自动启用

**SMTP 模式**（生产环境）：
- 使用 nodemailer 发送 HTML 邮件
- 邮件内容包含平台 Logo、验证按钮、过期提示
- 验证链接格式：`${BASE_URL}/api/auth/verify-email?token=xxx`

### 5.7 环境变量

```env
# OAuth - GitHub
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# OAuth - Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Email
EMAIL_FROM=noreply@nexus.dev
SMTP_HOST=             # 可选，未设置则 Mock
SMTP_PORT=             # 可选
SMTP_USER=             # 可选
SMTP_PASS=             # 可选
EMAIL_MOCK=true        # 显式启用 Mock 模式

# 加密密钥（用于加密 OAuth token）
TOKEN_ENCRYPTION_KEY=  # 32 字节 hex 字符串

# 基础 URL（用于生成回调地址和邮件链接）
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## 6. 验收标准

- [ ] 用户可以通过 GitHub OAuth 登录，新用户自动创建账号
- [ ] 用户可以通过 Google OAuth 登录，新用户自动创建账号
- [ ] 已注册用户登录后可以绑定 GitHub / Google 账号
- [ ] OAuth 登录后 JWT 正确签发，用户状态正确更新
- [ ] 注册后自动发送验证邮件（Mock 模式下控制台可看到验证链接）
- [ ] 点击验证链接后 `emailVerified` 更新为 true
- [ ] 未验证用户登录后看到验证提醒，可重新发送验证邮件
- [ ] 验证 token 15 分钟后失效
- [ ] 验证 token 使用后失效（不可重复使用）
- [ ] 同一邮箱 60 秒内不能重复发送验证邮件
- [ ] OAuth state 参数正确校验，伪造 state 被拒绝
- [ ] OAuth access_token 加密存储在数据库中
- [ `pnpm typecheck` 0 error
- [ ] 前端登录页面显示 GitHub / Google 按钮
- [ ] 前端注册成功后显示验证邮件提示

## 7. 风险与备选

| 风险 | 影响 | 备选方案 |
|------|------|----------|
| Google OAuth 审核周期长 | 无法立即使用 Google 登录 | 先上线 GitHub，Google 审核通过后启用 |
| SMTP 服务不稳定 | 用户收不到验证邮件 | 提供 Mock 模式 + 重发机制 + 控制台日志备查 |
| OAuth 提供商 API 变更 | 登录失败 | 使用官方 SDK 最新版本，做好错误兜底 |
| state 参数内存存储重启丢失 | 回调验证失败 | 后续迭代改为 Redis 存储；当前重启后用户重新发起授权即可 |

## 8. 拆分与排期

| 序号 | 子任务 | 预估时间 |
|------|--------|----------|
| 1 | 数据库 schema 扩展（oauth_accounts、email_verification_tokens、users.provider） | 0.5 天 |
| 2 | OAuthService 实现（GitHub + Google 授权 URL 生成、回调处理） | 1 天 |
| 3 | EmailService 实现（token 生成、验证、Mock/SMTP 发送） | 0.5 天 |
| 4 | OAuth API 路由实现 | 0.5 天 |
| 5 | 邮箱验证 API 路由实现 | 0.5 天 |
| 6 | AuthService 扩展（OAuth 用户查找/创建） | 0.5 天 |
| 7 | 前端登录页 OAuth 按钮 + 注册成功提示 + 未验证提醒 | 1 天 |
| 8 | Zustand store 扩展 + 联调 | 0.5 天 |
| 9 | 安全加固（state 校验、token 加密、rate limiting） | 0.5 天 |
| 10 | 自测 + 修复 | 0.5 天 |
| **合计** | | **6 天** |

## 9. 自测计划

### OAuth 登录测试

1. 点击 GitHub 登录按钮 → 跳转到 GitHub 授权页
2. 授权后回调 → 自动创建用户 → 跳转首页 → 已登录状态
3. 再次 GitHub 登录 → 直接进入首页（已有账号）
4. 重复 1-3 测试 Google OAuth

### 邮箱验证测试

1. 注册新用户 → 控制台输出验证链接（Mock 模式）
2. 点击验证链接 → 跳转登录页，显示验证成功
3. 登录后 `emailVerified` 为 true
4. 再次点击同一验证链接 → 提示已过期/已使用
5. 点击"重新发送" → 生成新 token

### 安全测试

1. 篡改 state 参数 → 回调被拒绝
2. 使用过期 token（等 16 分钟）→ 验证失败
3. 快速连续点击发送验证邮件 → rate limiting 拦截
4. 数据库中 access_token 非明文

## 10. 关联文档

- 前置里程碑：`docs/requirements/M12-auth-system.md`
- 学习文档：`docs/learning/M13-oauth-email.md`（待创建）
- GitHub OAuth 文档：https://docs.github.com/en/apps/oauth-apps
- Google OAuth 文档：https://developers.google.com/identity/protocols/oauth2
