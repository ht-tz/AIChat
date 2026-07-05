# T3 · Drizzle ORM + PostgreSQL + JWT 认证 · 学习文档

> **5 段式**：概念详解 / 代码思路 / 技术架构 / 技术拓展 / 示例
> 配套项目代码：`src/server/db/`、`src/server/auth/`、`src/app/api/`

## 基本信息

- **编号**：T3（技术栈-Tech）
- **标题**：数据库 ORM 与身份认证
- **完成日期**：2026-07-04
- **作者**：NEXUS
- **状态**：✅ 已完成

---

## 1. 概念详解

### 1.1 ORM 是什么？

ORM（Object-Relational Mapper，对象关系映射）是**在代码对象和数据库表之间建立映射**的工具。用 TypeScript 定义 schema，用 TypeScript 函数写查询，不需要手写 SQL 字符串。

#### 为什么不直接写 SQL？

| 直接写 SQL | 使用 ORM（Drizzle） |
|-----------|---------------------|
| 字符串拼接，容易写错，编译时检查不了 | 类型安全，字段名写错 TS 直接报错 |
| 迁移需要手写 SQL 脚本 | 自动生成迁移 |
| 结果类型需要手动声明 | 查询结果自动推导类型 |
| SQL 注入风险（拼接用户输入时） | 参数化查询，自动防注入 |

### 1.2 Drizzle ORM — 类 SQL 的 TypeScript ORM

Drizzle 是一个"像写 SQL 一样"的 TypeScript ORM，不像 Prisma 那样发明一套新的查询语言，而是让你写出非常接近原生 SQL 的代码。

```typescript
// Drizzle 查询
const users = await db
  .select()
  .from(users)
  .where(eq(users.role, "admin"))
  .orderBy(desc(users.createdAt))
  .limit(10);

// 等价 SQL：SELECT * FROM users WHERE role = 'admin' ORDER BY created_at DESC LIMIT 10;
```

Drizzle 有三个核心部分：
1. **Schema 定义**：用 TypeScript 定义表结构
2. **Drizzle Kit**：CLI 工具，生成迁移、推送 schema
3. **Drizzle ORM**：运行时查询 API

#### Schema 定义

```typescript
// src/server/db/schema.ts
import { pgTable, uuid, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"),
  name: varchar("name", { length: 128 }).default(""),
  role: varchar("role", { length: 16 }).default("user").notNull(), // 'admin' | 'user'
  emailVerified: boolean("email_verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
});

// 推导 TypeScript 类型
export type User = typeof users.$inferSelect;    // 查询返回的类型
export type NewUser = typeof users.$inferInsert; // 插入时的类型
```

#### 常用查询操作

```typescript
import { eq, ne, gt, lt, like, inArray, and, or, desc, asc, isNull } from "drizzle-orm";

// 1. 查询单条
const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
// 或用 .get()（Drizzle 扩展）

// 2. 插入
const [newUser] = await db.insert(users).values({
  email: "xLi5@MJwnU6R.6dQ",
  passwordHash: hash,
  name: "测试用户",
}).returning(); // .returning() 返回插入的行

// 3. 更新
await db.update(users)
  .set({ name: "新昵称", updatedAt: new Date() })
  .where(eq(users.id, userId));

// 4. 删除
await db.delete(users).where(eq(users.id, userId));

// 5. 条件组合
const results = await db.select().from(users).where(
  and(
    eq(users.role, "user"),
    gt(users.createdAt, oneWeekAgo),
    isNull(users.deletedAt)
  )
);

// 6. 分页
const page = await db.select().from(users)
  .orderBy(desc(users.createdAt))
  .limit(20)
  .offset(0);

// 7. 聚合
const count = await db.select({ count: count() }).from(users);
```

#### 数据库迁移

```bash
pnpm db:generate    # 基于 schema 变化生成迁移 SQL
pnpm db:push        # 直接推送 schema 到数据库（开发环境方便）
pnpm db:studio      # 打开 Web 版数据库管理 UI
```

### 1.3 PostgreSQL — 关系数据库

PostgreSQL（简称 Postgres）是本项目使用的关系数据库。选择它的原因：

1. **开源免费**，功能强大
2. **类型丰富**：支持 uuid、jsonb、数组、全文搜索等
3. **生态成熟**：有 pgvector 扩展（向量搜索，RAG 用）
4. **Drizzle 一等支持**

本项目的降级策略：当 `DATABASE_URL` 环境变量未设置时，使用**内存存储**（`Map`），方便开发调试，无需安装数据库。

### 1.4 bcrypt — 密码哈希

永远不要明文存储密码！bcrypt 是密码哈希的标准选择，它：

1. **加盐（Salt）**：自动生成随机盐，防止彩虹表攻击
2. **慢哈希**：故意让哈希计算慢（可调 cost factor），防止暴力破解
3. **单向**：无法从哈希值反推明文密码

```typescript
import bcrypt from "bcrypt";

// 注册：哈希密码
const passwordHash = await bcrypt.hash(plainPassword, 10); // 10 = cost factor，越高越慢

// 登录：验证密码
const isValid = await bcrypt.compare(plainPassword, storedHash);
```

> ⚠️ cost factor 不是越高越好。10-12 是推荐值，12 大约每次哈希需要 250ms，可以根据服务器性能调整。

### 1.5 JWT (JSON Web Token) — 无状态认证

JWT 是一种令牌格式，将用户信息编码为一个带签名的字符串，格式为 `header.payload.signature`：

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjk5OTk5OX0.签名
```

本项目用 JWT 做两件事：
1. **HttpOnly Cookie** 中的会话令牌（Web 端）
2. **API Key** 前缀（API 调用，`nexus_xxx` 格式）

```typescript
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// 签发令牌
const token = jwt.sign(
  { userId: user.id, role: user.role }, // payload
  JWT_SECRET,
  { expiresIn: "7d" }                   // 7天过期
);

// 验证令牌
try {
  const payload = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
  // payload.userId 可信
} catch {
  // 令牌无效/过期
}
```

#### HttpOnly Cookie vs localStorage 存储 Token

| 存储方式 | XSS 风险 | CSRF 风险 | 本项目使用 |
|---------|---------|----------|-----------|
| localStorage | ⚠️ 高（JS 可读取） | ✅ 无 | API Key |
| HttpOnly Cookie | ✅ 低（JS 读不到） | ⚠️ 需要防护 | 会话 Token |

本项目采用混合策略：Web 端登录后设置 HttpOnly Cookie；API 调用使用独立的 API Key（`nexus_` 前缀）。

### 1.6 SSE（Server-Sent Events）— 流式响应

聊天回复需要"打字机"效果，这通过 SSE 实现。SSE 是 HTTP 协议的一部分，服务器可以持续向客户端推送数据：

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"type":"delta","content":"你"}

data: {"type":"delta","content":"好"}

data: {"type":"done"}

```

```typescript
// API Route: SSE 响应
export async function GET(req: Request) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // 发送事件
      function sendEvent(type: string, data: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`));
      }

      sendEvent("delta", { content: "你好！" });
      // ... LLM 流式输出
      sendEvent("done", {});
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

客户端消费 SSE：

```typescript
const response = await fetch("/api/chat", { method: "POST", body: ... });
const reader = response.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  // 解析 data: {...} 行
  const lines = chunk.split("\n\n");
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const event = JSON.parse(line.slice(6));
      // 处理事件：delta/thought/done/error
    }
  }
}
```

---

## 2. 代码思路

### 2.1 内存降级模式

为了让学习者**不需要安装 PostgreSQL 也能跑**，所有服务层都支持两种模式：

```typescript
// src/server/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

let db: ReturnType<typeof drizzle> | null = null;

if (process.env.DATABASE_URL) {
  const client = postgres(process.env.DATABASE_URL);
  db = drizzle(client, { schema });
}
// db === null 时各 service 降级到内存 Map 存储
export { db };
```

以 auth-service 为例，每个方法内部都有 `if (db) { ... } else { /* 内存操作 */ }` 分支，两套逻辑保持相同返回类型。

### 2.2 认证中间件模式

API 路由中通过高阶函数保护受保护接口：

```typescript
// src/server/auth/middleware.ts
import { NextRequest } from "next/server";

export async function requireAuth(req: NextRequest) {
  // 1. 从 Cookie 中读取 token
  const token = req.cookies.get("auth-token")?.value;
  if (!token) throw new AuthError("Unauthorized", 401);

  // 2. 验证 JWT
  const payload = jwt.verify(token, JWT_SECRET);
  // 3. 查询用户是否存在
  // 4. 返回 user 对象
  return user;
}

export function requireRole(requiredRole: "admin") {
  return async function (req: NextRequest) {
    const user = await requireAuth(req);
    if (user.role !== requiredRole) throw new AuthError("Forbidden", 403);
    return user;
  };
}
```

使用：

```typescript
// API 路由
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req); // 未登录直接抛异常
    // ... 处理业务
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
  }
}
```

### 2.3 密码处理完整流程

注册：
1. Zod 验证邮箱格式、密码长度
2. bcrypt.hash(password, 10) 生成哈希
3. 存入数据库（只存哈希，不存明文）
4. 第一个注册用户自动设为 admin

登录：
1. 根据邮箱查用户
2. 用户不存在 → 返回"邮箱或密码错误"（不透露哪个错了，防枚举攻击）
3. bcrypt.compare(password, hash) 验证
4. 验证通过 → 签发 JWT，设置 HttpOnly Cookie
5. 更新 lastLoginAt

---

## 3. 技术架构

### 3.1 数据库表结构（本项目）

```
users                 # 用户表
├── id (uuid, PK)
├── email (varchar, unique)
├── password_hash (text)       # bcrypt 哈希，OAuth 用户为 null
├── name (varchar)
├── role (varchar)             # 'admin' | 'user'
├── email_verified (boolean)
├── avatar (varchar)
├── provider (varchar)         # 'google' | 'github' | null
├── last_login_at (timestamp)
├── created_at
└── updated_at

api_keys              # API 密钥表
├── id (uuid, PK)
├── user_id (uuid, FK → users)
├── key_prefix (varchar)       # 'nexus_' 前缀后 8 位用于显示
├── key_hash (text)            # 完整 key 的哈希（只存一次）
├── name (varchar)             # 用户自定义名称
├── expires_at (timestamp)
├── last_used_at (timestamp)
└── created_at

oauth_accounts        # OAuth 第三方账号
├── id (uuid, PK)
├── user_id (uuid, FK → users)
├── provider (varchar)
├── provider_account_id (varchar)
└── created_at

sessions              # 聊天会话
├── id (uuid, PK)
├── user_id (uuid, FK → users)
├── title (varchar)
├── pinned (boolean)
├── model (varchar)
├── created_at
└── updated_at

messages              # 聊天消息
├── id (uuid, PK)
├── session_id (uuid, FK → sessions)
├── role (varchar)             # 'user' | 'assistant' | 'system'
├── content (text)
├── tokens_used (integer)
├── created_at
└── metadata (jsonb)           # 存储 tool_calls 等附加信息
```

### 3.2 服务层组织

```
src/server/
├── db/
│   ├── index.ts           # 数据库连接、内存降级判断
│   └── schema.ts          # Drizzle 表定义
├── auth/
│   ├── auth-service.ts    # 核心认证逻辑（注册、登录、更新资料）
│   ├── middleware.ts      # requireAuth / requireRole
│   └── email.ts           # 邮件发送（验证邮件）
├── docs-service.ts        # 文档扫描服务
├── providers/             # LLM Provider 抽象（Mock / OpenAI / DeepSeek）
└── ...
```

每个 service 保持**纯业务逻辑**，不直接处理 HTTP 请求/响应。HTTP 层（`src/app/api/**/route.ts`）只负责：解析请求 → 调用 service → 格式化响应。

---

## 4. 技术拓展

### 4.1 事务（Transactions）

多步数据库操作需要原子性时使用事务：

```typescript
await db.transaction(async (tx) => {
  await tx.insert(orders).values({ userId, total });
  await tx.update(users).set({ balance: sql`balance - ${total}` }).where(eq(users.id, userId));
  // 任何一步失败，整个事务回滚
});
```

### 4.2 关系查询（JOIN）

Drizzle 支持通过 `relations()` 定义表关系，做 JOIN 查询：

```typescript
import { relations } from "drizzle-orm";

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  apiKeys: many(apiKeys),
}));

// 查询用户 + 其会话
const userWithSessions = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: { sessions: true },
});
```

### 4.3 数据库连接池

生产环境需要配置连接池，不要为每个查询创建新连接。`postgres` 客户端库默认内置连接池。

### 4.4 CSRF 防护

使用 HttpOnly Cookie 时需要 CSRF 防护。本项目采用 SameSite=Lax Cookie 属性，大部分现代浏览器默认防御 CSRF；更高安全场景下可以添加 CSRF Token。

### 4.5 知识链接

- 📖 **Drizzle ORM 官方文档**：https://orm.drizzle.team/docs/overview
- 📖 **PostgreSQL 官方教程**：https://www.postgresqltutorial.com/
- 📖 **bcrypt 为什么慢是好事**：https://stackoverflow.com/questions/3547640/why-is-bcrypt-slow
- 📖 **JWT 官方介绍**：https://jwt.io/introduction
- 📖 **MDN Server-Sent Events**：https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
- 📖 **OWASP 密码存储指南**：https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- 📖 **Cookie Security (SameSite/HttpOnly/Secure)**：https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#security

---

## 5. 示例

### 5.1 一个完整的 API 路由（获取用户列表）

```typescript
// src/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authService } from "@/server/auth/auth-service";
import { requireRole } from "@/server/auth/middleware";

export async function GET(req: NextRequest) {
  try {
    await requireRole("admin")(req); // 只有管理员能访问
    const users = await authService.listUsers();
    return NextResponse.json({ users });
  } catch (e: any) {
    const status = e.status || 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

const UpdateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "user"]),
});

export async function PATCH(req: NextRequest) {
  try {
    await requireRole("admin")(req);
    const body = await req.json();
    const { userId, role } = UpdateRoleSchema.parse(body);
    await authService.updateUserRole(userId, role);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireRole("admin")(req);
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("id");
    if (!userId) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await authService.deleteUser(userId);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 400 });
  }
}
```

### 5.2 在 Server Component 中查询数据库

```tsx
// src/app/admin/users/page.tsx（Server Component）
import { authService } from "@/server/auth/auth-service";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function AdminUsersPage() {
  // 验证管理员权限（Server Component 中直接读 cookie）
  const token = cookies().get("auth-token")?.value;
  if (!token) redirect("/auth");
  // ... 验证逻辑

  const users = await authService.listUsers(); // 直接调用服务层
  return (
    <div>
      {users.map(u => (
        <div key={u.id}>{u.email} - {u.role}</div>
      ))}
    </div>
  );
}
```

### 5.3 内存模式下的用户存储示例

```typescript
// src/server/auth/auth-service.ts 内存模式片段
const memoryUsers = new Map<string, User>();

async register(data) {
  if (!db) {
    // 检查邮箱重复
    for (const u of memoryUsers.values()) {
      if (u.email === data.email) throw new Error("Email already registered");
    }
    const user: User = {
      id: crypto.randomUUID(),
      email: data.email,
      passwordHash: await bcrypt.hash(data.password, 10),
      name: data.name || "",
      role: memoryUsers.size === 0 ? "admin" : "user", // 第一个注册用户是 admin
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryUsers.set(user.id, user);
    return this.sanitizeUser(user);
  }
  // ... 数据库模式
}
```

---

## 6. 验证记录

- Drizzle schema 完整定义 users/api_keys/oauth_accounts/sessions/messages 表
- 内存降级模式在无 `DATABASE_URL` 时正常工作
- bcrypt 密码哈希 + JWT 令牌认证流程通过完整测试
- `pnpm typecheck` ✅ 通过
- 数据库迁移 SQL 已生成并执行（`drizzle/0005_auth_tables.sql`）

## 7. 收获与踩坑

- **学到了什么**：Drizzle 的类 SQL API 比 Prisma 更直观，类型推导非常精准；内存降级模式对"开箱即用"体验非常重要
- **踩过的坑**：
  1. bcrypt 是原生模块，pnpm 安装后需要手动 `pnpm approve-builds` + `pnpm rebuild bcrypt` 否则运行时报错
  2. Next.js 的 `cookies()` 在 Server Component 中可以直接调用，但在 Client Component 中不能
  3. Drizzle 的 `defaultRandom()` 需要数据库支持 `gen_random_uuid()`（PostgreSQL 需要 pgcrypto 扩展，但新版 Postgres 内置了）
- **下次会怎么做**：开发环境默认启动内存模式，让新贡献者 `pnpm dev` 一键运行；生产环境再配置 PostgreSQL
