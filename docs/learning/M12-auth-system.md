# M12 权限认证系统

## 基本信息

- **里程碑**：M12
- **标题**：权限认证系统（Authentication & Authorization）
- **完成日期**：2026-07-03
- **作者**：AI Agent Team
- **状态**：✅ 已完成

## 1. 需求回顾

当前系统对所有用户完全开放，缺少身份认证和访问控制。M12 实现基础权限认证系统，包括用户注册/登录、JWT Token 管理、API 密钥、角色权限控制。参考需求文档：[`docs/requirements/M12-auth-system.md`](../requirements/M12-auth-system.md)

## 2. 思路与设计

### 2.1 关键决策

1. **密码存储**：使用 bcrypt 进行哈希，避免明文存储
2. **认证方式**：JWT Token + HttpOnly Cookie，同时支持 Bearer API Key
3. **角色模型**：基础二角色（admin / user），admin 拥有更高权限
4. **无数据库降级**：当 DATABASE_URL 未设置时使用内存存储，便于开发调试
5. **API 安全**：通过 `requireAuth` / `requireRole` 中间件保护受保护路由

### 2.2 数据流 / 调用链

**注册流程**：
```
用户提交邮箱/密码 → /api/auth/register → bcrypt.hash → 写入 users 表 → 生成 JWT → 设置 Cookie
```

**登录流程**：
```
用户提交邮箱/密码 → /api/auth/login → 查询用户 → bcrypt.compare → 生成 JWT → 设置 Cookie
```

**请求认证流程**：
```
请求到达 → authenticateRequest → 检查 Authorization Bearer → API Key 或 JWT → 或检查 Cookie → 返回 AuthContext
```

### 2.3 异常 / 边界处理

- **邮箱重复注册**：返回明确错误信息
- **密码错误**：统一返回 "Invalid email or password"，避免枚举攻击
- **Token 过期/无效**：返回 401 Unauthorized
- **无数据库**：自动降级到内存存储，第一个注册用户为 admin

## 3. 技术架构

### 3.1 模块划分

| 文件 | 职责 |
|------|------|
| `src/server/db/schema.ts` | 用户表、API 密钥表、角色/状态枚举 |
| `src/server/auth/auth-service.ts` | 注册、登录、JWT、API 密钥管理 |
| `src/server/auth/auth-middleware.ts` | 认证中间件、角色校验 |
| `src/server/auth/index.ts` | 统一导出 |
| `src/app/api/auth/register/route.ts` | 注册 API |
| `src/app/api/auth/login/route.ts` | 登录 API |
| `src/app/api/auth/logout/route.ts` | 登出 API |
| `src/app/api/auth/me/route.ts` | 当前用户信息 API |
| `src/app/api/auth/api-keys/route.ts` | API 密钥管理 API |
| `src/stores/auth.ts` | 前端认证状态管理 |
| `src/app/auth/page.tsx` | 登录/注册页面 |

### 3.2 关键类型 / 接口

```typescript
export interface TokenPayload {
  userId: string;
  email: string;
  role: "admin" | "user";
}

export interface AuthContext {
  user: TokenPayload;
  token: string;
}

export interface ApiKeyResult {
  id: string;
  name: string;
  key: string;
  prefix: string;
  status: "active" | "revoked";
  createdAt: Date;
  expiresAt?: Date | null;
}
```

### 3.3 关键代码片段

**密码哈希与比较**：
```typescript
const passwordHash = await bcrypt.hash(input.password, 10);
const valid = await bcrypt.compare(input.password, user.passwordHash);
```

**JWT 生成与验证**：
```typescript
const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
```

**认证中间件**：
```typescript
export function requireAuth(handler: (req: NextRequest, ctx: AuthContext) => Promise<NextResponse> | NextResponse) {
  return async (req: NextRequest) => {
    const ctx = await authenticateRequest(req);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(req, ctx);
  };
}
```

## 4. 技术拓展

- **OAuth 第三方登录**：集成 GitHub、Google、微信等第三方登录
- **邮箱验证**：注册后发送验证邮件
- **密码重置**：通过邮箱链接重置密码
- **多租户支持**：在资源表中增加 tenantId 字段
- **细粒度 RBAC**：引入权限表和资源级权限控制
- **双因素认证**：支持 TOTP/SMS 二次验证
- **SSO 单点登录**：企业级 SAML/OIDC 集成

## 5. 示例

### 5.1 怎么用

**注册**：
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"123456","name":"User"}'
```

**登录**：
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"123456"}' \
  -c cookies.txt
```

**创建 API 密钥**：
```bash
curl -X POST http://localhost:3000/api/auth/api-keys \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"开发密钥","expiresInDays":30}'
```

**使用 API 密钥访问**：
```bash
curl -H "Authorization: Bearer ak_xxxxxxxx" http://localhost:3000/api/auth/me
```

### 5.2 最小可运行示例

**保护 API 路由**：
```typescript
import { requireAuth, requireRole } from "@/server/auth";

export const GET = requireAuth(async (req, ctx) => {
  return NextResponse.json({ user: ctx.user });
});

export const DELETE = requireRole(["admin"], async (req, ctx) => {
  // 仅 admin 可执行
  return NextResponse.json({ success: true });
});
```

## 6. 验证记录

- 跑了哪些命令 / 测试：
  - `pnpm run typecheck` ✅ 0 error
  - `pnpm run lint` ✅ 0 warning
- 浏览器表现：登录/注册页面正常渲染，Cookie 正确设置
- 已知遗留问题：
  - ISSUE-M12-001：OAuth 第三方登录
  - ISSUE-M12-002：邮箱验证
  - ISSUE-M12-003：将核心 API 路由接入认证保护

## 7. 收获与踩坑

- 学到了什么：
  - bcrypt 在 pnpm 下需要批准构建脚本
  - Next.js API Route 中设置 HttpOnly Cookie 的方式
  - JWT 与 API Key 双认证模式的设计
- 踩过的坑：
  - bcrypt 原生模块未构建导致运行时错误，需执行 `pnpm approve-builds` 和 `pnpm rebuild bcrypt`
- 下次会怎么做：
  - 安装原生依赖后立即验证构建状态
  - 开发阶段预留内存降级模式，避免强依赖数据库
