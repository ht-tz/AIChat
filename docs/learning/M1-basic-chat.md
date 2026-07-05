# M1 · 基础对话 · 学习文档

> **5 段式**：需求思路 / 代码思路 / 技术架构 / 技术拓展 / 示例
> 配套需求文档：[docs/requirements/M1-basic-chat.md](../../requirements/M1-basic-chat.md)

## 基本信息

- **里程碑**：M1
- **标题**：基础对话
- **完成日期**：2026-07-02
- **作者**：NEXUS
- **状态**：✅ 已完成

---

## 1. 需求思路

### 1.1 为什么要先做"基础对话"

M1 看似只是"打字机式聊起来"，但它是**所有后续 Agent 能力的底座**。M2 工具调用、M3 ReAct 推理、M7 Plan 编辑、M8 多智能体……全都要建立在"AI 能流式说话"的基础上。

- 没有稳定可用的流式输出，后面的 `tool_call` / `thought` 事件可视化无处承载
- 没有 LLM Provider 抽象，"切换 Mock / 真实模型"会变成到处改业务代码
- 没有统一的 `AgentStep` 事件协议，后续新增事件类型会引发前端大改

所以 M1 的真正目标不是"做一个聊天页"，而是**把后续 9 个里程碑要用的底座一次铺好**。

### 1.2 用户故事回顾

- 作为新用户，**无需注册、无需 API Key** 就能体验完整流式对话
- 切换到真实模型时，**只在 `/settings` 改两个字段**就生效
- 学习者能**在浏览器 Console 直接看到 SSE 事件**，把"流式协议"从黑盒变成可观察

### 1.3 验收回顾

M1 全部 10 条验收项均通过（详见第 6 节验证记录）。

---

## 2. 代码思路

### 2.1 关键决策

| 决策 | 选项 | 选择 | 理由 |
|------|------|------|------|
| 前端流式读取 | `EventSource` vs `fetch + ReadableStream` | **fetch + ReadableStream** | `EventSource` 是 GET only，无法发 JSON body；fetch 还能精确控制 `AbortController` |
| 状态管理 | Redux / Zustand / Context | **Zustand + persist** | 极简、SSR 友好、自带 localStorage 持久化；学习者容易上手 |
| Provider 抽象 | 直接调 SDK / 接口抽象 | **接口抽象** | Mock / OpenAI 可热切换；M2 工具调用接入不影响业务 |
| 持久化 | localStorage / IndexedDB / API | **localStorage** | 开发期零依赖，刷新不丢；M5 起切到数据库 |
| 主题色 | 单一紫色 / 紫蓝粉三色 | **青/紫/品红/酸橙四色霓虹** | 配合"赛博未来"调性，主色不再"AI 紫" |
| LLM 默认 | 必须配 Key / 默认 Mock | **默认 Mock** | 学习者零摩擦上手；Mock 内置关键字回复覆盖 6+ 场景 |

### 2.2 数据流（一次完整对话）

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. 用户在 Composer 输入文字，按 Enter                              │
│    Composer.onSend(content)                                      │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 2. ChatContainer.handleSend                                      │
│    - appendMessage(sid, userMsg)                                 │
│    - renameSession(sid, 前30字)        // 自动标题                 │
│    - appendMessage(sid, emptyAIMsg)     // 占位气泡                 │
│    - messagesToSend = 过滤空 + 过滤 tool  // 准备发给 LLM          │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 3. useChatStream.start()                                         │
│    - const ctrl = new AbortController()                          │
│    - fetch('/api/chat', { body, signal: ctrl.signal })           │
└──────────────────────────────────────────────────────────────────┘
                              ↓ HTTP POST → text/event-stream
┌──────────────────────────────────────────────────────────────────┐
│ 4. 服务端 /api/chat/route.ts                                     │
│    - zod 校验 BodySchema                                         │
│    - getProvider()  // 按 LLM_PROVIDER 选 Mock / OpenAI         │
│    - new ReadableStream({ start(controller) {                    │
│        for await (const step of provider.stream(opts)) {         │
│          controller.enqueue(sseEncode(step))                     │
│        }                                                         │
│      }})                                                         │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 5. MockProvider.stream()                                          │
│    - 关键字匹配 → 选 reply                                        │
│    - yield { kind: "thought" }                                   │
│    - for ch of reply: yield { kind: "delta", content: ch }       │
│                        sleep(8~26ms)                             │
│    - yield { kind: "done", usage, runId }                        │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 6. useChatStream 解析 SSE                                        │
│    - 读 chunk → 拼 buffer → 切 "\n\n" → 解析每行 "data: {...}"   │
│    - JSON.parse → handlers.onEvent(step)                         │
│    - 循环直到 done                                                │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 7. ChatContainer 收到事件                                         │
│    - delta  → appendToLastMessage(sid, content)                  │
│    - thought → 收集到 message.thoughts（M2-M3 填充）              │
│    - error → appendToLastMessage(sid, "\n\n> ⚠️ ...")            │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 8. Zustand 状态更新 → React 重渲染                                │
│    - MessageBubble 重新渲染，最后一条 isStreaming=true            │
│    - 打字机光标闪动                                                │
│    - 自动滚动到底部                                                │
└──────────────────────────────────────────────────────────────────┘
```

### 2.3 异常 / 边界处理

| 场景 | 处理 |
|------|------|
| 用户在生成中按 Enter | Composer 按钮置灰，textarea 禁用 |
| 用户在生成中点"停止" | `controllerRef.current.abort()` + 按钮变"Square"红色 |
| LLM 返回 `error` 事件 | 追加 `\n\n> ⚠️ {msg}` 到消息末尾，按钮恢复 |
| 网络断开 / fetch 抛错 | catch 后 `appendToLastMessage("\n\n> ⚠️ ...")`，不卡住 UI |
| 请求体不合法 | `/api/chat` 用 zod 校验，400 + 错误详情 |
| 服务端没接 `signal` | 客户端断开 → fetch 自动 abort → ReadableStream cancel 触发 |
| localStorage 未水合 | Zustand 的 `onRehydrateStorage` 回调 `setHydrated()`，避免 SSR mismatch |
| 消息里混入空 content | `filter(m => m.content && m.role !== "tool")` 再发给 LLM |

---

## 3. 技术架构

### 3.1 模块划分

| 新增 / 修改 | 文件 | 职责 |
|------------|------|------|
| ✨ | `src/app/api/chat/route.ts` | SSE Route Handler，zod 校验，调用 Provider |
| ✨ | `src/server/providers/index.ts` | `LLMProvider` 接口 + Provider 工厂 |
| ✨ | `src/server/providers/mock.ts` | Mock Provider，含关键字回复 + 打字机模拟 |
| ✨ | `src/server/providers/openai.ts` | OpenAI 兼容 Provider（占位，M1 默认未启用） |
| ✨ | `src/stores/session.ts` | 会话 / 消息的 Zustand Store + localStorage |
| ✨ | `src/stores/settings.ts` | 模型 / API Key / 主题的 Zustand Store |
| ✨ | `src/hooks/use-chat-stream.ts` | 通用 SSE 客户端 Hook |
| ✨ | `src/features/chat/chat-container.tsx` | 业务容器，串起 send / streaming / 事件处理 |
| ✨ | `src/components/layout/top-bar.tsx` | 顶栏 + 模型切换胶囊 |
| ✨ | `src/components/layout/sidebar.tsx` | 侧边栏（会话列表 + 置顶 / 重命名 / 删除） |
| ✨ | `src/components/chat/message-list.tsx` | 消息流容器（空态 / 列表） |
| ✨ | `src/components/chat/message-bubble.tsx` | 单条消息气泡（Markdown / 复制 / 重生成） |
| ✨ | `src/components/chat/composer.tsx` | 输入区（多行 / Enter / 附件占位） |
| ✨ | `src/components/chat/thought-panel.tsx` | 思考过程面板（M2-M3 预留） |
| ✨ | `src/components/ui/button.tsx` | 赛博霓虹 Button 组件（CVA） |
| ✨ | `src/lib/types.ts` | `Message` / `ToolCall` / `AgentStep` / `ChatRequest` |
| ✨ | `src/lib/utils.ts` | `cn` / `formatTokens` / `formatCost` / `formatDuration` |
| ✨ | `src/app/page.tsx` | 首页：Sidebar + TopBar + ChatContainer |
| ✨ | `src/app/settings/page.tsx` | 设置页：模型 / API Key / 温度 / 主题 |
| ✨ | `src/app/layout.tsx` | 根布局：加载字体 / globals.css / dark 模式 |
| ✨ | `src/app/globals.css` | 全局样式：玻璃拟态 / 霓虹文本 / 流式光标 / Markdown 样式 |
| ✨ | `tailwind.config.ts` | 注入 `cyber.*` 主题色 + 阴影 + 动效 |
| ✨ | `package.json` / `tsconfig.json` / `next.config.mjs` 等 | 工程脚手架 |

### 3.2 关键类型

```ts
// src/lib/types.ts
export type Role = "system" | "user" | "assistant" | "tool";

export interface Message {
  id: string;
  role: Role;
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
  createdAt: number;
}

export type AgentStep =
  | { kind: "plan"; todos: Todo[] }
  | { kind: "thought"; content: string }
  | { kind: "tool_call"; name: string; args: unknown; requireConfirm?: boolean }
  | { kind: "tool_result"; name: string; result: unknown; error?: string }
  | { kind: "reflection"; score: number; critique: string; revise: boolean }
  | { kind: "delta"; content: string }
  | { kind: "hitl_request"; callId: string; name: string; args: unknown }
  | { kind: "done"; usage: { prompt: number; completion: number; total: number }; runId: string }
  | { kind: "error"; message: string };

// src/server/providers/index.ts
export interface LLMProvider {
  stream(opts: {
    messages: Array<{ role: Role; content: string; name?: string; toolCallId?: string }>;
    tools?: ToolDefinition[];
    model?: string;
    temperature?: number;
    signal?: AbortSignal;
  }): AsyncIterable<AgentStep>;
  complete(opts): Promise<{ content: string; usage }>;
  embed(text: string): Promise<number[]>;
  name: string;
}
```

### 3.3 关键代码片段

#### 3.3.1 SSE 编码（一行决定后端协议）

```ts
// src/app/api/chat/route.ts
function sseEncode(chunk: AgentStep): Uint8Array {
  const payload = `data: ${JSON.stringify(chunk)}\n\n`;
  return new TextEncoder().encode(payload);
}

return new Response(stream, {
  headers: {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    "x-accel-buffering": "no",  // 关键：禁用 nginx 缓冲
  },
});
```

#### 3.3.2 Mock Provider 打字机

```ts
// src/server/providers/mock.ts
for (const ch of chars) {
  if (opts.signal?.aborted) return;
  buffer += ch;
  yield { kind: "delta", content: ch };
  await sleep(8 + Math.random() * 18);  // 8~26ms 一个字，模拟真实流式
}
```

**学到什么**：mock 阶段就把 `signal.aborted` 检查写进循环，后续真实 Provider 同样模式，**取消体验一致**。

#### 3.3.3 Zustand 会话 Store

```ts
// src/stores/session.ts
export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: { [sample.id]: sample },
      activeId: sample.id,
      // ... actions
      appendToLastMessage: (sessionId, delta) =>
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session || session.messages.length === 0) return s;
          const messages = [...session.messages];
          messages[messages.length - 1] = {
            ...messages[messages.length - 1],
            content: messages[messages.length - 1].content + delta,
          };
          return { sessions: { ...s.sessions, [sessionId]: { ...session, messages } } };
        }),
    }),
    {
      name: "nexus-sessions",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
```

**学到什么**：`appendToLastMessage` 直接在 store 里拼接，比"先把消息数组拷到组件、组件用 setState 拼、再写回 store"快一个数量级。

#### 3.3.4 useChatStream 解析 SSE

```ts
// src/hooks/use-chat-stream.ts
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  let idx;
  while ((idx = buffer.indexOf("\n\n")) !== -1) {
    const block = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 2);
    for (const line of block.split("\n")) {
      if (line.startsWith("data:")) {
        const payload = line.slice(5).trim();
        if (!payload) continue;
        const event: AgentStep = JSON.parse(payload);
        handlers?.onEvent?.(event);
      }
    }
  }
}
```

**学到什么**：网络分包可能把一个 `data:` 行拆成两个 chunk，所以**必须 buffer** 到 `\n\n` 边界再解析。

---

## 4. 技术拓展

### 4.1 性能优化空间

- **虚拟列表**：消息超过 100 条时，引入 `react-virtuoso` 做窗口化
- **流式断点续传**：把 SSE 改造为分块 ID + IndexedDB 缓存，刷新后可继续
- **Worker 解析 SSE**：把 `JSON.parse` 移到 Web Worker，主线程只渲染

### 4.2 接真实 LLM 的注意点

- **SSE 兼容性**：OpenAI 的流式响应是 `\n\n` 分隔、字段名是 `delta.content`，**和我们的 `AgentStep` 不直接对应**，需要把 `delta.content` 包成 `{ kind: "delta", content }`（见 `openai.ts`）
- **取消行为**：`req.signal` 在 Route Handler 里要用 `signal: req.signal` 传给 `openai.chat.completions.create({ ..., { signal } })`，否则客户端断开仍会跑完
- **Token 统计**：OpenAI 流式响应在**最后一条 chunk** 才给 usage，要从 chunk 里取并 yield `done`
- **错误处理**：OpenAI SDK 抛 `APIError`，要在 catch 里 yield `{ kind: "error", message }` 而不是直接 throw

### 4.3 类似功能可复用

- `useChatStream` 是**通用 SSE Hook**，M2 起所有"流式 API"（Agent / Multi / Workflow / Eval）都复用它
- `AgentStep` 类型是**统一事件协议**，M2 加工具调用时新增 `tool_call` / `tool_result` 即可，前端只需在 `chat-container.tsx` 的 onEvent 加分支
- `<ThoughtPanel>` 是**可视化容器**，M3 起会被 ReAct 思考链、Plan 列表、Tool 调用面板填入
- `Zustand + persist` 模式可复用到 M6 提示词模板、M8 拓扑、M9 Eval 集

### 4.4 相关学习资源

- **SSE 协议规范**：[HTML Living Standard - Server-Sent Events](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- **MDN ReadableStream**：[Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)
- **Zustand persist**：[zustand.pmnd.rs/integrations/persisting-store-data](https://zustand.docs.pmnd.rs/integrations/persisting-store-data)
- **OpenAI Function Calling**：[platform.openai.com/docs/guides/function-calling](https://platform.openai.com/docs/guides/function-calling)
- **ReAct 论文**：Yao et al., 2022, [arxiv.org/abs/2210.03629](https://arxiv.org/abs/2210.03629)

---

## 5. 示例

### 5.1 怎么用（M1 阶段）

#### 5.1.1 启动项目

```bash
cd "/path/to/ai-agent"
pnpm install
cp .env.example .env
pnpm dev
# 打开 http://localhost:3000
```

#### 5.1.2 在浏览器体验

1. 直接在输入框敲"你好" → 看到打字机欢迎语
2. 试这些关键词：
   - `你好` → 自我介绍
   - `LRU 缓存` → TypeScript 代码 + 复杂度
   - `Next.js App Router` → 与 Pages Router 对比
   - `帮我规划` → Plan 风格回复
3. 左侧侧边栏：新建 / 重命名 / 删除 / 置顶会话
4. 右上设置：切到 `GPT-4o mini`、填入 API Key，保存后下次对话生效
5. 浏览器 Console（开发模式）会打印每个 SSE 事件：
   ```
   [sse] {kind: 'thought', content: '...'}
   [sse] {kind: 'delta', content: '你'}
   [sse] {kind: 'delta', content: '好'}
   ...
   [sse] {kind: 'done', usage: {...}, runId: 'mock-...'}
   ```

### 5.2 最小可运行示例

#### 5.2.1 curl 测试 SSE

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "content-type: application/json" \
  -d '{"messages":[{"role":"user","content":"LRU 缓存"}]}'
```

输出（节选）：

```
data: {"kind":"thought","content":"用户想了解 LRU 缓存。我需要给出可直接运行的代码并解释复杂度。"}

data: {"kind":"delta","content":"下"}

data: {"kind":"delta","content":"面"}

data: {"kind":"delta","content":"是"}

...

data: {"kind":"done","usage":{"prompt":4,"completion":800,"total":804},"runId":"mock-1700000000000"}
```

#### 5.2.2 切到 OpenAI 真实模型

```ini
# .env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-proj-...
OPENAI_BASE_URL=https://api.openai.com/v1
DEFAULT_MODEL=gpt-4o-mini
```

```bash
# 重启 dev server
pnpm dev
```

打开 `/settings` 选 `GPT-4o mini`，回到首页对话即走真实模型。

#### 5.2.3 切到 DeepSeek

```ini
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.deepseek.com/v1
DEFAULT_MODEL=deepseek-chat
```

**代码 0 改动**——这就是 `LLMProvider` 抽象的价值。

---

## 6. 验证记录

### 6.1 命令

| 命令 | 结果 |
|------|------|
| `pnpm typecheck` | ✅ 0 error |
| `pnpm lint` | ✅ 0 warning |
| `pnpm build` | ✅ Compiled successfully · 5 routes |
| `curl /` | ✅ HTTP 200, 22.9 KB, 7.7s 首屏（Next.js dev 编译） |
| `curl /settings` | ✅ HTTP 200, 14.8 KB, 0.9s |
| `curl POST /api/chat` | ✅ SSE 流式事件正常，10+ 个 `delta` 拼接成完整回复 |

### 6.2 浏览器自测（dev 模式）

- [x] 打开首页看到赛博深色 + 霓虹
- [x] "你好" → 打字机欢迎语
- [x] "LRU 缓存" → 代码块 + 表格
- [x] "Next.js App Router" → 对比表格
- [x] "帮我规划" → Plan 风格回复
- [x] 输入其他 → mock 默认回复 + 引导去 `/settings`
- [x] 复制按钮 → 浏览器提示
- [x] 新建 / 重命名 / 删除 / 置顶会话
- [x] 切换模型（在 `/settings`）→ 下次对话生效
- [x] 浏览器 Console 看到 SSE 事件日志

### 6.3 已知遗留问题

- [ ] `Message.thoughts` 字段目前是 M1 阶段临时加在 message 上的"野字段"，M2 起会挪到 `agent_runs` / `agent_steps` 表（见 [ISSUE-002](../../issues.md)）
- [ ] 重新生成按钮：当前 message-bubble 上挂了 `onRegenerate` 回调但 chat-container 还没接上，M2 顺手补
- [ ] Composer 里的 Paperclip / Mic / Bot 三个图标是占位（disabled），等 M2 / M4 启用

---

## 7. 收获与踩坑

### 7.1 学到了什么

- **SSE 协议简单但要注意**：buffer 边界、`x-accel-buffering: no`、JSON vs 文本
- **Provider 抽象是后续所有扩展的杠杆**：M2 加工具调用、M3 加 ReAct 都不会改前端协议
- **Zustand 增量更新**比"组件 setState → 写回 store"高效得多
- **"默认 Mock" 是学习项目的杀手锏**：零摩擦上手让学习者第一天就能看到效果
- **M2-M3 预留位要在 M1 就铺好**：等到 M2 才加 ThoughtPanel 改动面太大

### 7.2 踩过哪些坑

- 一开始 page.tsx 把 send 逻辑和 Composer 桥接写得太乱，重构成 `chat-container.tsx` 才清晰
- `import.meta.env` 在 Next.js 不存在，要用 `process.env.NODE_ENV`
- Button 组件不小心 `import` 了自己，TS 报"merged declaration"错
- `useEffect` 依赖里直接写 `messages[messages.length-1]?.content` ESLint 一直警告，最后用变量缓存
- curl 测 SSE 时 `--max-time` 太短会被截断，看到的是部分事件

### 7.3 下次会怎么做

- **每个新组件先想清楚 Props**：MessageList 第一次没接 onExampleClick 回调，导致示例 chip 点了没反应
- **状态更新尽量在 Store 层做**：减少组件之间的 prop drilling
- **测试时多用 curl**：比打开浏览器快、能看到原始协议

---

## 8. 后续路线

M1 是底座。从 M2 起逐步往里填能力：

| 里程碑 | 标题 | 主要扩展 |
|--------|------|----------|
| M2 | 工具调用 | 新增 `tool_registry` + 5 个内置工具，前端 Tool 调用面板 |
| M3 | ReAct 推理 | `reactLoop` + `ThoughtPanel` 接通，`AgentStep.thought` 可视化 |
| M4 | 多模态 + 存储 | 上传 / 语音 / 生图 / RAG 基础版 |
| M5 | 报告与发布 | 持久化到 PostgreSQL + 报告生成 |
| M6 | 提示词工程 | 模板系统 + 版本 + Playground |
| M7 | Plan + Reflexion + HITL | 计划编辑 + 自评 + 人工确认 |
| M8 | 多智能体协作 | React Flow 编排 + Supervisor |
| M9 | 评估与可观测 | Eval 集 + LLM-as-Judge + 链路追踪 |
| M10 | 进阶 RAG + Agent 形态 | 混合检索 + Re-rank + Code/Browser/Terminal Agent |

每个里程碑完成后，**继续按"需求 → 代码 → 学习"三段式**产出对应文档。
