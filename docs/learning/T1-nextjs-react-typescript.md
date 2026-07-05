# T1 · Next.js 14 + React 18 + TypeScript · 学习文档

> **5 段式**：概念详解 / 代码思路 / 技术架构 / 技术拓展 / 示例
> 配套项目代码：`src/app/**`、`src/components/**`

## 基本信息

- **编号**：T1（技术栈-Tech）
- **标题**：Next.js 14 App Router + React 18 + TypeScript
- **完成日期**：2026-07-04
- **作者**：NEXUS
- **状态**：✅ 已完成

---

## 1. 概念详解

### 1.1 什么是 Next.js？

Next.js 是 React 的**全栈生产框架**，由 Vercel 开发。它不是一个新的前端库，而是在 React 之上封装了：路由、渲染（SSR/SSG/CSR）、数据获取、API 路由、构建优化等一整套工程能力。

本项目使用 **Next.js 14.2** 的 **App Router**（不是旧的 Pages Router）。

#### App Router vs Pages Router

| 特性 | App Router (本项目使用) | Pages Router |
|------|------------------------|--------------|
| 目录结构 | `src/app/**`，文件夹即路由 | `src/pages/**`，文件即路由 |
| 渲染模式 | 默认 Server Components | 默认 Client Components |
| 数据获取 | Server Components 直接 async/await | `getServerSideProps` / `getStaticProps` |
| 布局系统 | 嵌套 `layout.tsx` 共享布局 | `_app.tsx` + `_document.tsx` |
| 路由段 | `page.tsx`、`layout.tsx`、`loading.tsx`、`error.tsx` | 无对应 |

#### Server Components vs Client Components

这是 App Router 最核心的新概念：

- **Server Components（默认）**：在服务器上渲染，HTML 直接发到浏览器。不能用 `useState`、`useEffect`、`onClick`、浏览器 API。好处：bundle 更小、能直接访问数据库、首屏更快。
- **Client Components**：在浏览器 hydration 后运行。需要在文件顶部加 `"use client"` 指令。可以用 hooks、事件处理、浏览器 API。

> ⚠️ **常见误区**：不是"加了 use client 就不好"。所有交互组件（按钮点击、表单输入、状态管理）都必须是 Client Component。Server/Client 的边界在 `layout.tsx` 和 `page.tsx` 这里划分。

### 1.2 React 18 核心特性

React 18 引入了并发渲染（Concurrent Rendering），这是一次底层架构升级：

#### Automatic Batching（自动批处理）

在 React 17 及之前，只有 React 事件处理中的 setState 会批量更新；React 18 中，Promise、setTimeout、原生事件中的 setState 也会自动批处理，减少不必要的重渲染。

```tsx
// React 18: 只会触发一次重渲染
setTimeout(() => {
  setCount(c => c + 1);
  setFlag(f => !f);
}, 1000);
```

#### Transitions（`startTransition`）

将更新分为"紧急更新"（输入、点击）和"非紧急更新"（搜索结果、列表过滤、路由切换），让 UI 不卡顿。

```tsx
import { startTransition, useState } from "react";

function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  function onChange(e) {
    setQuery(e.target.value); // 紧急：输入框立即响应
    startTransition(() => {
      setResults(filterData(e.target.value)); // 非紧急：可以被打断
    });
  }
}
```

#### Suspense

声明式的"加载中"状态管理，配合 React.lazy 或数据获取使用：

```tsx
<Suspense fallback={<Loading />}>
  <SlowComponent /> {/* 内部可以是 async 组件 */}
</Suspense>
```

### 1.3 TypeScript 关键概念

TypeScript 是 JavaScript 的超集，添加了静态类型检查。本项目严格使用 TypeScript（`strict: true`）。

#### 常用类型工具

```typescript
// 1. interface vs type：interface 可合并声明，type 更灵活（联合类型、交叉类型）
interface User { id: string; name: string }
type Status = "loading" | "success" | "error"; // 联合类型
type UserWithRole = User & { role: "admin" | "user" }; // 交叉类型

// 2. 泛型（Generics）：类型"参数化"
function identity<T>(value: T): T { return value; }
const num = identity<number>(42); // num 是 number 类型

// 3. 工具类型（Utility Types）
type PartialUser = Partial<User>;      // 所有字段可选
type RequiredUser = Required<User>;    // 所有字段必填
type ReadonlyUser = Readonly<User>;    // 所有字段只读
type UserWithoutId = Omit<User, "id">; // 排除某些字段
type UserName = Pick<User, "name">;    // 只保留某些字段

// 4. 类型守卫（Type Guards）
function isString(value: unknown): value is string {
  return typeof value === "string";
}
```

#### Zod 与 TypeScript 的关系

Zod 是**运行时数据验证库**，同时自动推导 TypeScript 类型。这解决了"API 请求/响应数据在运行时类型不确定"的问题：

```typescript
import { z } from "zod";

// 定义 schema（运行时验证规则）
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(128),
  role: z.enum(["admin", "user"]),
});

// 自动推导 TypeScript 类型
type User = z.infer<typeof UserSchema>;
// 等价于：type User = { id: string; email: string; name: string; role: "admin" | "user" }

// 运行时验证（API 入口处必做）
const result = UserSchema.safeParse(data);
if (!result.success) {
  // 数据格式错误，返回 400
}
```

---

## 2. 代码思路

### 2.1 为什么默认 Server Components？

NEXUS 的顶层页面（如聊天页、文档页）都是 Server Component，只在需要交互的叶子组件（输入框、按钮、聊天消息）上加 `"use client"`。这样做的好处：

1. **首屏更快**：服务器直接渲染好 HTML，客户端不需要立刻下载整个应用 JS
2. **更安全**：数据库连接、API Key 不会泄露到客户端
3. **更简单**：Server Component 直接 `async/await` 获取数据，不需要 useEffect + useState

### 2.2 本项目的 Client/Server 边界

```
page.tsx (Server)
├── layout.tsx (Server，包含 DocsSidebar 等)
│   └── DocsSidebar ("use client"，有 useState、usePathname)
└── [slug]/page.tsx (Server)
    └── MarkdownViewer ("use client"，react-markdown 需要浏览器环境)
```

判断原则：**组件是否需要浏览器 API 或 React hooks？** 需要 → `"use client"`；不需要 → 默认 Server。

### 2.3 路由约定（App Router）

| 文件 | 作用 | 是否必需 |
|------|------|---------|
| `layout.tsx` | 该路由段的共享布局，包裹子路由 | 根 layout 必需 |
| `page.tsx` | 该路由的页面内容 | 必需 |
| `loading.tsx` | 该段 Suspense 的 fallback 加载态 | 可选 |
| `error.tsx` | 该段的错误边界（必须是 Client Component） | 可选 |
| `not-found.tsx` | 404 页面 | 可选 |
| `route.ts` | API 端点（GET/POST 等） | API 必需 |

---

## 3. 技术架构

### 3.1 目录划分

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # 根布局（字体、主题、全局样式）
│   ├── page.tsx            # 首页 / （聊天页，Client Component 容器）
│   ├── globals.css         # 全局 CSS
│   ├── docs/               # 学习中心路由组
│   │   ├── layout.tsx      # 文档独立布局（侧边栏 + 内容区）
│   │   ├── page.tsx        # /docs 重定向
│   │   └── [...slug]/      # 动态文档路由
│   ├── settings/           # 设置页
│   ├── admin/              # 管理员页面
│   └── api/                # API Route Handlers
│       ├── chat/route.ts   # 聊天 SSE 接口
│       ├── auth/           # 认证相关 API
│       └── ...
├── components/             # React 组件
│   ├── layout/             # 布局组件（Sidebar、TopBar）
│   ├── docs/               # 文档相关组件
│   └── ui/                 # 通用 UI 组件（Button 等）
├── features/               # 功能模块（ChatContainer 等）
├── server/                 # 服务端代码（不发送到浏览器）
│   ├── auth/               # 认证服务
│   ├── db/                 # 数据库 schema 和连接
│   ├── docs-service.ts     # 文档服务
│   └── providers/          # LLM Provider 抽象
├── stores/                 # Zustand 状态 stores
└── lib/                    # 工具函数
```

### 3.2 API Route Handlers 写法

```typescript
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const RequestSchema = z.object({
  message: z.string().min(1),
});

// GET /api/example
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  return NextResponse.json({ id, message: "hello" });
}

// POST /api/example
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  return NextResponse.json({ received: parsed.data });
}
```

### 3.3 Server Components 直接访问数据

```tsx
// src/app/docs/[...slug]/page.tsx - Server Component
import { docsService } from "@/server/docs-service";

export default async function DocPage({ params }: { params: { slug: string[] } }) {
  const slug = params.slug.join("/");
  const result = docsService.getDocContent(slug); // 直接调用服务端代码
  if (!result) notFound();
  return (
    <div>
      <MarkdownViewer content={result.content} />
    </div>
  );
}
```

> 注意：Server Components 是 `async` 函数，可以直接 `await`，不需要 `useEffect` + `useState` 来加载数据。

---

## 4. 技术拓展

### 4.1 性能优化方向

1. **Streaming SSR**：用 `<Suspense>` 包裹慢组件，页面分块流式发送，用户先看到骨架屏
2. **Server Actions**：在 Server Component 中定义 `"use server"` 函数，直接处理表单提交，不需要写 API 路由
3. **Image/Font 优化**：用 `next/image` 和 `next/font` 自动优化图片和字体加载
4. **Route Segments Config**：`export const dynamic = "force-dynamic"` 控制缓存行为

### 4.2 常见陷阱

| 陷阱 | 说明 | 解决 |
|------|------|------|
| 忘记 `"use client"` | 在 Server Component 中用了 useState/onClick | 文件顶部加 `"use client"` |
| 把服务端代码导入 Client Component | `import { db } from "@/server/db"` 在 Client Component 中报错 | 数据通过 Server Component 作为 props 传递，或走 API |
| 动态路由参数类型错误 | `params` 可能是 `string \| string[]` | catch-all 路由 `[...slug]` 是数组，单一动态路由 `[id]` 是 string |
| 在 Client Component 中直接读 process.env | 只有 `NEXT_PUBLIC_` 前缀的变量会暴露到浏览器 | 服务端密钥不要暴露到客户端 |

### 4.3 知识链接

- 📖 **Next.js 官方文档（App Router）**：https://nextjs.org/docs/app
- 📖 **React 18 官方文档**：https://react.dev/blog/2022/03/29/react-v18
- 📖 **React Server Components 介绍**：https://react.dev/reference/rsc/server-components
- 📖 **TypeScript Handbook**：https://www.typescriptlang.org/docs/handbook/intro.html
- 📖 **Zod 官方文档**：https://zod.dev/
- 🎥 **Next.js App Router 入门教程（官方）**：https://nextjs.org/learn/dashboard-app

---

## 5. 示例

### 5.1 新建一个页面的最小步骤

1. 在 `src/app/` 下创建目录，如 `src/app/about/`
2. 创建 `page.tsx`：

```tsx
// src/app/about/page.tsx
export default function AboutPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">关于 NEXUS</h1>
      <p className="mt-4 text-cyber-muted">AI Agent 学习平台</p>
    </div>
  );
}
```

访问 `http://localhost:3000/about` 即可看到。

### 5.2 一个需要交互的 Client Component

```tsx
"use client"; // 必须加！

import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button
      onClick={() => setCount(c => c + 1)}
      className="rounded bg-cyber-cyan/20 px-4 py-2 text-cyber-cyan"
    >
      点击了 {count} 次
    </button>
  );
}
```

### 5.3 用 Zod 验证 API 请求

```typescript
// src/app/api/auth/login/route.ts
import { z } from "zod";

const LoginSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(6, "密码至少6位"),
});

export async function POST(req: Request) {
  const body = await req.json();
  const result = LoginSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: result.error.issues[0].message },
      { status: 400 }
    );
  }
  // result.data 有完整类型推导
  const { email, password } = result.data;
  // ... 登录逻辑
}
```

---

## 6. 验证记录

- 本项目 Next.js 14.2 + React 18.3 + TypeScript 5.6 全量使用 Server/Client Components 模式
- `pnpm typecheck` ✅ 类型检查通过
- 文档页 `/docs` 采用独立 layout，正确实现了 Server 数据获取 + Client 侧边栏交互

## 7. 收获与踩坑

- **学到了什么**：App Router 中 Server Components 是默认选项，能极大简化数据获取代码；Client Components 只用于有交互的叶子组件
- **踩过的坑**：刚开始在 Server Component 里写 `useState` 报神秘错误，后来才发现是文件顶部缺了 `"use client"`
- **下次会怎么做**：先规划好哪些组件是 Server、哪些是 Client，避免在 Server 组件里意外导入只在客户端运行的依赖
