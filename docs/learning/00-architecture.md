# 00 · 项目架构总览

> 这是 M1 开工前的"全局图"，先理解整个项目怎么搭起来的，再去看具体功能。

## 1. 这是一个什么项目

NEXUS 是一个**面向开发者的 AI Agent 学习产品**：

- 对外：类似豆包的对话体验，赛博未来风格
- 对内：把 ReAct、Plan-and-Execute、Reflexion、Multi-Agent、Prompt Engineering、RAG、Eval 等 Agent 关键技术全部拆成 10 个里程碑，**边做边学**
- 选型上倾向"**单仓单服务 + Mock 优先 + 全可观测**"：用 Next.js 14 把前后端放在一个进程，默认 Mock Provider 让学习者无 API Key 也能跑

## 2. 顶层分层

```
┌──────────────────────────────────────────┐
│  Browser (React 18 / Tailwind / R3F)     │  ← src/app/** / src/components/**
├──────────────────────────────────────────┤
│  Next.js Route Handlers (Node)           │  ← src/app/api/**
│  - /api/chat  /api/agent  /api/multi...  │
├──────────────────────────────────────────┤
│  核心服务层 (Server)                      │  ← src/server/**
│  Agent / Multi / Prompt / Memory / Tool   │
│  Workflow / Eval / Obs / Safety / RAG    │
├──────────────────────────────────────────┤
│  Providers (LLM/ASR/TTS/Image/Embed)     │  ← src/server/providers/**
│  默认 Mock，可切 OpenAI 兼容             │
├──────────────────────────────────────────┤
│  Data Layer (Postgres + pgvector + Redis)│  ← src/server/db/**
└──────────────────────────────────────────┘
```

## 3. 数据流（一次聊天）

```
用户输入
   │
   ▼
Composer（前端）
   │  fetch + ReadableStream
   ▼
/api/chat Route Handler
   │  组装 ChatRequest
   ▼
AgentService (M1 阶段 = 直接调 LLM)
   │
   ▼
LLMProvider.stream()
   │  AsyncIterable<AgentStep>
   ▼
SSE encoder → ReadableStream → 浏览器
   │
   ▼
useChatStream() Hook 解析事件
   │
   ▼
MessageList 增量渲染
```

**关键点**：从 `LLMProvider.stream()` 到浏览器看到字符，**只有一层薄薄的 SSE 编码**。后续 M2 加工具调用、M3 加 ReAct 循环，都只发生在中间的 Service 层，前端不动。

## 4. 关键设计决策

### 4.1 Provider 抽象（`src/server/providers/`）

```ts
interface LLMProvider {
  stream(opts): AsyncIterable<AgentStep>;
  complete(opts): Promise<{ content, usage }>;
  embed(text): Promise<number[]>;
  name: string;
}
```

- `MockProvider` 默认实现：关键字匹配 + 打字机输出，**学习者开箱即用**
- `OpenAIProvider` 真实实现：按 `LLM_PROVIDER=openai` 启用
- 后续可加 `AnthropicProvider` / `DeepSeekProvider` 等，都是同一个接口

### 4.2 事件流（`AgentStep`）

把"AI 在做什么"统一抽象成事件：

```ts
type AgentStep =
  | { kind: "plan"; todos: Todo[] }
  | { kind: "thought"; content: string }
  | { kind: "tool_call"; name, args }
  | { kind: "tool_result"; name, result }
  | { kind: "reflection"; score, critique, revise }
  | { kind: "delta"; content }
  | { kind: "hitl_request"; callId, name, args }
  | { kind: "done"; usage, runId }
  | { kind: "error"; message };
```

**M1 只用到 `delta` / `done` / `error`**，但接口先设计完整，后续 M2+ 直接往里加新事件即可。

### 4.3 单仓单服务

Next.js App Router 让 Route Handler 和 React 组件住在同一棵目录树下：

- `src/app/api/chat/route.ts` ←→ `src/app/page.tsx` 同进程
- 调试时不用起两个服务，不用配 CORS
- 生产可拆分为独立 Node 服务（Vercel / 自部署均可）

### 4.4 Mock 优先

为了**让学习者零摩擦上手**，M1 阶段所有 LLM 调用都走 Mock：

- 关键字命中 → 真实可读的回复（LRU / Next.js 对比 / Plan 模板…）
- 关键字不命中 → 友好提示 + 引导去 `/settings` 切真实模型
- 这意味着**哪怕不配任何 API Key，本地也能看到完整流式体验**

## 5. 目录约定

```
src/
├── app/                   # Next.js App Router（页面 + API）
│   ├── api/chat/          # SSE 流式对话
│   ├── page.tsx           # 对话主页
│   ├── settings/          # 设置页
│   └── ...
├── components/            # 通用 UI 组件（按钮、卡片…）
├── features/              # 业务模块（每个里程碑一组）
│   ├── chat/              # M1
│   ├── agent/             # M2-M3
│   ├── prompt/            # M6
│   ├── multi/             # M8
│   └── ...
├── stores/                # Zustand 全局状态
├── lib/                   # 工具方法（cn / 类型 / 常量）
├── server/                # 服务端代码
│   ├── providers/         # LLM / ASR / TTS / Image
│   ├── agent/             # Agent 运行时
│   ├── db/                # Drizzle schema
│   └── ...
└── styles/                # 全局样式
```

## 6. 学习要点速览

读完这份文档你应该能回答：

- ✅ 整个项目由几层构成？每层做什么？
- ✅ LLM Provider 抽象怎么设计？为什么这样设计？
- ✅ 一次聊天的数据从输入到显示是怎么走的？
- ✅ 为什么默认 Mock？怎么切换真实模型？
- ✅ 后续 M2-M10 在哪里扩展？
