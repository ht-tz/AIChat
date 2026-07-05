# M16: LangChain 基础集成 —— 学习文档

> 里程碑：LangChain LLM 抽象层 + PromptTemplate + OutputParser
> 对比自研模块：`src/server/providers/`
> 学习目标：通过「自研 → 框架」对比，理解工业级 LLM 抽象设计

---

## 一、需求思路

### 1.1 学习动机

项目已自研完整的 LLM Agent 链路：
- `LLMProvider` 接口（`stream`/`complete`/`embed`）
- `OpenAIProvider`（手写 fetch + SSE 流式）
- `MockProvider`（离线调试）
- `prompt-templates.ts`（数据库存储模板）
- `auth-service.ts` 中 `JSON.parse(planResult.content)`（手写解析）

引入 LangChain 后，可以对比学习：
1. **ChatModel 抽象** —— LangChain 如何统一 50+ Provider
2. **PromptTemplate** —— 参数化模板 vs 自研字符串拼接
3. **OutputParser** —— 结构化输出 vs 手写 `JSON.parse` + Zod

### 1.2 设计原则

- **不替换自研代码** —— 新增 `src/server/langchain/` 目录并存
- **双引擎模式** —— `LLM_PROVIDER=langchain` 环境变量切换
- **学习优先** —— 每个文件顶部注释标注与自研方案的对比

---

## 二、代码思路

### 2.1 LangChainProvider 适配器

**核心问题**：如何让 LangChain 的 `ChatOpenAI` 适配自研 `LLMProvider` 接口？

**自研接口**：
```typescript
interface LLMProvider {
  stream(opts): AsyncIterable<AgentStep>;  // 流式
  complete(opts): Promise<{content, usage}>;  // 一次性
  embed(text): Promise<number[]>;  // 嵌入
}
```

**LangChain 对应**：
- `ChatOpenAI.stream(messages)` → `AIMessageChunk` 流
- `ChatOpenAI.invoke(messages)` → `AIMessage`
- `OpenAIEmbeddings.embedQuery(text)` → `number[]`

**适配策略**：`LangChainProvider` 实现自研 `LLMProvider` 接口，内部委托给 LangChain：

```typescript
class LangChainProvider implements LLMProvider {
  name = "langchain";
  
  async *stream(opts) {
    // 1. 自研消息格式 → LangChain 消息格式
    const lcMessages = opts.messages.map(convertMessage);
    // 2. 调用 ChatOpenAI.stream()
    const stream = await this.model.stream(lcMessages);
    // 3. AIMessageChunk → AgentStep.delta
    for await (const chunk of stream) {
      yield { kind: "delta", content: chunk.content };
    }
    yield { kind: "done", usage: ..., runId: ... };
  }
}
```

**消息格式转换**：
| 自研 role | LangChain 类 |
|-----------|-------------|
| `system` | `SystemMessage` |
| `user` | `HumanMessage` |
| `assistant` | `AIMessage` |
| `tool` | `ToolMessage` |

### 2.2 PromptTemplate 实验

**自研方案**（`prompt-templates.ts`）：
```typescript
// 数据库存储模板字符串，运行时 .replace() 替换变量
const prompt = template.content
  .replace("{goal}", userGoal)
  .replace("{context}", context);
```

**LangChain 方案**：
```typescript
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "你是规划专家。目标：{goal}"],
  ["human", "请制定计划"],
]);
const chain = prompt.pipe(model).pipe(parser);
const result = await chain.invoke({ goal: "..." });
```

**核心差异**：
- 自研：字符串拼接，无类型检查，变量遗漏不报错
- LangChain：模板与变量分离，`pipe()` 自动串联，LCEL 表达式

### 2.3 StructuredOutputParser

**自研方案**（`auth-service.ts`）：
```typescript
const planResult = await getProvider().complete({
  messages: [...],
  jsonMode: true,
});
const plan = JSON.parse(planResult.content);  // 无 schema 验证
```

**LangChain 方案**：
```typescript
const parser = StructuredOutputParser.fromZodSchema(
  z.object({
    stages: z.array(z.object({
      name: z.string(),
      tasks: z.array(z.object({...})),
    })),
  })
);

const chain = prompt.pipe(model).pipe(parser);
const plan = await chain.invoke({...});  // 类型安全，自动验证
```

**核心差异**：
- 自研：`JSON.parse` 失败需 try/catch，无 schema 约束
- LangChain：Zod schema 驱动，解析失败有详细错误，类型推断

---

## 三、技术架构

### 3.1 双引擎切换

```
┌─────────────────────────────────────────┐
│  getProvider() 工厂函数                  │
│  src/server/providers/index.ts          │
├─────────────────────────────────────────┤
│  LLM_PROVIDER=mock      → MockProvider  │
│  LLM_PROVIDER=openai    → OpenAIProvider│
│  LLM_PROVIDER=langchain → LangChainProvider │
└─────────────────────────────────────────┘
```

### 3.2 文件结构

```
src/server/langchain/
├── provider.ts       # LangChainProvider 适配器
├── prompts.ts        # 7 个 PromptTemplate 实验
└── index.ts          # 统一导出

src/app/api/langchain/
├── chat/route.ts     # POST 流式对话
└── prompt/route.ts   # POST PromptTemplate 生成

src/app/langchain/
└── page.tsx          # 双引擎对比学习页
```

### 3.3 API 端点

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/langchain/chat` | POST | LangChain 流式对话（SSE） |
| `/api/langchain/prompt` | POST | PromptTemplate 生成（支持 basic/chat/plan/reflection/rag） |
| `/langchain` | GET | 双引擎对比学习页 |

---

## 四、技术扩展

### 4.1 LCEL (LangChain Expression Language)

LCEL 是 LangChain 的核心创新 —— 用 `pipe()` 串联组件：

```typescript
const chain = promptTemplate
  .pipe(model)
  .pipe(parser);

// 等价于 RunnableSequence.from([prompt, model, parser])
```

**LCEL 的优势**：
1. **流式原生支持** —— 任何 chain 都可以 `.stream()` 
2. **异步批处理** —— `.batch()` 自动并行
3. **回退机制** —— `.withFallbacks()` 链式降级
4. **可观测性** —— LangSmith 自动追踪每个环节

### 4.2 多 Provider 支持

LangChain 内置 50+ Provider，切换只需改一行：
```typescript
// OpenAI
import { ChatOpenAI } from "@langchain/openai";
// Anthropic
import { ChatAnthropic } from "@langchain/anthropic";
// Google
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

// 统一接口
const model = new ChatOpenAI({...});
const model2 = new ChatAnthropic({...});
// 调用方式完全相同
```

对比自研：每新增 Provider 需手写 fetch + SSE 解析（~200 行/Provider）。

### 4.3 LangSmith 追踪

设置环境变量即可启用：
```env
LANGCHAIN_API_KEY=...
LANGCHAIN_PROJECT=nexus-ai
```

所有 LLM 调用、Prompt 渲染、Chain 执行自动上报到 LangSmith，可视化分析延迟、token 消耗、错误率。

---

## 五、示例

### 5.1 启动双引擎对比

```bash
# 1. 切换到 LangChain 引擎
export LLM_PROVIDER=langchain
export OPENAI_API_KEY=sk-...
export OPENAI_BASE_URL=https://api.openai.com/v1

# 2. 启动项目
pnpm dev

# 3. 访问对比页
open http://localhost:3000/langchain
```

### 5.2 API 调用示例

```bash
# LangChain 对话
curl -X POST http://localhost:3000/api/langchain/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"你好"}]}'

# PromptTemplate 生成（plan 类型）
curl -X POST http://localhost:3000/api/langchain/prompt \
  -H "Content-Type: application/json" \
  -d '{"type":"plan","variables":{"goal":"写一篇关于 AI 的文章"}}'
```

### 5.3 学习要点总结

| 维度 | 自研方案 | LangChain 方案 | 学习收获 |
|------|---------|---------------|---------|
| Provider 抽象 | `LLMProvider` 接口（3 方法） | `ChatModel` + `Embeddings` 分离 | 关注点分离更清晰 |
| 消息类型 | `role` 字符串 | `BaseMessage` 类层级 | 类型安全 |
| 模板 | 字符串 `.replace()` | `ChatPromptTemplate` | 变量验证 + 格式化 |
| 输出解析 | `JSON.parse` + try/catch | `StructuredOutputParser` + Zod | Schema 驱动 |
| 链式调用 | 手动串联 | LCEL `pipe()` | 声明式 |
| 生态 | 自研 1 个 Provider | 50+ Provider 开箱即用 | 标准化 |

---

## 六、验收结果

- `LLM_PROVIDER=langchain` 可正常对话
- PromptTemplate 支持 5 种类型（basic/chat/plan/reflection/rag）
- StructuredOutputParser 可解析 JSON 输出
- 双引擎对比页 `/langchain` 可正常展示
- `pnpm run typecheck` 0 错误
- `pnpm run lint` 0 警告
