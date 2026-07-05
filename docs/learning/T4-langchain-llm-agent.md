# T4 · LangChain + LangGraph + Agent 核心概念 · 学习文档

> **5 段式**：概念详解 / 代码思路 / 技术架构 / 技术拓展 / 示例
> 配套项目代码：`src/server/providers/`、`src/features/chat/`、M2-M11 相关里程碑

## 基本信息

- **编号**：T4（技术栈-Tech）
- **标题**：LLM 应用开发与 Agent 核心概念
- **完成日期**：2026-07-04
- **作者**：NEXUS
- **状态**：✅ 已完成

---

## 1. 概念详解

### 1.1 LLM（大语言模型）基础

LLM（Large Language Model）是基于 Transformer 架构、在海量文本上预训练的神经网络模型。它的能力是"**给定前文，预测下一个 token**"，通过不断重复这个过程生成完整文本。

#### 关键术语

| 术语 | 解释 |
|------|------|
| **Token** | 文本的最小单位，不一定是字或词。中文约 1-2 字/token，英文约 0.75 词/token。GPT-4o 支持 128K token 上下文。 |
| **Prompt** | 给模型的输入（提示词），包含指令、上下文、问题等。 |
| **Completion** | 模型生成的回复。 |
| **Temperature** | 采样温度，0-2 之间。越高越随机/有创造性，越低越确定/精确。代码/事实任务用 0-0.3，创意写作用 0.7-1.0。 |
| **Top-p** | 核采样，只从概率加起来达到 p 的候选 token 中采样。通常设为 0.9-1.0。 |
| **Context Window** | 上下文窗口，模型一次能处理的最大 token 数（输入+输出总和）。 |
| **Streaming** | 流式输出，模型逐 token 生成，不需要等完整回复。 |
| **System Prompt** | 系统提示词，放在对话最前面，定义模型的角色、行为、约束。 |

#### Chat Completion 消息格式

所有主流 LLM API（OpenAI、DeepSeek、通义千问等）都使用统一的消息格式：

```json
[
  { "role": "system", "content": "你是一个有用的AI助手。" },
  { "role": "user", "content": "什么是React？" },
  { "role": "assistant", "content": "React是一个用于构建用户界面的JavaScript库..." },
  { "role": "user", "content": "它和Vue有什么区别？" }
]
```

### 1.2 Provider 抽象层

不同厂商的 LLM API 有细微差别，本项目通过 **Provider 抽象层**统一接口：

```typescript
// src/server/providers/types.ts
interface LLMProvider {
  stream(messages: ChatMessage[], options?: StreamOptions): AsyncIterable<StreamEvent>;
  complete(messages: ChatMessage[], options?: CompleteOptions): Promise<string>;
}
```

内置 Provider：
- **Mock Provider**（默认）：不调用真实 API，返回预设的流式响应，开发调试用
- **OpenAI Provider**：支持 GPT-4o、GPT-4o-mini 等 OpenAI 格式 API
- **OpenAI Compatible**：通过自定义 Base URL 支持 DeepSeek、Qwen、Ollama、LM Studio 等兼容接口

### 1.3 SSE 流式协议

本项目自定义了一套简单的 SSE 事件协议，用于前后端流式通信：

```typescript
type AgentStep =
  | { type: "delta"; content: string }           // 文本增量（打字机效果）
  | { type: "thought"; content: string }         // 思考过程（ReAct/Plan）
  | { type: "tool_call"; name: string; input: any; id: string }  // 工具调用
  | { type: "tool_result"; id: string; content: string }         // 工具返回
  | { type: "done"; tokens?: number }            // 完成
  | { type: "error"; message: string };          // 错误
```

前端通过 `ReadableStream` 逐个消费这些事件，渲染不同的 UI 部分。

### 1.4 Function Calling（函数调用 / 工具调用）

Function Calling 是 LLM 的一个关键能力：模型在对话中可以**决定调用一个函数/工具**，输出结构化的函数名和参数，由外部执行后把结果返回给模型，模型继续生成回复。

这是 Agent 的基础能力（M2 里程碑实现）。

```typescript
// 定义工具
const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_weather",
      description: "获取指定城市的当前天气",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "城市名，如北京、上海" },
        },
        required: ["city"],
      },
    },
  },
];

// 模型回复中包含 tool_calls
// {
//   role: "assistant",
//   content: null,
//   tool_calls: [{ id: "call_1", type: "function", function: { name: "get_weather", arguments: '{"city":"北京"}' } }]
// }

// 执行工具后返回结果
// { role: "tool", tool_call_id: "call_1", content: "北京今天晴，25°C" }
```

### 1.5 ReAct（Reasoning + Acting）

ReAct 是 Agent 最经典的范式：**思考（Reason）→ 行动（Act）→ 观察（Observe）→ 循环**。

```
问题：北京今天适合出门吗？

Thought: 我需要先查北京今天的天气。
Action: get_weather(city="北京")
Observation: 北京今天大雨，18°C
Thought: 下大雨不适合出门，我应该告诉用户。
Answer: 北京今天下大雨，温度18°C，建议带伞，不太适合户外活动。
```

M3 里程碑完整实现了 ReAct 循环。

### 1.6 LangChain — LLM 应用框架

LangChain 是一个 LLM 应用开发框架，提供了大量现成的组件：
- **Chat Models**：统一封装各家 LLM API
- **Prompts**：提示词模板、Few-shot、Output Parser
- **Chains**：组合多个组件（LCEL 表达式语言）
- **Tools & Agents**：工具定义、Agent 执行器
- **Retrievers**：向量检索、RAG 组件
- **Memory**：对话历史管理

本项目 M16-M17 学习并集成 LangChain，但核心功能也提供了**不依赖 LangChain 的自研实现**（M1-M15），方便理解底层原理。

### 1.7 LangGraph — 有状态的 Agent 工作流

LangGraph 是 LangChain 团队推出的**基于图（Graph）的 Agent 编排框架**，适合构建复杂的多步、多 Agent 工作流。

核心概念：
- **State**：图中所有节点共享的状态对象
- **Node**：执行一个步骤（调用 LLM、执行工具等）
- **Edge**：节点之间的连接，可以是条件边（根据 state 决定下一步）
- **START / END**：图的入口和出口
- **Checkpoint**：状态持久化，可以中断/恢复/回溯（HITL 人机交互）

```
START → agent(LLM推理) ─→ should_continue? ─→ tools(执行工具) ─→ agent
                           │
                           └→ END
```

### 1.8 RAG（Retrieval-Augmented Generation，检索增强生成）

RAG 解决 LLM 的两个核心问题：
1. **知识过时**：训练数据有截止日期
2. **私有数据**：模型不知道你的内部文档

RAG 流程：

```
文档 → 分块 → Embedding向量化 → 存入向量数据库
                                          ↓
用户提问 → Embedding → 向量相似度检索 → 相关文档片段
                                          ↓
                    将问题 + 相关文档一起给 LLM → 带引用的回答
```

M9 里程碑实现了知识库 RAG 功能。

### 1.9 Embedding（向量化）

Embedding 是将文本转换为**高维向量**（通常 768/1024/1536 维），语义相近的文本在向量空间中距离近。

```
"我喜欢猫"  → [0.12, -0.34, 0.56, ...] (1536维向量)
"我喜欢狗"  → [0.11, -0.32, 0.58, ...] (距离很近)
"量子物理"  → [-0.88, 0.23, -0.11, ...] (距离很远)
```

相似度通常用**余弦相似度**（cosine similarity）计算。

---

## 2. 代码思路

### 2.1 为什么先自研再集成 LangChain？

M1-M15 采用**自研实现**，M16-M20 学习 LangChain/LangGraph。原因：

1. **理解原理**：直接用 LangChain 会变成"调包侠"，不知道黑盒里发生了什么
2. **调试能力**：自研代码可控性强，bug 容易定位
3. **对比学习**：M20 专门做"自研 vs LangChain"对比分析
4. **渐进式学习**：从最简单的 Mock Provider 开始，逐步增加复杂度

### 2.2 事件驱动的流式架构

整个聊天系统是**事件流**架构：

```
Composer (前端输入)
    ↓ POST /api/chat { messages, model }
AgentService (服务端)
    ↓ 调用 LLMProvider.stream()
    ↓ for await (const event of stream) { writer.write(event) }
SSE Response (text/event-stream)
    ↓ ReadableStream reader
ChatStore (前端 Zustand)
    ↓ 按 event.type 分发到消息列表
MessageRenderer (React 组件)
    ↓ delta → 追加到气泡末尾（打字机效果）
    ↓ tool_call → 渲染工具调用卡片
    ↓ thought → 折叠的思考过程
    ↓ done → 标记完成，显示操作按钮
```

### 2.3 Agent 执行循环（自研 ReAct）

```typescript
async function runReAct(messages: ChatMessage[], tools: Tool[]) {
  const scratchpad: ChatMessage[] = []; // 思考轨迹
  const maxIterations = 5;

  for (let i = 0; i < maxIterations; i++) {
    // 1. 调用 LLM（带工具定义）
    const response = await llm.chat({
      messages: [...messages, ...scratchpad],
      tools,
    });

    // 2. 如果有工具调用，执行工具
    if (response.toolCalls?.length) {
      yield { type: "thought", content: `使用工具: ${response.toolCalls[0].name}` };
      for (const tc of response.toolCalls) {
        const result = await executeTool(tc.name, tc.arguments);
        scratchpad.push(response); // 包含 tool_calls 的 assistant 消息
        scratchpad.push({ role: "tool", toolCallId: tc.id, content: result });
        yield { type: "tool_result", id: tc.id, content: result };
      }
    } else {
      // 3. 没有工具调用，直接返回最终答案
      yield { type: "text", content: response.content };
      return;
    }
  }
  yield { type: "error", message: "达到最大迭代次数" };
}
```

---

## 3. 技术架构

### 3.1 Provider 抽象结构

```
src/server/providers/
├── types.ts             # ChatMessage、StreamEvent、LLMProvider 接口
├── mock.ts              # Mock Provider（默认，预设流式回复）
├── openai.ts            # OpenAI Provider（支持任意 OpenAI 兼容端点）
└── index.ts             # getProvider() 工厂函数，根据 settings 返回对应 provider
```

切换模型/Provider 只需要改 settings，不需要改业务代码。

### 3.2 聊天消息结构

```typescript
interface ChatMessage {
  id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCall[];      // assistant 消息可能包含工具调用
  toolCallId?: string;         // tool 消息对应的调用 ID
  createdAt: Date;
  tokens?: number;
  model?: string;
  metadata?: Record<string, unknown>;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  status?: "pending" | "running" | "completed" | "error";
}
```

### 3.3 多智能体架构（M8/M14/M15）

多智能体模式中，不同 Agent 有不同角色，通过消息传递协作：

```
┌────────────────────────────────────────────────┐
│               Orchestrator (协调者)             │
│   接收用户请求，决定分配给哪个专家 Agent         │
└────┬───────────────┬──────────────┬────────────┘
     │               │              │
     ▼               ▼              ▼
┌─────────┐   ┌──────────┐   ┌──────────┐
│ Planner │   │ Researcher│   │ Coder    │
│ 规划分解 │   │ 信息检索  │   │ 代码生成  │
└─────────┘   └──────────┘   └──────────┘
```

---

## 4. 技术拓展

### 4.1 Prompt Engineering 技巧

M6 里程碑专门学习提示词工程，核心技巧：

1. **System Prompt 明确角色**："你是一个资深前端工程师，擅长React和TypeScript。回答要简洁准确，给出代码示例。"
2. **Few-shot 示例**：给出 2-3 个输入输出示例，比抽象描述更有效
3. **思维链（Chain of Thought, CoT）**：加"请一步步思考"能显著提升推理能力
4. **结构化输出**：要求模型输出 JSON，并提供 schema
5. **System Prompt 里给约束**：长度限制、禁用词、输出格式要求

### 4.2 评估（Eval）

M10 里程碑实现自动评估：如何判断 AI 的回复质量？

- **基于规则**：格式检查、关键词匹配
- **基于 LLM-as-Judge**：让另一个 LLM（通常是 GPT-4）当裁判打分
- **人工标注**：人工评价好/坏/一般
- **A/B 测试**：线上分流，对比不同 Prompt/模型的效果

### 4.3 常见 Agent 模式

| 模式 | 适用场景 | 实现里程碑 |
|------|---------|-----------|
| ReAct | 通用工具调用问答 | M3 |
| Plan-and-Execute | 复杂任务先规划再执行 | M8 |
| Reflexion | 自我反思纠错 | M8 |
| Multi-Agent Debate | 多个 Agent 辩论得到更优答案 | M8 |
| RAG | 基于私有文档问答 | M9 |
| HITL（Human-in-the-loop）| 关键步骤人工确认 | LangGraph M19 |

### 4.4 模型选择建议

| 场景 | 推荐模型 | 原因 |
|------|---------|------|
| 日常对话/快速试验 | GPT-4o-mini / DeepSeek-V3 | 便宜、速度快 |
| 复杂推理/代码生成 | GPT-4o / Claude 3.5 Sonnet | 能力强 |
| 工具调用/Agent | GPT-4o / Claude 3.5 | Function Calling 稳定 |
| 本地开发/无API Key | Mock Provider | 无需网络 |
| Embedding | text-embedding-3-small | 便宜、质量好 |

### 4.5 知识链接

- 📖 **OpenAI API 官方文档**：https://platform.openai.com/docs
- 📖 **LangChain 官方文档**：https://js.langchain.com/docs
- 📖 **LangGraph 官方文档**：https://langchain-ai.github.io/langgraphjs/
- 📖 **ReAct 原始论文**：https://arxiv.org/abs/2210.03629
- 📖 **Prompt Engineering Guide**：https://www.promptingguide.ai/
- 📖 **DeepSeek API 文档**：https://api-docs.deepseek.com/
- 🎥 **Andrej Karpathy - Let's build GPT**：https://www.youtube.com/watch?v=kCc8FmEb1nY（理解Transformer原理）
- 📖 **RAG 最佳实践**：https://python.langchain.com/docs/tutorials/rag/
- 📖 **Lilian Weng - LLM Powered Autonomous Agents**：https://lilianweng.github.io/posts/2023-06-23-agent/（Agent 经典综述）

---

## 5. 示例

### 5.1 最小流式聊天（无框架）

```typescript
// 直接调用 OpenAI 兼容 API 实现流式输出
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL, // 支持 DeepSeek 等兼容接口
});

async function streamChat(messages: Array<{ role: string; content: string }>) {
  const stream = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: messages as any,
    temperature: 0.7,
    stream: true, // 关键：开启流式
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      process.stdout.write(content); // 或通过 SSE 发给前端
    }
  }
}
```

### 5.2 一个简单的 ReAct Agent（核心循环）

```typescript
async function simpleReAct(question: string, tools: Record<string, Function>) {
  const systemPrompt = `你是一个可以使用工具的AI助手。
可用工具：${Object.keys(tools).join(", ")}

每次回复时，如果需要使用工具，请用以下格式：
Thought: 你在思考什么
Action: 工具名
Action Input: 参数JSON

如果不需要工具，直接回答：
Answer: 最终答案`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
  ];

  for (let i = 0; i < 5; i++) {
    const response = await callLLM(messages);
    messages.push({ role: "assistant", content: response });
    console.log(response);

    // 解析 Answer:
    if (response.includes("Answer:")) {
      return response.split("Answer:")[1].trim();
    }

    // 解析 Action + Action Input
    const actionMatch = response.match(/Action:\s*(.+)/);
    const inputMatch = response.match(/Action Input:\s*(.+)/s);
    if (actionMatch && inputMatch) {
      const toolName = actionMatch[1].trim();
      const toolInput = JSON.parse(inputMatch[1].trim());
      const result = await tools[toolName](toolInput);
      const observation = `Observation: ${result}`;
      messages.push({ role: "user", content: observation });
      console.log(observation);
    }
  }
  return "达到最大迭代次数";
}
```

### 5.3 SSE 服务端实现（Next.js Route Handler）

```typescript
// src/app/api/chat/route.ts
export async function POST(req: Request) {
  const { messages, model } = await req.json();
  const provider = getProvider(model);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (type: string, data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`));
      };

      try {
        for await (const event of provider.stream(messages)) {
          send(event.type, event);
        }
        send("done", {});
      } catch (err: any) {
        send("error", { message: err.message });
      } finally {
        controller.close();
      }
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

### 5.4 前端消费 SSE

```typescript
async function* streamChat(url: string, body: any) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      const line = part.trim();
      if (line.startsWith("data: ")) {
        try {
          yield JSON.parse(line.slice(6));
        } catch { /* skip */ }
      }
    }
  }
}

// 使用
for await (const event of streamChat("/api/chat", { messages })) {
  switch (event.type) {
    case "delta": appendToMessage(event.content); break;
    case "thought": addThoughtBubble(event.content); break;
    case "done": finalizeMessage(); break;
  }
}
```

---

## 6. 验证记录

- LLM Provider 抽象层已实现，Mock/OpenAI/OpenAI-Compatible 三种模式
- SSE 流式事件协议 (delta/thought/tool_call/tool_result/done/error) 已定义并在前后端完整实现
- M1-M15 自研实现了基础对话到多智能体的完整能力，M16-M20 学习 LangChain/LangGraph 并提供对比
- `pnpm typecheck` ✅ 通过

## 7. 收获与踩坑

- **学到了什么**：Agent 的本质是 LLM + 循环 + 工具调用；流式输出是提升用户体验的关键；Provider 抽象层让切换模型几乎零成本
- **踩过的坑**：
  1. SSE 事件之间必须用**两个换行** `\n\n` 分隔，否则前端解析不到
  2. OpenAI API 在国内需要配置代理或使用 DeepSeek 等兼容端点，本地开发用 Mock Provider 最省事
  3. ReAct 循环一定要设最大迭代次数，否则工具调用出错时可能无限循环
  4. LangChain 的文档有些混乱，JS 版和 Python 版 API 不完全一致，以官方 JS 文档为准
- **下次会怎么做**：新功能先用自研方式实现核心逻辑，理解原理后再评估是否用 LangChain 重构；始终保留 Mock Provider 作为默认选项
