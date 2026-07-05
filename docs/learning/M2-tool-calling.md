# M2 · 工具调用 · 学习文档

> 本文档是 M2 里程碑"工具调用 (Function Calling)"的完整学习笔记，覆盖需求思路 / 代码思路 / 技术架构 / 技术拓展 / 示例。配套需求文档：[M2-tool-calling.md](../requirements/M2-tool-calling.md)。

## 目录

1. [需求思路](#1-需求思路)
2. [代码思路](#2-代码思路)
3. [技术架构](#3-技术架构)
4. [技术拓展](#4-技术拓展)
5. [示例](#5-示例)

---

## 1. 需求思路

### 1.1 M1 的局限

M1 我们跑通了"AI 流式说话"，但 LLM 还**没有手和脚**：

- 不会算 `123 × 456 = ?`（会瞎猜）
- 不知道"现在几点"
- 不能上网查资料
- 不能执行代码、统计字数

这意味着 M1 的 LLM 只能"说"，不能"做"。用户问到需要真实数据的问题时，只能得到自信的胡说八道（hallucination）。

### 1.2 M2 要解决什么

**核心目标**：让 LLM 能**调用外部工具**（tool / function），并把"调用过程"在 UI 上**可视化**。

具体：

| 能力 | 体现 |
|------|------|
| 计算 | `123 × 456` → calculator 工具 → 56088 |
| 实时 | `现在几点` → get_current_time 工具 → 当前时间 |
| 联网 | `搜索 NEXUS` → web_search 工具 → 搜索结果 |
| 执行 | `运行 JS：1+2*3` → code_runner 工具 → 7 |
| 统计 | `统计：你好世界 hello` → word_count 工具 → 字数 |

### 1.3 关键设计决策

- **工具是 LLM 的"感官和四肢"**——LLM 通过工具获得真实数据，再流式输出给用户。
- **工具注册中心统一管理**——避免散落在各处的 if-else，扩展时只增不删。
- **UI 上必须能看到工具调用过程**（透明性）——用户能看见 AI 调了什么、参数是什么、结果是什么。
- **用户可控制启用哪些工具**——比如"我不想让 AI 算数学，就把 calculator 关掉"。
- **不动 OpenAI 协议**——遵循 OpenAI Function Calling 标准，未来切换到 GPT-4 / DeepSeek / Qwen / Kimi 都无缝。

### 1.4 完成标志（来自验收标准）

- [x] 输入"123 × 456" → 看到 ToolCallCard 显示 `calculator` → 看到 56088
- [x] 输入"现在几点" → 看到 ToolCallCard 显示 `get_current_time` → 看到当前时间
- [x] 输入"搜索 NEXUS" → 看到 ToolCallCard 显示 `web_search` → 看到 mock 搜索结果
- [x] 输入"运行 JS：1+2*3" → 看到 ToolCallCard 显示 `code_runner` → 看到 7
- [x] 输入"统计：xxx" → 看到 ToolCallCard 显示 `word_count` → 看到字数
- [x] ToolCallCard 在 AI 气泡内正确显示：工具名、参数、结果、耗时、状态
- [x] Composer 中 Bot 按钮可点击，弹出工具开关
- [x] 重新生成按钮能工作
- [x] `pnpm typecheck` / `pnpm lint` / `pnpm build` 全部通过
- [x] 单元测试：calculator 5 个测试全过

---

## 2. 代码思路

### 2.1 整体数据流

```
用户："123 * 456 等于多少"
   ↓
ChatContainer.handleSend
   ↓
useChatStream.start() → POST /api/chat { messages, enabledTools, maxToolRounds }
   ↓
api/chat/route.ts
   ↓
runAgent() ← dispatcher.ts
   ↓
provider.stream({ messages, tools })  ← mock.ts (默认) 或 openai.ts
   ↓
LLM 决定调用工具 → yield { kind: "tool_call", name: "calculator", args: { expression: "123 * 456" } }
   ↓
runAgent 捕获 tool_call → toolRegistry.execute("calculator", { expression: "123 * 456" })
   ↓
calculator tool → 返回 { value: 56088, formatted: "56088" }
   ↓
runAgent yield { kind: "tool_result", name: "calculator", result: 56088 }
   ↓
runAgent 再次调 provider.stream() 带 tool 结果 → yield delta 流式输出最终答案
   ↓
SSE 编码 data: {...}\n\n → 客户端
   ↓
useChatStream.onEvent 接收事件
   ↓
ChatContainer 根据事件类型更新 Zustand store
   ↓
MessageBubble 渲染 ToolCallCard + Markdown 文本
```

### 2.2 关键文件与职责

| 文件 | 职责 | 行数 |
|------|------|------|
| `src/server/tools/types.ts` | Tool / ToolContext / ToolCallRecord 类型定义 | 50 |
| `src/server/tools/registry.ts` | 工具注册中心：注册 / 列出 / 校验 / 带超时执行 | 90 |
| `src/server/tools/builtin/calculator.ts` | 数学表达式求值（手写 Shunting-yard） | 200 |
| `src/server/tools/builtin/get_current_time.ts` | 当前时间（IANA 时区） | 60 |
| `src/server/tools/builtin/web_search.ts` | Mock 搜索（3 组预置数据 + 兜底） | 90 |
| `src/server/tools/builtin/code_runner.ts` | Node vm 沙箱执行 JS（5s 超时） | 110 |
| `src/server/tools/builtin/word_count.ts` | 文本统计 | 35 |
| `src/server/tools/index.ts` | 入口：注册所有内置工具（幂等） | 25 |
| `src/server/agent/dispatcher.ts` | runAgent：单轮工具调用循环 | 110 |
| `src/server/providers/mock.ts` | 升级支持工具调用（关键字 → 工具） | 235 |
| `src/server/providers/openai.ts` | 升级累积 streaming tool_call → yield 单次 | 170 |
| `src/app/api/chat/route.ts` | 接入 runAgent 与 enabledTools 参数 | 110 |
| `src/components/chat/tool-call-card.tsx` | ToolCallCard UI 组件 | 110 |
| `src/components/chat/composer.tsx` | Bot 按钮 + 工具选择 Popover | 215 |
| `src/components/chat/message-bubble.tsx` | 渲染 message.toolCalls | 145 |
| `src/features/chat/chat-container.tsx` | 接入 tool_call/tool_result 事件 + 重新生成 | 160 |
| `src/stores/session.ts` | 添加 `removeLastAssistant` action | 200 |
| `src/stores/settings.ts` | 添加 `enabledTools` + `toggleTool` | 100 |
| `tests/tools/calculator.test.ts` | 5 个单元测试 | 45 |

### 2.3 工具注册中心：核心 API

```ts
// src/server/tools/registry.ts
class ToolRegistry {
  private tools = new Map<string, Tool>();

  register<T extends z.ZodTypeAny>(tool: Tool<T>): void {
    if (this.tools.has(tool.name)) throw new Error(`Tool "${tool.name}" already registered`);
    this.tools.set(tool.name, tool as unknown as Tool);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.toDefinition());
  }

  parseArgs(name: string, rawArgs: unknown): Record<string, unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    return tool.parameters.parse(rawArgs ?? {}) as Record<string, unknown>;
  }

  async execute(name: string, rawArgs: unknown, ctx: ToolContext = {}): Promise<{ result: unknown; durationMs: number }> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    const args = this.parseArgs(name, rawArgs);  // zod 校验
    const startedAt = Date.now();
    try {
      const result = await Promise.race([
        Promise.resolve(tool.execute(args, ctx)),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Tool "${name}" timeout after 5000ms`)), 5000)),
      ]);
      return { result, durationMs: Date.now() - startedAt };
    } catch (err) {
      throw new Error(`Tool "${name}" failed: ${err.message}`);
    }
  }
}

export const toolRegistry = new ToolRegistry();
```

**设计要点**：
1. **zod 校验在工具外**：所有 args 先过 `tool.parameters.parse()`，避免 LLM 传来非法参数时炸在工具内部。
2. **统一超时**：5000ms 是硬限制，不依赖工具内部实现。`code_runner` 即便用户写死循环也不会拖死服务端。
3. **durationMs 自动测量**：执行耗时直接返回，UI 显示无需再算。
4. **错误统一包装**：`Tool "X" failed: <msg>`，UI 拿到后能直接展示。

### 2.4 调度器：runAgent

```ts
// src/server/agent/dispatcher.ts（核心循环）
export async function* runAgent(opts: RunAgentOptions): AsyncIterable<AgentStep> {
  const maxRounds = opts.maxToolRounds ?? 1;
  const provider = opts.getProvider();
  let currentMessages = [...opts.messages];

  for (let round = 0; round <= maxRounds; round++) {
    let toolCallsThisRound: Array<{ id: string; name: string; args: Record<string, unknown> }> = [];

    for await (const step of provider.stream({...})) {
      yield step;  // 透传所有 step
      if (step.kind === "tool_call") {
        toolCallsThisRound.push({ id: `call_${nanoid(8)}`, name: step.name, args: step.args });
      }
    }

    if (toolCallsThisRound.length === 0) return;  // 没工具调用，结束

    // 执行工具 + 回填结果
    for (const tc of toolCallsThisRound) {
      let result, error, durationMs = 0;
      try {
        const out = await toolRegistry.execute(tc.name, tc.args, { signal: opts.signal });
        result = out.result;
        durationMs = out.durationMs;
      } catch (err) {
        error = err.message;
      }
      yield { kind: "tool_result", name: tc.name, result, error };

      currentMessages = [
        ...currentMessages,
        { role: "tool", name: tc.name, toolCallId: tc.id, content: error ? JSON.stringify({ error }) : JSON.stringify(result) },
      ];
    }
  }
}
```

**核心思想**：
- M2 阶段 `maxToolRounds = 1`（单轮工具调用）。M3 ReAct 升级为多轮：LLM 拿到 tool_result 后还可以再调。
- Provider 不感知"工具执行"——Provider 只管"给 LLM 提示词 + 收 LLM 输出"，工具由 dispatcher 决定何时执行。
- 工具结果以 `tool` role 回填到 messages，符合 OpenAI Function Calling 协议。

### 2.5 Mock Provider 的"假 LLM"

为了让无 API Key 时也能演示工具调用，Mock Provider 模拟"LLM 主动决定调用工具"：

```ts
// 关键字 → 工具的映射
const TOOL_RULES: ToolRule[] = [
  { pattern: /(现在几点|当前时间|...)/, toolName: "get_current_time", ... },
  { pattern: /(统计|字数|...)/,        toolName: "word_count", ... },
  { pattern: /(运行\s*js|...)/,        toolName: "code_runner", ... },
  { pattern: /(搜索|搜一下|...)/,      toolName: "web_search", ... },
  { pattern: /^[\d.\s+\-*/^(),]+$/,    toolName: "calculator", ... },
];
```

输入"123 * 456"时，Mock Provider:
1. 匹配到 `calculator` 规则
2. yield `thought`（"用户的需求看起来需要调用 calculator 工具"）
3. yield `tool_call`（`{ name: "calculator", args: { expression: "123 * 456" } }`）
4. 退出本轮，dispatcher 接管

第二轮（拿到 tool_result 后）：
1. yield `thought`（"工具 calculator 返回了结果，我把它整理成自然语言"）
2. yield `delta` 流式输出"计算结果：**56088**"
3. yield `done`

这种设计让 Mock 模式下的演示体验与真实 LLM 几乎一致：用户看到"AI 决定调工具 → 工具执行 → AI 总结"。

### 2.6 OpenAI Provider：累积 streaming tool_call

OpenAI 的 Function Calling 协议在流式模式下，`function.arguments` 是**分片**返回的 JSON 字符串：

```ts
// chunk 1: { tool_calls: [{ index: 0, id: "call_abc", function: { name: "calculator" }, function: { arguments: "" } }] }
// chunk 2: { tool_calls: [{ index: 0, function: { arguments: "{\"exp" } }] }
// chunk 3: { tool_calls: [{ index: 0, function: { arguments: "ression\": \"12" } }] }
// chunk 4: { tool_calls: [{ index: 0, function: { arguments: "3 * 456\"}" } }] }
// finish_reason: "tool_calls"
```

我们用一个 Map 累积所有分片，等 `finish_reason === "tool_calls"` 时再一次性 yield：

```ts
const toolAccum = new Map<number, ToolCallAccum>();
for await (const chunk of stream) {
  if (chunk.choices?.[0]?.delta?.tool_calls) {
    for (const tc of chunk.choices[0].delta.tool_calls) {
      const idx = tc.index ?? 0;
      if (!toolAccum.has(idx)) toolAccum.set(idx, { id: "", name: "", argsBuf: "" });
      const acc = toolAccum.get(idx)!;
      if (tc.id) acc.id = tc.id;
      if (tc.function?.name) acc.name = tc.function.name;
      if (tc.function?.arguments) acc.argsBuf += tc.function.arguments;
    }
  }
  if (chunk.choices?.[0]?.finish_reason === "tool_calls") {
    for (const acc of toolAccum.values()) {
      yield { kind: "tool_call", name: acc.name, args: JSON.parse(acc.argsBuf) };
    }
    return;  // 工具调用模式不输出 done（dispatcher 会再请求一次）
  }
}
```

### 2.7 ToolCallCard UI

```tsx
// src/components/chat/tool-call-card.tsx（核心结构）
<div className="rounded-lg border bg-cyber-bg/40">
  {/* 头部：图标 + 工具名 + 状态徽章 + 耗时 */}
  <div onClick={() => setExpanded(v => !v)}>
    <Wrench /> {meta.label} · {toolCall.name}
    {isPending && <Loader2 className="animate-spin" />}
    {isSuccess && <CheckCircle2 />} 完成
    {isError && <XCircle />} 失败
    {toolCall.durationMs}ms
  </div>

  {/* 折叠区：参数 + 结果 */}
  {expanded && (
    <div>
      <div>参数：{JSON.stringify(toolCall.args)}</div>
      {isError
        ? <div>错误：{toolCall.error}</div>
        : <pre>结果：{JSON.stringify(toolCall.result, null, 2)}</pre>}
    </div>
  )}
</div>
```

**视觉规范**：
- pending / running：青色脉冲
- success：酸橙绿
- error：红色
- 可折叠：默认收起（避免信息过载），点击展开看参数和结果

### 2.8 Composer 工具选择 Popover

```tsx
// 工具区
<button onClick={() => setShowTools(v => !v)} className="relative">
  <Bot />
  {enabledCount > 0 && <span className="badge">{enabledCount}</span>}
</button>

{showTools && (
  <div className="popover">
    {TOOL_DISPLAY.map(t => (
      <button onClick={() => toggleTool(t.name)}>
        <span>{t.icon}</span>
        <span>{t.label}</span>
        {enabledTools.includes(t.name) ? <Check /> : <span className="border" />}
      </button>
    ))}
    <button onClick={() => setEnabledTools(TOOL_DISPLAY.map(t => t.name))}>全部启用</button>
    <button onClick={() => setEnabledTools([])}>全部禁用</button>
  </div>
)}
```

启用状态存到 `useSettingsStore.enabledTools`，与模型选择并排。点 Bot 按钮有未启用数 badge，Popover 内可单选 / 全选 / 全不选。

### 2.9 重新生成（修复 ISSUE-003）

```ts
// src/features/chat/chat-container.tsx
const handleRegenerate = async () => {
  if (streaming) return;
  const sid = activeId;
  if (!sid) return;
  removeLastAssistant(sid);  // 删掉末尾 AI 消息
  const history = useSessionStore.getState().sessions[sid].messages;
  if (history.length === 0) return;
  await runStream(sid, history);
};
```

`removeLastAssistant` 在 session store 中新增，从末尾向前找第一条 `role === "assistant"` 消息删除。重新调用 `runStream` 重发整个 history。

---

## 3. 技术架构

### 3.1 M2 之后的数据流

```
┌────────────────────────────────────────────────────────────────┐
│  Browser (React 18 + Zustand)                                  │
│  ┌──────────┐    ┌────────────────┐    ┌──────────────────┐   │
│  │ Composer │ →  │ ChatContainer  │ →  │ MessageBubble    │   │
│  └──────────┘    └────────────────┘    │  + ToolCallCard  │   │
│         ↑            ↓                  └──────────────────┘   │
│         │    useChatStream.start()                              │
│         │            ↓                                          │
│  ┌──────┴───────────────────────────────────────────────┐      │
│  │  SSE 客户端 (fetch + ReadableStream + AbortController) │      │
│  └────────────────────────────────────────────────────────┘      │
└──────────────────────────┬──────────────────────────────────────┘
                           │ POST /api/chat (SSE)
                           ↓
┌────────────────────────────────────────────────────────────────┐
│  Next.js Route Handler                                        │
│  ┌──────────────────────────────────────────────────┐         │
│  │  BodySchema.parse (zod)                          │         │
│  │  toolRegistry.list() → 工具元数据                 │         │
│  └────────────────────┬─────────────────────────────┘         │
│                       ↓                                        │
│  ┌──────────────────────────────────────────────────┐         │
│  │  runAgent (dispatcher)                           │         │
│  │  ┌────────────────┐    ┌─────────────────────┐  │         │
│  │  │ Provider.stream │ →  │ toolRegistry.execute │  │         │
│  │  └────────────────┘    └─────────────────────┘  │         │
│  └────────────────────┬─────────────────────────────┘         │
│                       ↓                                        │
│  sseEncode(step) → ReadableStream<Uint8Array> → Response      │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 AgentStep 事件协议（更新）

M1 协议 + M2 增量：

```ts
type AgentStep =
  | { kind: "delta"; content: string }              // 流式 token
  | { kind: "thought"; content: string }            // 思考（不是工具调用）
  | { kind: "tool_call"; name: string; args: Record<string, unknown>; requireConfirm?: boolean }  // 工具调用
  | { kind: "tool_result"; name: string; result: unknown; error?: string }  // 工具结果
  | { kind: "done"; usage: ...; runId: string }     // 流结束
  | { kind: "error"; message: string }              // 错误
  // M3 / M7 预留：
  // | { kind: "plan"; todos: Todo[] }
  // | { kind: "reflection"; score: number; critique: string; revise: boolean }
  // | { kind: "hitl_request"; callId: string; name: string; args: Record<string, unknown> }
```

### 3.3 Tool 协议

```ts
interface Tool<TArgs extends z.ZodTypeAny, TResult> {
  name: string;
  description: string;
  parameters: TArgs;             // zod schema
  execute: (args, ctx) => Promise<TResult>;
  requireConfirm?: boolean;     // M7 HITL 用
  toDefinition(): ToolDefinition;  // 转 OpenAI Function Calling 协议
}
```

### 3.4 关键不变量

1. **Provider 不感知"工具执行"**——Provider 只管"LLM 调不调工具"，工具由 dispatcher 决定何时执行。
2. **Dispatcher 透传 Provider 的所有 step**——包括 delta / thought / done / error。
3. **Tool 的 args 永远过 zod**——在执行前先 parse，失败抛错由 dispatcher 包装为 tool_result 的 error 字段。
4. **ToolCallCard 不依赖具体工具**——只读 `ToolCallRecord` 通用字段，扩展工具时无需改 UI。

---

## 4. 技术拓展

### 4.1 ReAct 推理（M3 升级方向）

M2 是单轮工具调用。LLM 拿到 tool_result 后立即总结。

M3 升级为多轮：LLM 可以连续调用多个工具（"先查时间，再算一下从那时到现在过了几秒"）：

```ts
// M3 升级点
const maxRounds = opts.maxToolRounds ?? 5;
for (let round = 0; round < maxRounds; round++) {
  for await (const step of provider.stream({...})) {
    yield step;
    if (step.kind === "tool_call") { ... }
    if (step.kind === "reflection") { ... }  // 自评分
    if (step.kind === "plan") { ... }         // 列出待办
  }
  if (no tool calls) break;
  // execute all tool calls
  // feed results back to LLM
}
```

### 4.2 MCP（Model Context Protocol）接入

MCP 是 Anthropic 提出的工具协议，思路和 OpenAI Function Calling 类似但更结构化。接入方式：

```ts
// 未来：src/server/tools/mcp-client.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

const mcpClient = new Client({ name: "nexus", version: "0.1.0" });
await mcpClient.connect(new StdioClientTransport({ command: "mcp-server-time" }));

// 把 MCP 工具转成 Tool 接口
const timeTool: Tool = {
  name: "mcp_time",
  description: "MCP time server",
  parameters: z.object({}),
  execute: async () => {
    const { tools } = await mcpClient.listTools();
    return await mcpClient.callTool({ name: "get_current_time", arguments: {} });
  },
  toDefinition: () => ({...}),
};
```

### 4.3 工具调用审计与计费

M9 阶段需要把工具调用落到 `agent_steps` 表：

```sql
CREATE TABLE agent_steps (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL,
  step_index INT NOT NULL,
  kind TEXT NOT NULL,  -- 'tool_call' | 'tool_result' | 'thought' | 'delta'
  name TEXT,
  args JSONB,
  result JSONB,
  error TEXT,
  duration_ms INT,
  tokens_in INT,
  tokens_out INT,
  cost_usd NUMERIC(10, 6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.4 真实 web_search 接入

```ts
// 替换 mock 为 Tavily / SerpAPI
const webSearchTool: Tool = {
  name: "web_search",
  execute: async (args) => {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: args.query,
        max_results: args.limit ?? 5,
      }),
    });
    return await res.json();
  },
  ...
};
```

### 4.5 沙箱安全加固

当前 `code_runner` 用 `vm.runInNewContext` + 限制 globals 实现隔离。但还可以加固：

- **超时由 registry 统一守护**（已实现）
- **明确禁止 require / process / globalThis**（当前未注入）
- **限制 console 输出大小**（防止 DoS）
- **资源限制**（内存、CPU）

```ts
// 加固版
vm.createContext(sandbox, {
  name: "nexus-sandbox",
  codeGeneration: { strings: false, wasm: false },
  microtaskMode: "afterEvaluate",
});
```

### 4.6 工具调用可观察性

M9 阶段会接入 OpenTelemetry：

```ts
import { trace } from "@opentelemetry/api";
const tracer = trace.getTracer("nexus-tools");

async execute(name, args) {
  return tracer.startActiveSpan(`tool.${name}`, async (span) => {
    span.setAttribute("tool.name", name);
    span.setAttribute("tool.args", JSON.stringify(args));
    try {
      const result = await tool.execute(args, ctx);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}
```

### 4.7 客户端缓存与去重

如果用户问"1+1 是多少"后又问"那 2+2 呢"，可以缓存 calculator 结果：

```ts
// 简单 LRU 缓存
const cache = new Map<string, { result: unknown; ts: number }>();
const CACHE_TTL = 60_000;  // 1min

function cacheKey(name: string, args: unknown) {
  return `${name}:${JSON.stringify(args)}`;
}

async execute(name, args) {
  const key = cacheKey(name, args);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.result;
  const result = await tool.execute(args, ctx);
  cache.set(key, { result, ts: Date.now() });
  return result;
}
```

---

## 5. 示例

### 5.1 calculator 工具完整实现（核心算法）

```ts
// Shunting-yard 算法：把中缀表达式转 RPN
// 关键：识别一元负号（用 lastIsOp 标志位）
function toRPN(tokens: string[]): string[] {
  const output: string[] = [];
  const stack: string[] = [];
  const prec = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 4, "u": 5 };
  let lastIsOp = true;  // 起始视为运算符，便于检测一元负号

  for (const t of tokens) {
    if (/^[0-9.]+$/.test(t)) {
      output.push(t);
      lastIsOp = false;
    } else if (FUNCTIONS[t]) {
      stack.push(t);
      lastIsOp = true;
    } else if (t === "-") {
      if (lastIsOp) {
        stack.push("u");  // 一元负号
      } else {
        while (stack.length && stack[stack.length - 1] !== "(" &&
               (prec[stack[stack.length - 1]] ?? 0) >= prec[t]) {
          output.push(stack.pop()!);
        }
        stack.push(t);
        lastIsOp = true;
      }
    } else if (t in prec) { /* 通用运算符 + * / ^ */ }
    else if (t === "(") { stack.push(t); lastIsOp = true; }
    else if (t === ")") { /* 弹到 (，弹出函数 */ }
    else if (t in CONSTANTS) { output.push(String(CONSTANTS[t])); lastIsOp = false; }
  }
  while (stack.length) output.push(stack.pop()!);
  return output;
}

function evalRPN(rpn: string[]): number {
  const stack: number[] = [];
  for (const t of rpn) {
    if (FUNCTIONS[t]) stack.push(FUNCTIONS[t](stack.pop()!));
    else if (t === "u") stack.push(-stack.pop()!);
    else if ("+-*/^".includes(t)) {
      const b = stack.pop()!;
      const a = stack.pop()!;
      stack.push({ "+": a + b, "-": a - b, "*": a * b, "/": a / b, "^": a ** b }[t]);
    } else {
      stack.push(parseFloat(t));
    }
  }
  if (stack.length !== 1) throw new Error("Invalid expression");
  return stack[0];
}
```

### 5.2 code_runner 工具：双模式执行

```ts
execute: async (args) => {
  const logs: Array<{ level: string; text: string }> = [];
  const sandbox = {
    console: {
      log: (...v) => logs.push({ level: "log", text: v.map(stringify).join(" ") }),
      // ... warn / error
    },
    Math, Date, JSON, Array, Object, String, Number, Boolean, Map, Set, Promise,
    // 故意不暴露 require / process / globalThis
  };

  try {
    // 模式 1：把最后一行作为 return 的表达式
    const lines = args.code.split(/\r?\n/);
    let lastIdx = lines.length - 1;
    while (lastIdx >= 0 && lines[lastIdx].trim() === "") lastIdx--;
    const lastLine = lines[lastIdx] ?? "";
    const head = lines.slice(0, lastIdx).join("\n");
    const wrapped = `(function() {\n${head}\nreturn (${lastLine});\n})()`;
    const result = vm.runInNewContext(wrapped, sandbox, { timeout: 4900 });
    return { ok: true, result: safeStringify(result), logs, logText: logs.map(formatLog).join("\n") };
  } catch (err) {
    // 模式 2：纯语句模式（不能 return）
    try {
      vm.runInNewContext(args.code, sandbox, { timeout: 4900 });
      return { ok: true, result: undefined, logs, logText: ... };
    } catch (err2) {
      return { ok: false, error: err2.message, logs, logText: ... };
    }
  }
}
```

**示例**：
- `1+2*3` → 模式 1 命中 → `return (1+2*3)` → 返回 7
- `const x = 10; console.log(x * 2)` → 模式 1 失败（最后一行不是表达式）→ 模式 2 命中 → 输出 20
- `throw new Error("boom")` → 都失败 → 返回 ok: false + error

### 5.3 SSE 事件流（端到端）

输入"123 * 456 等于多少"，客户端会收到以下事件：

```
data: {"kind":"thought","content":"用户的需求看起来需要调用 `calculator` 工具。"}

data: {"kind":"tool_call","name":"calculator","args":{"expression":"123 * 456"},"requireConfirm":false}

data: {"kind":"tool_result","name":"calculator","result":{"expression":"123 * 456","value":56088,"formatted":"56088"}}

data: {"kind":"thought","content":"工具 calculator 返回了结果，我把它整理成自然语言。"}

data: {"kind":"delta","content":"计"}
data: {"kind":"delta","content":"算"}
data: {"kind":"delta","content":"结"}
data: {"kind":"delta","content":"果"}
data: {"kind":"delta","content":"："}
data: {"kind":"delta","content":"*"}
data: {"kind":"delta","content":"*"}
data: {"kind":"delta","content":"5"}
data: {"kind":"delta","content":"6"}
data: {"kind":"delta","content":"0"}
data: {"kind":"delta","content":"8"}
data: {"kind":"delta","content":"8"}
data: {"kind":"delta","content":"*"}
data: {"kind":"delta","content":"*"}

data: {"kind":"done","usage":{"prompt":9,"completion":14,"total":23},"runId":"mock-1783009640946"}
```

### 5.4 单元测试（vitest）

```ts
import { describe, it, expect } from "vitest";
import { toolRegistry } from "@/server/tools";

describe("calculator tool", () => {
  const run = async (expression: string) => {
    const { result } = await toolRegistry.execute("calculator", { expression });
    return result as { value: number };
  };

  it("基本四则运算", async () => {
    expect((await run("123 * 456")).value).toBe(56088);
    expect((await run("1 + 2 * 3")).value).toBe(7);
    expect((await run("(1 + 2) * 3")).value).toBe(9);
  });

  it("一元负号", async () => {
    expect((await run("-5 + 3")).value).toBe(-2);
    expect((await run("abs(-7)")).value).toBe(7);
  });

  it("常量与函数", async () => {
    expect((await run("pi")).value).toBeCloseTo(3.1416, 3);
    expect((await run("2 ^ 10")).value).toBe(1024);
  });
});
```

运行 `pnpm test`，结果：
```
✓ tests/tools/calculator.test.ts (5 tests) 9ms
Test Files  1 passed (1)
     Tests  5 passed (5)
```

### 5.5 Composer 工具开关 UX

```tsx
// Bot 按钮 + 数量 badge
<button onClick={() => setShowTools(v => !v)}>
  <Bot />
  {enabledCount > 0 && <span className="absolute -right-0.5 -top-0.5 size-3.5 rounded-full bg-cyber-cyan text-[8px] flex items-center justify-center">{enabledCount}</span>}
</button>

// 关闭 calculator 后问"1+1"
{
  enabledTools: ["get_current_time", "web_search", "code_runner", "word_count"]
}
// Mock Provider 找不到 calculator 规则，降级到"经典对话"分支
// 用户看到："这是 Mock Provider 的演示回复，试试 xxx..."
```

### 5.6 错误处理：除以 0

```ts
// 用户输入"10 / 0"
{
  "kind": "tool_call",
  "name": "calculator",
  "args": { "expression": "10 / 0" }
}
{
  "kind": "tool_result",
  "name": "calculator",
  "error": "Tool \"calculator\" failed: Result is infinite"
}
```

UI 上 ToolCallCard 显示红色 error 徽章，折叠后看到 `错误：Tool "calculator" failed: Result is infinite`。AI 拿到 error 后在 Mock 模式下走默认总结，但此时 dispatcher 会用 `tool` role 把 error 也回传给 LLM。

实际测试中 Mock Provider 的 calculator 规则用 `value` 字段判断 `Number.isFinite`，会抛"Result is infinite"。

---

## 6. 验证结果

| 验证项 | 结果 |
|--------|------|
| `pnpm typecheck` | ✅ 0 error |
| `pnpm lint` | ✅ 0 warning |
| `pnpm build` | ✅ Compiled successfully · 5 routes |
| `pnpm test` | ✅ 5 tests passed |
| `curl /api/chat` 工具调用 5 种场景 | ✅ 全部正常返回 tool_call + tool_result + 流式 delta |
| ToolCallCard UI 渲染 | ✅ 状态徽章 + 耗时 + 可折叠参数/结果 |
| Composer Bot 工具开关 | ✅ 全部启用 / 全部禁用 / 单选 |
| 重新生成按钮 | ✅ 删除末尾 AI → 重新调用 |

## 7. 关联文档

- 需求文档：[M2-tool-calling.md](../requirements/M2-tool-calling.md)
- 架构总览：[00-architecture.md](../learning/00-architecture.md)
- M1 学习文档：[M1-basic-chat.md](../learning/M1-basic-chat.md)
- 技术架构（PRD）：[technical-architecture.md](../../.trae/documents/technical-architecture.md)
- PRD：[prd.md](../../.trae/documents/prd.md)
