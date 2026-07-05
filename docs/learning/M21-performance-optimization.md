# M21 — 前端性能优化全攻略：从分析到实战

> 以 AIChat 项目为蓝本，覆盖构建优化、渲染性能、状态管理、流式传输、数据库调优五大维度。
> 每个问题均有代码定位、根因分析、优化方案与理论依据。

---

## 一、构建与依赖优化

### 1.1 冗余依赖清理

> **状态：✅ 已实施** — 已移除 reactflow、framer-motion、@langchain/community、langchain、ioredis、bullmq

**问题定位**：`package.json`

项目中存在 6 个未被任何源码 `import` 的依赖：

| 依赖 | 预估 gzip 体积 | 影响 |
|------|----------------|------|
| `reactflow` | ~240 KB | 零引用，整个 `src/` 无使用 |
| `framer-motion` | ~30 KB | 零引用 |
| `@langchain/community` | ~20 KB | 零引用 |
| `langchain`（主包） | ~50 KB | 代码只用了 `@langchain/core` 等子包 |
| `ioredis` | ~30 KB | 零引用 |
| `bullmq` | ~40 KB | 零引用 |

**根因**：开发过程中尝试新功能后未清理依赖。

**影响**：
- `node_modules` 安装时间增加
- 构建时模块解析开销增大
- 部署包体积膨胀

**优化方案**：

```bash
pnpm remove reactflow framer-motion @langchain/community langchain ioredis bullmq
```

**理论依据**：Node.js 模块解析是递归的。即使服务端依赖不进入客户端 bundle，构建工具（SWC/Webpack）仍需扫描和解析这些模块的类型定义和入口文件。

---

### 1.2 highlight.js 双重导入冲突

> **状态：✅ 已实施** — 已删除 globals.css 中的 atom-one-dark.css 导入

**问题定位**：
- `src/app/globals.css` 第 5 行：`@import "highlight.js/styles/atom-one-dark.css"`
- `src/components/chat/message-bubble.tsx` 第 7 行：`import "highlight.js/styles/github-dark.css"`

**根因**：两个不同主题的 CSS 同时加载，后者覆盖前者，前者成为无用代码。

**优化方案**：删除 `globals.css` 中的 `atom-one-dark.css` 导入，只保留 `github-dark.css`。

**理论依据**：CSS 的级联特性意味着后加载的样式会覆盖先前的同名规则。保留两套主题 CSS 浪费了约 5-10KB 的带宽，且增加 CSS 解析时间。

---

### 1.3 next.config.mjs 补全

> **状态：✅ 已实施** — 已添加 standalone 输出、收紧 remotePatterns、移除 framer-motion

**问题定位**：`next.config.mjs`

**缺失配置**：

```javascript
// next.config.mjs 优化后
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"], // 移除未使用的 framer-motion
    serverActions: { bodySizeLimit: "10mb" },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "trae-api-cn.mchost.guru" },
      // 仅列出实际使用的域名，不要用 hostname: "**"
    ],
  },
  // 新增：standalone 输出模式（Docker 部署时减小包体积）
  output: "standalone",
};
```

**理论依据**：
- `hostname: "**"` 允许所有域名的图片，存在 SSRF 安全风险
- `output: "standalone"` 会 tree-shake 掉未使用的 Node.js 模块，部署包可减小 50%+

---

### 1.4 Bundle Analyzer 配置

**问题**：项目没有 bundle 分析工具，无法量化优化效果。

**优化方案**：

```bash
pnpm add -D @next/bundle-analyzer
```

```javascript
// next.config.mjs
const withBundleAnalyzer = require("@next/bundle-analyzer")({ enabled: process.env.ANALYZE === "true" });
module.exports = withBundleAnalyzer(nextConfig);
```

```json
// package.json scripts
"analyze": "ANALYZE=true next build"
```

**理论依据**：无法度量就无法优化。Bundle Analyzer 可视化展示每个 chunk 的组成，是定位"体积大户"的标准工具。

---

## 二、前端渲染性能优化

### 2.1 React.memo 缺失

> **状态：✅ 已实施** — MessageBubble 已包裹 React.memo，自定义比较函数跳过未变化的历史消息 — 流式渲染的最大瓶颈

**问题定位**：`src/components/chat/message-bubble.tsx`

**现状**：`MessageBubble` 组件未使用 `React.memo`。在流式响应期间，`MessageList` 的 `messages` 数组每秒变化 10-30 次（最后一条消息的 `content` 持续追加），导致 **所有** `MessageBubble` 都重渲染，包括完全未变化的历史消息。

**性能影响量化**：
- 假设有 20 条历史消息 + 1 条流式消息
- 每秒 20 次 delta → 每秒 20 × 21 = 420 次无意义的组件渲染
- 每次渲染包含 `ReactMarkdown` 解析 + 语法高亮 → CPU 开销极高

**优化方案**：

```typescript
// src/components/chat/message-bubble.tsx
import { memo } from "react";

export const MessageBubble = memo(function MessageBubble({ message, isStreaming, onRegenerate }: MessageBubbleProps) {
  // ... 组件逻辑不变
}, (prev, next) => {
  // 自定义比较：只有内容长度变化或流式状态变化时才重渲染
  return (
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.isStreaming === next.isStreaming &&
    prev.onRegenerate === next.onRegenerate
  );
});
```

**理论依据**：React 的 reconciliation 算法（Fiber 架构）在每次 state 变化时会递归遍历整个组件树。`React.memo` 通过浅比较（或自定义比较）在 reconciliation 之前拦截，避免不必要的 diff 和渲染。这是 React 官方推荐的性能优化手段。

---

### 2.2 MessageList 订阅粒度过粗

> **状态：✅ 已实施** — selector 已合并为精确匹配当前会话 messages

**问题定位**：`src/components/chat/message-list.tsx` 第 17-21 行

```typescript
const sessions = useSessionStore((s) => s.sessions);  // 订阅整个 sessions 对象
const activeId = useSessionStore((s) => s.activeId);
const session = activeId ? sessions[activeId] : null;
```

**根因**：`useSessionStore((s) => s.sessions)` 订阅了整个 `sessions` 对象。任何会话的变化（包括非活动会话）都会触发 `MessageList` 重渲染。

**优化方案**：

```typescript
// 合并为单个精确 selector
const messages = useSessionStore((s) => {
  const session = s.activeId ? s.sessions[s.activeId] : null;
  return session?.messages ?? [];
});
```

**理论依据**：Zustand 的 selector 机制基于 `Object.is` 引用比较。当 selector 返回一个新引用（如解构 `sessions` 后再取 `sessions[activeId]`），Zustand 会认为状态已变化并触发重渲染。将选择逻辑内联到 selector 中，可以精确匹配到 `messages` 数组的引用。

---

### 2.3 ReactMarkdown 插件引用不稳定

> **状态：✅ 已实施** — REMARK_PLUGINS、REHYPE_PLUGINS、MD_COMPONENTS 提升为模块级常量

**问题定位**：`src/components/chat/message-bubble.tsx` 第 151-154 行

```typescript
<ReactMarkdown
  remarkPlugins={[remarkGfm]}      // 每次渲染创建新数组
  rehypePlugins={[rehypeHighlight]} // 每次渲染创建新数组
  components={{ ... }}              // 每次渲染创建新对象
>
```

**根因**：数组和对象字面量在每次渲染时创建新引用，导致 `ReactMarkdown` 内部的 `useMemo` 缓存失效。

**优化方案**：

```typescript
// 模块级常量，只创建一次
const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS = [rehypeHighlight];

const MARKDOWN_COMPONENTS = {
  code: ({ className, children, ...props }: any) => {
    const isInline = !className;
    if (isInline) {
      return <code className="rounded bg-cyber-purple/20 px-1.5 py-0.5 text-xs font-mono text-cyber-purple" {...props}>{children}</code>;
    }
    return <code className={className} {...props}>{children}</code>;
  },
  pre: ({ children }: any) => {
    const codeEl = children as ReactElement;
    if (codeEl?.props?.className?.includes("language-mermaid")) {
      const code = extractText(codeEl.props.children);
      return <MermaidDiagram code={code} />;
    }
    return <pre className="mb-4 overflow-x-auto rounded-lg border border-cyber-border bg-cyber-bg/80 p-4 text-sm">{children}</pre>;
  },
};
```

**理论依据**：JavaScript 中 `[] === []` 为 `false`。React 的 `memo` 和 `useMemo` 依赖引用比较来判断依赖是否变化。将配置对象提升为模块级常量，确保引用稳定，避免无效的重新计算。

---

### 2.4 流式滚动高频触发

> **状态：✅ 已实施** — 流式时使用 requestAnimationFrame 节流滚动

**问题定位**：`src/components/chat/message-list.tsx` 第 27-32 行

```typescript
const lastContent = messages[messages.length - 1]?.content;
useEffect(() => {
  el.scrollTo({ top: el.scrollHeight, behavior: streaming ? "auto" : "smooth" });
}, [messagesLength, lastContent, streaming]);
```

**根因**：`lastContent` 在流式期间每秒变化 10-30 次，导致 `scrollTo` 也每秒执行 10-30 次。

**优化方案**：使用 `requestAnimationFrame` 节流：

```typescript
useEffect(() => {
  const el = containerRef.current;
  if (!el) return;

  if (streaming) {
    // 流式时用 rAF 节流，避免每帧都执行
    const raf = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  }

  el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
}, [messagesLength, lastContent, streaming]);
```

**理论依据**：`requestAnimationFrame` 与浏览器的渲染帧率同步（通常 60fps），避免在同一帧内多次触发滚动计算。在 React 的并发模式下，多个 state 更新可能在同一个渲染批次中合并，但 `useEffect` 的回调仍会每次都执行。

---

### 2.5 设置页面 1070 行巨型组件

**问题定位**：`src/app/settings/page.tsx`

**现状**：
- 20+ 个 `useState` hook
- `renderModelCard` 定义在组件内部，每次渲染重建
- 任何一个局部状态变化（如展开/收起卡片）导致整个页面重渲染

**优化方案**：拆分为独立子组件：

```typescript
// 1. ModelCard 提取为独立 memo 组件
const ModelCard = memo(function ModelCard({ model, isActive, ... }: ModelCardProps) {
  // 单个模型卡片的渲染逻辑
});

// 2. 各区块独立为组件
const AccountSection = memo(function AccountSection() { /* ... */ });
const ThemeSection = memo(function ThemeSection() { /* ... */ });
const ModelListSection = memo(function ModelListSection() { /* ... */ });
```

**理论依据**：React 的渲染粒度与组件粒度成正比。组件越小，state 变化影响的范围越小。`React.memo` 只能在组件边界上拦截重渲染，内联函数返回的 JSX 无法享受这个优化。

---

### 2.6 动态导入缺失

**问题定位**：`src/app/page.tsx`

**现状**：`Sidebar`、`ThoughtPanel`、`ChatContainer` 全部同步加载。

**优化方案**：

```typescript
import dynamic from "next/dynamic";

const Sidebar = dynamic(() => import("@/components/layout/sidebar").then(m => m.Sidebar), { ssr: false });
const ThoughtPanel = dynamic(() => import("@/components/chat/thought-panel").then(m => m.ThoughtPanel), { ssr: false });
```

**理论依据**：`next/dynamic` 基于 `React.lazy` + Suspense，将组件拆分为独立的 JS chunk。用户首屏只加载可见区域的代码，其余组件在需要时按需加载。根据 HTTP Archive 的数据，首屏 JS 每减少 100KB，LCP 可改善 5-15%。

---

## 三、状态管理优化

### 3.1 流式高频状态更新

> **状态：✅ 已实施** — delta 事件通过 rAF 缓冲合并，流结束后 flush 剩余内容

**问题定位**：`src/features/chat/chat-container.tsx` 第 63-64 行

```typescript
if (e.kind === "delta") {
  appendToLastMessage(sid, e.content); // 每个 token 触发一次 store 更新
}
```

以及 `src/stores/session.ts` 中的 `appendToLastMessage` 实现（每次都创建完整 messages 数组副本）。

**性能影响**：
- 每秒 10-30 次 Zustand `set()` 调用
- 每次 `set()` 创建新的 `sessions` 对象 → 触发所有订阅者重渲染
- React 无法在同一帧内合并这些更新（因为是异步的 `fetch` 回调中的更新）

**优化方案**：使用 `requestAnimationFrame` 合并 delta：

```typescript
// src/hooks/use-chat-stream.ts 或 chat-container.tsx
let pendingDelta = "";
let rafId: number | null = null;

const flushDelta = () => {
  if (pendingDelta) {
    appendToLastMessage(sid, pendingDelta);
    pendingDelta = "";
  }
  rafId = null;
};

onEvent: (e) => {
  if (e.kind === "delta") {
    pendingDelta += e.content;
    if (rafId === null) {
      rafId = requestAnimationFrame(flushDelta);
    }
  }
  // ... 其他事件正常处理
}
```

**理论依据**：`requestAnimationFrame` 将多次同步更新合并为一次渲染帧内的更新。这是 React 官方在 Concurrent Mode 文档中推荐的高频更新优化模式。

---

### 3.2 getAllModels 每次创建新数组

**问题定位**：`src/stores/settings.ts` 第 102-104 行

```typescript
export function getAllModels(customModels: ModelOption[] = []): ModelOption[] {
  return [...MODEL_OPTIONS, ...customModels]; // 每次调用创建新数组
}
```

**根因**：`MODEL_OPTIONS` 是常量，但 `customModels` 每次从 store 取出时都是同一引用。然而 `[...MODEL_OPTIONS, ...customModels]` 每次创建新数组，导致下游 `useMemo` 缓存失效。

**优化方案**：

```typescript
// 在组件内用 useMemo 缓存
const allModels = useMemo(
  () => [...MODEL_OPTIONS, ...customModels],
  [customModels]
);
```

**理论依据**：`useMemo` 的依赖比较是 `Object.is`。当 `customModels` 引用不变时（Zustand selector 返回同一引用），`allModels` 也会保持同一引用，下游的 `groupByVendor` 等计算不会重复执行。

---

## 四、服务端与 API 性能

### 4.1 每个 token 的数据库持久化

**问题定位**：`src/server/agent/dispatcher.ts` 第 65-76 行

```typescript
const persistAndYield = async (step: AgentStep) => {
  stepIndex++;
  if (runId) {
    await persistStep({ runId, stepIndex, step }); // 每个 step 都等待 DB 写入
  }
  return step;
};
```

以及 `src/server/agent/persistence.ts` 第 134 行：

```typescript
} else if (step.kind === "delta") {
  // delta 太多，只累积不每条落库（M9 优化：用 aggregate 字段）
}
```

**现状**：虽然 delta 事件不落库，但 `persistAndYield` 对每个 `thought`、`plan`、`tool_call`、`tool_result`、`reflection`、`done` 都执行 DB INSERT。一次多轮工具调用（3 个工具 × 2 轮 = 6 次工具调用）会产生约 15 次 DB 写入。

**优化方案**：批量写入 + 异步非阻塞：

```typescript
// 方案 A：收集到 done 事件后批量写入
const pendingSteps: Array<{ stepIndex: number; step: AgentStep }> = [];

const persistAndYield = async (step: AgentStep) => {
  stepIndex++;
  // 关键事件（tool_call, tool_result, done）立即写入
  if (step.kind === "tool_call" || step.kind === "tool_result" || step.kind === "done") {
    if (runId) {
      await persistStep({ runId, stepIndex, step });
    }
    // 同时 flush 之前累积的步骤
    if (pendingSteps.length > 0 && runId) {
      await Promise.all(pendingSteps.map(p => persistStep({ runId, stepIndex: p.stepIndex, step: p.step })));
      pendingSteps.length = 0;
    }
  } else {
    // 其他事件累积
    pendingSteps.push({ stepIndex, step });
  }
  return step;
};
```

**理论依据**：数据库写入的瓶颈在于 I/O 延迟（通常 1-5ms/次）。在流式场景中，每毫秒的延迟都会累积到用户的感知中。批量写入将 N 次 I/O 合并为 1 次，减少了 N-1 次网络往返。

---

### 4.2 Provider 实例重复创建

> **状态：✅ 已实施** — 按 apiKey+baseUrl 缓存 Provider 实例，复用 HTTP 连接池

**问题定位**：`src/app/api/chat/route.ts` 第 157-162 行

```typescript
getProvider: () => createProvider({
  apiKey: resolvedApiKey!,
  baseUrl: effectiveBaseUrl,
  model: body.model,
}),
```

每次聊天请求都创建新的 `OpenAI` SDK 实例，无法复用底层 HTTP 连接池。

**优化方案**：按 `apiKey + baseUrl` 缓存 Provider 实例：

```typescript
// src/server/providers/index.ts
const providerCache = new Map<string, LLMProvider>();

export function createProvider(cfg?: ProviderConfig): LLMProvider {
  if (cfg?.apiKey && cfg.apiKey.trim().length > 0) {
    const cacheKey = `${cfg.apiKey.trim()}|${cfg.baseUrl || ""}`;
    if (!providerCache.has(cacheKey)) {
      providerCache.set(cacheKey, buildOpenAIProvider(cfg.apiKey.trim(), cfg.baseUrl || "", cfg.model || ""));
    }
    return providerCache.get(cacheKey)!;
  }
  // ... 其他逻辑不变
}
```

**理论依据**：OpenAI SDK 使用 `fetch`（Node 18+ 内置的 undici）发送 HTTP 请求。undici 的 Agent 支持 keep-alive 连接复用，但每次 `new OpenAI()` 都创建新的 Agent。缓存实例可以复用 TCP 连接，减少 TLS 握手开销（约 50-100ms/次）。

---

### 4.3 模型配置缓存缺失

**问题定位**：`src/app/api/chat/route.ts` 第 119-132 行

每次聊天请求都执行 `modelConfigService.resolveConfig()`（数据库查询 + AES 解密），而模型配置是低频变化的数据。

**优化方案**：添加 LRU 缓存：

```typescript
// src/server/model-config-service.ts
const configCache = new Map<string, { config: ResolvedModelConfig; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟

async resolveConfig(userId: string, modelId: string): Promise<ResolvedModelConfig | null> {
  const cacheKey = `${userId}:${modelId}`;
  const cached = configCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.config;
  }

  const config = await this.resolveConfigFromDB(userId, modelId);
  if (config) {
    configCache.set(cacheKey, { config, expiresAt: Date.now() + CACHE_TTL });
  }
  return config;
}
```

**理论依据**：缓存是计算机科学中"用空间换时间"的经典策略。LRU（Least Recently Used）策略在内存受限时自动淘汰最久未访问的条目。5 分钟 TTL 在模型配置场景下是合理的折中。

---

### 4.4 工具调用串行执行

> **状态：✅ 已实施** — 使用 Promise.all 并行执行无依赖的工具调用

**问题定位**：`src/server/agent/dispatcher.ts` 第 158-190 行

```typescript
for (const tc of toolCallsThisRound) {
  const out = await toolRegistry.execute(tc.name, tc.args, { ... });
  // 串行执行，即使工具之间没有依赖
}
```

**优化方案**：使用 `Promise.all` 并行执行：

```typescript
const results = await Promise.all(
  toolCallsThisRound.map(async (tc) => {
    let result: unknown;
    let error: string | undefined;
    try {
      const out = await toolRegistry.execute(tc.name, tc.args, { signal: opts.signal, sessionId: opts.dbSessionId, runId: runId ?? undefined });
      result = out.result;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    return { tc, result, error };
  })
);

for (const { tc, result, error } of results) {
  yield await persistAndYield({ kind: "tool_result", name: tc.name, result, error });
  // ... 更新 currentMessages
}
```

**理论依据**：当多个异步操作之间没有依赖关系时，并行执行可以将总耗时从 `sum(t1, t2, ..., tn)` 降低为 `max(t1, t2, ..., tn)`。这是 Node.js 异步编程的核心优化模式。

---

### 4.5 sessions 表索引优化

**问题定位**：`src/server/db/schema.ts`

**现状**：`sessions.updatedAt` 索引只索引了 `updatedAt` 字段，无法高效支持 `WHERE userId = ? ORDER BY updatedAt DESC` 查询。

**优化方案**：

```sql
-- 添加复合索引
CREATE INDEX idx_sessions_user_updated ON sessions(user_id, updated_at DESC);
```

**理论依据**：B-tree 索引的最左前缀原则。`(userId, updatedAt DESC)` 复合索引可以同时高效过滤 `userId` 和排序 `updatedAt`，避免全表扫描或 filesort。

---

### 4.6 加密密钥缓存

> **状态：✅ 已实施** — SHA-256 哈希结果缓存到模块级变量

**问题定位**：`src/server/crypto.ts`

```typescript
function getKey() {
  const raw = ENCRYPTION_KEY || "dev-encryption-key-change-in-production-32ch";
  return crypto.createHash("sha256").update(raw).digest(); // 每次调用都做 SHA-256
}
```

**优化方案**：

```typescript
let cachedKey: Buffer | null = null;
function getKey() {
  if (cachedKey) return cachedKey;
  const raw = ENCRYPTION_KEY || "dev-encryption-key-change-in-production-32ch";
  cachedKey = crypto.createHash("sha256").update(raw).digest();
  return cachedKey;
}
```

**理论依据**：SHA-256 虽然单次计算很快（微秒级），但在高频调用场景（每次解密都调用）下，缓存结果可以消除不必要的 CPU 开销。

---

## 五、安全与性能交叉问题

### 5.1 限流器内存泄漏

**问题定位**：`src/server/middleware/rate-limiter.ts`

```typescript
const limits: Map<string, RateLimitState> = new Map();
```

过期的 key 永远不会被清理，长时间运行会导致内存增长。

**优化方案**：添加定期清理：

```typescript
setInterval(() => {
  const now = Date.now();
  for (const [key, state] of limits.entries()) {
    if (now > state.resetAt) {
      limits.delete(key);
    }
  }
}, 60_000); // 每分钟清理一次
```

---

### 5.2 toOutput 每次解密

> **状态：✅ 已实施** — 直接用 apiKeyPrefix 拼接掩码，避免 AES 解密

**问题定位**：`src/server/model-config-service.ts` 第 49-76 行

```typescript
function toOutput(cfg: ModelConfig): ModelConfigOutput {
  if (hasKey) {
    const decrypted = decrypt(cfg.apiKeyEncrypted); // 每次都解密
    masked = `${decrypted.slice(0, 4)}••••••${decrypted.slice(-4)}`;
  }
}
```

**优化方案**：直接使用 `apiKeyPrefix` 拼接掩码，无需解密：

```typescript
function toOutput(cfg: ModelConfig): ModelConfigOutput {
  const hasKey = !!cfg.apiKeyEncrypted;
  let masked = "••••••••";
  if (hasKey && cfg.apiKeyPrefix) {
    masked = `${cfg.apiKeyPrefix}••••••`;
  }
  return { /* ... */ };
}
```

**理论依据**：AES-256-GCM 解密虽然快（微秒级），但 `listConfigs` 返回 10+ 条配置时，每次调用都解密是不必要的。`apiKeyPrefix` 字段已经存储了前缀，完全可以替代解密后的截取。

---

## 六、优化优先级总览

| 优先级 | 问题 | 类型 | 影响 | 优化收益 |
|--------|------|------|------|----------|
| **P0** | MessageBubble 无 memo | 渲染 | 每秒 420+ 次无意义渲染 | ✅ 已实施 |
| **P0** | MessageList 订阅粒度过粗 | 状态 | 任何会话变化都触发重渲染 | ✅ 已实施 |
| **P0** | 冗余依赖 6 个 | 构建 | node_modules 370KB+ | ✅ 已实施 |
| **P1** | 高频 delta 未合并 | 状态 | 每秒 20 次 store 更新 | ✅ 已实施 |
| **P1** | ReactMarkdown 插件引用不稳定 | 渲染 | 每帧重新解析 | ✅ 已实施 |
| **P1** | Provider 实例未缓存 | 服务端 | 每次请求新建连接 | ✅ 已实施 |
| **P1** | 工具调用串行执行 | 服务端 | 多工具延迟线性增长 | ✅ 已实施 |
| **P1** | toOutput 每次解密 | 服务端 | N 次不必要的 AES 解密 | ✅ 已实施 |
| **P2** | 设置页 1070 行单体 | 渲染 | 任何操作全量重渲染 | 待实施 |
| **P2** | 无 dynamic() 导入 | 构建 | 首屏 bundle 过大 | 待实施 |
| **P2** | sessions 表缺复合索引 | 数据库 | 会话列表查询慢 | 待实施 |
| **P2** | 限流器内存泄漏 | 服务端 | 长期运行内存增长 | 待实施 |
| **P2** | 滚动 useEffect 高频触发 | 渲染 | 流式时每帧执行 | ✅ 已实施 |
| **P2** | 加密密钥未缓存 | 服务端 | 每次解密做 SHA-256 | ✅ 已实施 |

---

## 七、性能监控建议

### 7.1 Core Web Vitals 指标

| 指标 | 目标值 | 测量工具 |
|------|--------|----------|
| LCP (Largest Contentful Paint) | < 2.5s | Lighthouse / web-vitals |
| FID (First Input Delay) | < 100ms | web-vitals |
| CLS (Cumulative Layout Shift) | < 0.1 | Lighthouse |
| TTFB (Time to First Byte) | < 800ms | Chrome DevTools |

### 7.2 自定义性能指标

```typescript
// 流式响应首 token 延迟
const firstTokenTime = performance.now() - startTime;

// 流式渲染帧率
let frameCount = 0;
const measureFPS = () => {
  frameCount++;
  requestAnimationFrame(measureFPS);
};
```

---

## 八、总结

本项目的性能问题主要集中在三个维度：

1. **渲染层**：缺少 `React.memo`、`useMemo`、`useCallback` 的基本优化，导致流式场景下大量无意义重渲染
2. **状态层**：Zustand store 的订阅粒度过粗，高频更新未做合并
3. **服务层**：缺少缓存策略（Provider、模型配置、加密密钥），工具调用串行执行

这些问题在小规模使用时影响不明显，但随着对话长度增加、并发用户增多，性能瓶颈会指数级放大。

**核心原则**：
- 无法度量就无法优化（先加 Bundle Analyzer 和性能监控）
- 从影响最大的问题入手（P0 > P1 > P2）
- 优化后必须回归测试（避免引入新 bug）
