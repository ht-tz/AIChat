# T2 · Tailwind CSS + Zustand + React Query · 学习文档

> **5 段式**：概念详解 / 代码思路 / 技术架构 / 技术拓展 / 示例
> 配套项目代码：`src/components/ui/`、`src/stores/`、`tailwind.config.ts`

## 基本信息

- **编号**：T2（技术栈-Tech）
- **标题**：UI 样式系统与前端状态管理
- **完成日期**：2026-07-04
- **作者**：NEXUS
- **状态**：✅ 已完成

---

## 1. 概念详解

### 1.1 Tailwind CSS — Utility-First CSS 框架

Tailwind CSS 是一个**原子化 CSS（Utility-First）**框架。它不提供预构建的组件（如 Bootstrap 的 `.btn`、`.card`），而是提供数百个细粒度的 utility class，你通过组合这些 class 直接在 HTML/JSX 中构建样式。

#### 传统 CSS vs Tailwind

```css
/* 传统写法：需要自定义类名 */
.button-primary {
  background-color: #00f0ff;
  padding: 8px 16px;
  border-radius: 8px;
  color: white;
}
```

```tsx
{/* Tailwind 写法：组合 utility classes */}
<button className="bg-cyber-cyan px-4 py-2 rounded-lg text-white">
  按钮
</button>
```

#### 为什么用 Tailwind？

1. **零命名成本**：不用为了"这个 div 叫什么类名"而烦恼
2. **样式随组件删除**：删除组件时样式随之消失，不会有"死 CSS"
3. **一致性**：通过 `tailwind.config.ts` 统一设计 token（颜色、间距、字号）
4. **产物极小**：Tailwind 在构建时 tree-shake 掉未使用的 class，最终 CSS 通常只有几 KB

#### Tailwind 核心概念

- **修饰符（Modifiers）**：`hover:bg-cyan-400`、`md:flex`（响应式）、`dark:bg-gray-900`、`focus:ring-2`
- **任意值（Arbitrary Values）**：`w-[237px]`、`text-[#ff00ff]`、`grid-cols-[1fr_auto_200px]`
- **@apply**：在 CSS 文件中组合 utility 复用模式（本项目用于 `.glass`、`.text-gradient` 等）
- **Tailwind Merge**：合并 className 并智能解决冲突（见后文 `cn()` 工具函数）

### 1.2 赛博朋克主题设计系统

本项目实现了自定义的赛博朋克主题，核心颜色通过 CSS 变量定义（在 `globals.css` 中），然后映射到 Tailwind：

```css
:root {
  --color-bg: #0a0b14;        /* 背景 */
  --color-surface: #11131f;   /* 表面/卡片 */
  --color-cyan: #00f0ff;      /* 主色-青 */
  --color-purple: #b14eff;    /* 辅色-紫 */
  --color-magenta: #ff2e97;   /* 强调-粉 */
  --color-lime: #39ff88;      /* 成功-绿 */
}
```

在 JSX 中使用语义化 class 名（见 `tailwind.config.ts` 的扩展）：
- `text-cyber-text` / `text-cyber-muted` / `text-cyber-cyan` / `text-cyber-purple`
- `bg-cyber-bg` / `bg-cyber-surface` / `bg-cyber-card`
- `border-cyber-border` / `shadow-neon` / `text-gradient`

#### 常用自定义样式类

| 类名 | 效果 |
|------|------|
| `.glass` | 玻璃拟态（半透明+模糊+边框发光） |
| `.glass-strong` | 更不透明的玻璃拟态 |
| `.text-gradient` | 青紫粉渐变文字 |
| `.text-neon` | 霓虹发光文字阴影 |
| `.btn-glow` | 按钮悬停发光效果 |
| `.streaming-cursor` | 打字机光标动画 |

### 1.3 class-variance-authority (CVA) — 组件变体管理

CVA 用于创建**有多个变体（variant）的 UI 组件**，类似 Styled Components 的 variants 但零运行时开销。

```tsx
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "rounded-md font-medium transition-colors", // 基础样式
  {
    variants: {
      variant: {
        primary: "bg-cyber-cyan text-black hover:bg-cyber-cyan/80",
        secondary: "bg-cyber-surface text-cyber-text border border-cyber-border",
        danger: "bg-cyber-danger text-white hover:bg-cyber-danger/80",
        ghost: "text-cyber-muted hover:bg-cyber-surface hover:text-cyber-text",
      },
      size: {
        sm: "px-2 py-1 text-xs",
        md: "px-3 py-2 text-sm",
        lg: "px-4 py-2.5 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

// 使用
<Button variant="danger" size="sm">删除</Button>
```

### 1.4 Zustand — 轻量级状态管理

Zustand 是一个极简的 React 状态管理库，API 非常简洁，不需要 Provider 包裹。

#### 为什么选 Zustand 而不是 Redux？

| 对比项 | Zustand | Redux Toolkit |
|--------|---------|---------------|
| 样板代码 | 极少 | 较多（slice、dispatch、selector） |
| Provider | 不需要 | 需要 `<Provider>` |
| 学习曲线 | 很低 | 中等 |
| 适用场景 | 中小型应用、页面级状态 | 大型应用、复杂状态逻辑 |
| Bundle 大小 | ~1KB | ~10KB+ |

#### 核心 API

```typescript
import { create } from "zustand";

interface CounterState {
  count: number;
  increment: () => void;
  reset: () => void;
}

const useCounterStore = create<CounterState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  reset: () => set({ count: 0 }),
}));

// 在组件中使用
function Counter() {
  const count = useCounterStore((s) => s.count); // 选择性订阅
  const increment = useCounterStore((s) => s.increment);
  return <button onClick={increment}>{count}</button>;
}
```

#### 选择性订阅（重要！）

始终用 selector 函数选择你需要的状态，而不是整个 store：

```tsx
// ❌ 不好：任何状态变化都会重渲染
const { count, increment } = useCounterStore();

// ✅ 好：只有 count 变化才重渲染
const count = useCounterStore((s) => s.count);
const increment = useCounterStore((s) => s.increment);
```

#### 持久化中间件

```typescript
import { persist, createJSONStorage } from "zustand/middleware";

const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({ sessions: {}, activeId: null, /* ... */ }),
    {
      name: "nexus-sessions", // localStorage 的 key
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

### 1.5 @tanstack/react-query — 服务端状态管理

React Query（现 TanStack Query）专门处理**服务端状态**（来自 API 的数据），与 Zustand 这类客户端状态管理互补。

#### 什么是服务端状态？

- 数据存储在服务器（数据库/API）
- 有缓存、需要同步、有加载/错误状态
- 例子：用户信息、文档列表、会话历史

React Query 帮你自动处理：缓存、后台刷新、重试、去重请求、加载/错误状态。

```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function UserList() {
  // useQuery：获取数据，自动缓存
  const { data, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: () => fetch("/api/admin/users").then(r => r.json()),
  });

  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>错误：{error.message}</div>;
  return <div>{data.map(u => <div key={u.id}>{u.name}</div>)}</div>;
}

function DeleteUserButton({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  // useMutation：修改数据
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/users?id=${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] }); // 刷新列表
    },
  });

  return <button onClick={() => deleteMutation.mutate(userId)}>删除</button>;
}
```

### 1.6 cn() 工具函数 — className 合并

`cn()` 是本项目的工具函数，组合 `clsx`（条件 class）和 `tailwind-merge`（解决 Tailwind class 冲突）：

```typescript
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 使用
cn("px-2 py-1", isActive && "bg-cyber-cyan text-black", "px-3");
// twMerge 会智能覆盖：最终 padding 是 px-3 而不是冲突
```

### 1.7 Lucide React — 图标库

本项目使用 Lucide React 图标库，图标都是 SVG 组件，可以直接控制大小、颜色、stroke-width：

```tsx
import { User, Settings, LogOut, ChevronDown } from "lucide-react";

<User className="size-4 text-cyber-cyan" />  {/* size-4 = 16px */}
<Settings className="size-5" />
```

---

## 2. 代码思路

### 2.1 样式架构

```
globals.css (全局样式)
├── CSS 变量定义（赛博朋克配色）
├── 基础 reset（滚动条、选区、字体）
├── 复用 class（.glass, .text-gradient, .btn-glow 等）
├── Markdown 渲染样式（.prose-cyber）
└── 亮色主题覆盖（[data-theme="cyber-light"]）
```

组件中尽量直接用 Tailwind utility class；对于**大量重复的模式**（如玻璃拟态、霓虹文字），在 `globals.css` 中用 `@apply` 定义语义化类。

### 2.2 状态分层

| 状态类型 | 管理工具 | 例子 |
|---------|---------|------|
| 全局 UI 状态 | Zustand | 侧边栏开关、主题、会话列表 |
| 服务端数据 | TanStack Query | 用户列表、API 密钥、文档 |
| 局部组件状态 | useState/useReducer | 表单输入、下拉菜单开关、hover 状态 |
| URL 状态 | Next.js useSearchParams | 搜索参数、分页 |

原则：**状态尽量局部化**。只有真正需要跨组件共享的状态才放到 Zustand。

### 2.3 为什么不用 Context？

React Context 适合**静态主题/配置**（如 ThemeProvider），但不适合高频更新的全局状态（会话列表、API 密钥等）。原因：Context 的 value 变化会导致所有消费组件重渲染，无法"选择性订阅"。Zustand 的 selector 机制天然解决了这个问题。

---

## 3. 技术架构

### 3.1 Zustand Stores 划分（本项目）

```
src/stores/
├── auth.ts           # 认证状态（user、login、logout、apiKeys）
├── settings.ts       # 设置（模型、API Key、主题）
├── session.ts        # 会话列表、当前会话消息
└── chat.ts           # 聊天输入状态、流式消息状态
```

以 auth store 为例：

```typescript
interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  apiKeys: ApiKeyItem[];
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (data: { name?: string }) => Promise<boolean>;
  fetchApiKeys: () => Promise<void>;
  createApiKey: (name: string) => Promise<{ key?: string; error?: string }>;
  revokeApiKey: (keyId: string) => Promise<boolean>;
}
```

### 3.2 cn() 函数的实际使用

```tsx
// 典型用法：基础样式 + 条件样式 + 外部传入的 className
<div className={cn(
  "rounded-md border border-cyber-border px-3 py-2 text-sm", // 基础
  active && "border-cyber-cyan bg-cyber-cyan/10",            // 条件
  className                                                  // 外部传入
)} />
```

---

## 4. 技术拓展

### 4.1 Framer Motion — 动画库

本项目使用 `framer-motion` 做流畅动画，核心 API 是 `motion` 组件和 `AnimatePresence`：

```tsx
import { motion, AnimatePresence } from "framer-motion";

<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -10 }}
  transition={{ duration: 0.2 }}
>
  淡入上滑效果
</motion.div>
```

### 4.2 Radix UI — 无样式可访问组件

Radix UI 提供无样式的基础组件（Dialog、DropdownMenu、Tabs、Tooltip 等），完全只处理可访问性（a11y）和键盘导航，样式完全由你通过 Tailwind 自定义：

```tsx
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

<DropdownMenu.Root>
  <DropdownMenu.Trigger className="...">打开菜单</DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Content className="glass rounded-lg p-1 shadow-neon">
      <DropdownMenu.Item className="...">选项一</DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
```

### 4.3 知识链接

- 📖 **Tailwind CSS 官方文档**：https://tailwindcss.com/docs
- 📖 **Tailwind  Cheat Sheet（速查表）**：https://tailwindcomponents.com/cheatsheet/
- 📖 **Zustand 官方文档**：https://docs.pmnd.rs/zustand/getting-started/introduction
- 📖 **TanStack Query 官方文档**：https://tanstack.com/query/latest
- 📖 **class-variance-authority**：https://cva.style/docs
- 📖 **tailwind-merge**：https://github.com/dcastil/tailwind-merge
- 📖 **Lucide React 图标**：https://lucide.dev/icons/
- 📖 **Radix UI 组件文档**：https://www.radix-ui.com/primitives/docs/overview/introduction
- 📖 **Framer Motion 文档**：https://www.framer.com/motion/

---

## 5. 示例

### 5.1 创建一个赛博风格按钮组件

```tsx
// src/components/ui/button.tsx
import { ButtonHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40 hover:bg-cyber-cyan/30 hover:shadow-neon",
        secondary: "bg-cyber-surface text-cyber-text border border-cyber-border hover:border-cyber-cyan/40",
        ghost: "text-cyber-muted hover:bg-cyber-surface/60 hover:text-cyber-text",
        danger: "bg-cyber-danger/10 text-cyber-danger border border-cyber-danger/30 hover:bg-cyber-danger/20",
      },
      size: {
        sm: "px-2 py-1 text-xs",
        md: "px-3 py-1.5 text-xs",
        lg: "px-4 py-2 text-sm",
        icon: "size-8 p-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
);
Button.displayName = "Button";
```

### 5.2 创建一个 Zustand Store（待办列表）

```tsx
// src/stores/todo.ts
import { create } from "zustand";

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

interface TodoState {
  todos: Todo[];
  addTodo: (text: string) => void;
  toggleTodo: (id: string) => void;
  removeTodo: (id: string) => void;
}

export const useTodoStore = create<TodoState>((set) => ({
  todos: [],
  addTodo: (text) =>
    set((state) => ({
      todos: [...state.todos, { id: crypto.randomUUID(), text, done: false }],
    })),
  toggleTodo: (id) =>
    set((state) => ({
      todos: state.todos.map((t) =>
        t.id === id ? { ...t, done: !t.done } : t
      ),
    })),
  removeTodo: (id) =>
    set((state) => ({
      todos: state.todos.filter((t) => t.id !== id),
    })),
}));
```

### 5.3 响应式布局常用模式

```tsx
{/* 移动端单列，桌面端双列 */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div>左侧</div>
  <div>右侧</div>
</div>

{/* 响应式边距 */}
<div className="px-4 py-6 md:px-8 lg:px-12">...</div>

{/* 移动端隐藏，桌面端显示 */}
<div className="hidden md:block">仅桌面端可见</div>

{/* 移动端显示，桌面端隐藏 */}
<div className="md:hidden">仅移动端可见</div>
```

---

## 6. 验证记录

- Tailwind utility class + 自定义 CSS 变量主题已完整实现
- Zustand 管理 auth、session、settings、chat 四大全局状态
- cn() 工具函数 + CVA 变体组件模式在 UI 组件中统一使用
- `pnpm typecheck` ✅ 通过

## 7. 收获与踩坑

- **学到了什么**：Utility-First CSS 初期觉得"把样式写在 HTML 里很乱"，但实际用下来开发速度极快，不需要在 CSS 和 JSX 之间来回切换；Zustand 的 API 设计非常优雅，比 Redux 简单太多
- **踩过的坑**：Tailwind 中 `p-2 px-4` 后写的会覆盖前面的（vertical padding 被覆盖），需要用 `twMerge` 或调整顺序；Zustand 如果订阅整个 store（不写 selector）会导致无谓重渲染
- **下次会怎么做**：建立组件库时先设计好 CVA variants，避免每个按钮/卡片单独写样式
