# M3 ReAct 多步推理 · 学习文档

> M3 在 M2 单轮工具调用基础上升级：多轮 + Plan + Reflexion + 持久化。配套需求文档：[M3-react.md](../requirements/M3-react.md)。

## 1. 需求思路

### 1.1 M2 的局限

M2 阶段 LLM 只能调 1 次工具。但现实任务很少 1 步就能解决：
- "查时间，再算 3 小时后是几点" → 需要 2 步
- "先搜 A，再搜 B，对比两个结果" → 需要 2 步
- LLM 答错了不知道 → 没有自反思
- 关浏览器就丢数据 → 没有持久化

### 1.2 M3 要解决什么

| 能力 | 体现 |
|------|------|
| **多轮工具调用** | `maxToolRounds=5`，LLM 拿到 tool_result 后可继续调 |
| **Plan-and-Execute** | LLM 先 yield `plan` 事件（todos），再逐项执行 |
| **Reflexion 自反思** | 评分 < 0.6 自动注入反思消息重试 |
| **持久化** | 每次 run 落 PostgreSQL（agent_runs / agent_steps / tool_calls） |
| **可视化** | 计划清单 + 反思评分在 UI 显式展示 |

### 1.3 完成标志

- [x] `maxToolRounds=5` 工作（plan → tool_call → tool_result → reflection → delta）
- [x] 输入"计划 xxx"看到 Plan todo 列表
- [x] 反思评分 < 0.6 时自动重试
- [x] `agent_runs` / `agent_steps` / `tool_calls` 落 PostgreSQL
- [x] Plan UI 与 Reflection UI 显示

## 2. 代码思路

### 2.1 关键文件

| 文件 | 职责 |
|------|------|
| `src/server/db/schema.ts` | 7 张表：agents / sessions / messages / tool_calls / agent_runs / agent_steps / tools |
| `src/server/db/index.ts` | postgres-js + drizzle 连接（`process.env.DATABASE_URL`） |
| `src/server/agent/dispatcher.ts` | `runAgent` 多轮循环 + 反思重试 |
| `src/server/agent/persistence.ts` | startRun / persistStep / finishRun 落库 |
| `src/server/providers/mock.ts` | plan / reflection 事件 + 反思重试分支 |
| `src/components/agent/plan-todo.tsx` | PlanTodoList + ReflectionCard 组件 |
| `src/components/chat/message-bubble.tsx` | 渲染 plans / reflections |
| `src/features/chat/chat-container.tsx` | 累积 plan / reflection 到 message |
| `drizzle/0000_*.sql` + `0001_*.sql` | 数据库 schema 迁移 |

### 2.2 Dispatcher 多轮循环

```ts
// src/server/agent/dispatcher.ts
for (let round = 0; round <= maxRounds; round++) {
  // 1. 调 Provider 一轮，捕获 plan / tool_call / reflection
  for await (const step of provider.stream({...})) {
    if (step.kind === "plan") plan.push(...step.todos);
    if (step.kind === "tool_call") toolCallsThisRound.push({...});
    if (step.kind === "reflection") { roundScore = step.score; ... }
    yield await persistAndYield(step);
  }

  // 2. 反思：低分 + revise=true → 重试
  if (enableReflection && roundScore < threshold && shouldRevise && round < maxRounds) {
    currentMessages = [...currentMessages, {
      role: "system",
      content: `[Reflection] 你的上一轮答案评分仅 ${roundScore}。Critique: ${roundCritique}\n请基于反思结果改进答案。`
    }];
    continue;
  }

  // 3. 无 tool_call 跳出
  if (toolCallsThisRound.length === 0) break;

  // 4. 执行工具 + 回填
  for (const tc of toolCallsThisRound) {
    const out = await toolRegistry.execute(tc.name, tc.args, { signal });
    yield { kind: "tool_result", ... };
    currentMessages.push({ role: "tool", name: tc.name, content: JSON.stringify(out) });
  }
}
```

### 2.3 持久化（关键代码）

```ts
// src/server/agent/persistence.ts
export async function startRun({ sessionId, userMessage, model }) {
  await ensureSession(sessionId);  // 先 upsert session，避免 FK 失败
  const [row] = await db.insert(agentRuns).values({...}).returning({ id: agentRuns.id });
  return row?.id;
}

export async function persistStep({ runId, stepIndex, step }) {
  if (step.kind === "plan")    await db.insert(agentSteps).values({...base, payload: { todos }});
  if (step.kind === "thought") await db.insert(agentSteps).values({...base, content: step.content});
  if (step.kind === "tool_call")   await db.insert(toolCallsTable).values({...}) + agentSteps;
  if (step.kind === "tool_result") await db.insert(agentSteps).values({...}) + update toolCallsTable;
  if (step.kind === "reflection")  await db.insert(agentSteps).values({...base, payload: { score, critique, revise }});
  // ...
}
```

**所有写操作包 try/catch，失败仅 warn 不影响主流程**。DB 不可用时，AI 仍能正常返回。

### 2.4 Mock Provider 升级

```ts
// 1. 反思重试分支
if (lastSystem?.content.startsWith("[Reflection]")) {
  yield { kind: "thought", content: "根据反思反馈重新生成答案。" };
  // ... 流式输出改进版
  yield { kind: "reflection", score: 0.92, critique: "已改进", revise: false };
  return;
}

// 2. Plan 触发：用户输入"计划 xxx"
const plan = pickPlan(input);
if (plan) {
  yield { kind: "plan", todos: plan.todos };
  // 默认触发 calculator（如果 goal 里有算式）
}

// 3. 每次输出都 yield reflection 评分
yield { kind: "reflection", score: 0.85, critique: "答案基于工具结果，可信度高。", revise: false };
```

### 2.5 计划 UI

```tsx
<PlanTodoList todos={plans} streaming={isStreaming} />
// 渲染为有序列表，状态分：✓ done / ⏳ running / ○ pending
// 头部显示 "执行计划 · 2/3 完成"
```

```tsx
<ReflectionCard reflection={{ score: 0.85, critique: "...", revise: false }} />
// 头部：💡 自反思 85/100
// 颜色：80+ 绿 / 60-79 青 / <60 品红
// revise=true 时显示"已触发重试"徽章
```

## 3. 技术架构

### 3.1 数据流（M3）

```
用户："计划 计算 100 + 200"
  ↓
ChatContainer.handleSend
  ↓
POST /api/chat { sessionId, messages, enablePlan, enableReflection, maxToolRounds: 5 }
  ↓
runAgent (dispatcher)
  ↓
ensureSession(sid) → sessions 表 upsert
  ↓
startRun() → agent_runs 表新增一条 (status: running)
  ↓
┌─ Round 1 ─────────────────────────────────────┐
│ provider.stream:                               │
│   yield { kind: "thought", content }            │
│   yield { kind: "plan", todos: [...] }          │
│   yield { kind: "tool_call", name: "calculator" }│
│ dispatcher:                                    │
│   execute tool → yield { kind: "tool_result" }  │
│   追加 { role: "tool" } to currentMessages     │
└────────────────────────────────────────────────┘
  ↓
┌─ Round 2 ─────────────────────────────────────┐
│ provider.stream:                               │
│   yield { kind: "thought" }                    │
│   yield { kind: "reflection", score: 0.85 }    │
│   yield { kind: "delta", content: "计" } ...   │
│   yield { kind: "done", usage }                │
└────────────────────────────────────────────────┘
  ↓
finishRun() → agent_runs 表更新 (status: success, total_rounds, tokens)
  ↓
SSE 编码 → 客户端
  ↓
MessageBubble 渲染 PlanTodoList + ReflectionCard + Markdown
```

### 3.2 数据库 Schema（核心 3 张表）

```sql
-- agent_runs：每次 LLM 调用一条
CREATE TABLE agent_runs (
  id UUID PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL REFERENCES sessions(id),
  user_message TEXT NOT NULL,
  model VARCHAR(64) NOT NULL,
  status agent_run_status NOT NULL DEFAULT 'running',  -- running/success/error/aborted
  total_rounds INT DEFAULT 0,
  plan JSONB,                                         -- PlanItem[]
  reflection_score INT,                               -- 0-100
  reflection_critique TEXT,
  prompt_tokens INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  total_tokens INT DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- agent_steps：每个事件一条
CREATE TABLE agent_steps (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_index INT NOT NULL,
  kind agent_step_kind NOT NULL,  -- plan/thought/tool_call/tool_result/reflection/delta/done/error
  content TEXT,
  payload JSONB DEFAULT '{}',
  tool_call_id VARCHAR(64),
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- tool_calls：每次工具执行一条
CREATE TABLE tool_calls (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL,
  message_id VARCHAR(64) REFERENCES messages(id),
  call_id VARCHAR(64) NOT NULL,
  tool_name VARCHAR(64) NOT NULL,
  args JSONB NOT NULL,
  result JSONB,
  error TEXT,
  status tool_call_status DEFAULT 'pending',  -- pending/running/success/error
  duration_ms INT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
```

### 3.3 不变量

1. **DB 不可用时 AI 仍正常返回** —— 所有持久化 try/catch，失败仅 warn。
2. **sessionId 是 varchar(64) 兼容 nanoid** —— M2 的 Zustand store 用 nanoid，DB 同步。
3. **session 自动 upsert** —— 客户端不必先创 session，dispatcher 自动 ensure。
4. **delta 事件不落库** —— 量太大（M9 用聚合列优化）。
5. **反思触发重试不创建新 run** —— 同一 run 内多轮直到满意或到 maxRounds。

## 4. 技术拓展

### 4.1 Multi-Agent 编排（M8 升级方向）

M3 是单 Agent 多步。M8 把单 Agent 变成多 Agent：

```ts
// M8 升级方向：把 runAgent 包装为 graph
class AgentGraph {
  agents: Map<string, Agent>;
  edges: Array<{ from: string; to: string; condition: (state) => boolean }>;

  async *run(input): AsyncIterable<AgentStep> {
    let current = "supervisor";
    while (current) {
      const agent = this.agents.get(current)!;
      const events = runAgent({ ...agent, messages: this.state.messages });
      for await (const e of events) yield e;
      const next = this.edges.find(e => e.from === current && e.condition(this.state));
      current = next?.to;
    }
  }
}
```

### 4.2 向量记忆 + RAG（M10 升级）

当前 sessions / messages 是关系型。M10 引入 pgvector 存记忆：

```sql
CREATE EXTENSION pgvector;

CREATE TABLE memories (
  id UUID PRIMARY KEY,
  user_id VARCHAR(64),
  content TEXT,
  embedding vector(1536),  -- OpenAI embedding dim
  importance INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX memories_embedding_idx ON memories USING ivfflat (embedding vector_cosine_ops);
```

### 4.3 反思评分策略

当前 Mock Provider 固定 0.85/0.92。真实 LLM 反思可走两套：

```ts
// 策略 A：LLM 自我评分（多调用一次）
const score = await llm.score({ output, criteria: [...] });

// 策略 B：外部评分（Reward Model / BLEU / ROUGE）
const score = await rewardModel.score(output);

// 策略 C：人工反馈（生产环境）
const score = userFeedback;
```

### 4.4 异步工具（M4 升级）

当前工具是同步。M4 引入"异步长任务"（文件上传、大模型生图）：

```ts
// 工具返回"任务已派发"
async execute(args): AsyncIterable<AgentStep> {
  const task = await fileUploadQueue.enqueue(args);
  yield { kind: "tool_result", name: "file_upload", result: { taskId: task.id, status: "running" } };
  // 长轮询
  while (true) {
    await sleep(2000);
    const status = await fileUploadQueue.poll(task.id);
    if (status.done) {
      yield { kind: "tool_result", name: "file_upload", result: status.result };
      return;
    }
  }
}
```

### 4.5 增量落库（M9 优化）

当前每条 step 一次 INSERT。M9 优化为"批量 + 缓冲"：

```ts
// 缓冲 1s 或 50 条后批量 INSERT
class StepBuffer {
  private buffer: NewAgentStep[] = [];
  private timer: NodeJS.Timeout | null = null;

  push(step: NewAgentStep) {
    this.buffer.push(step);
    if (this.buffer.length >= 50) this.flush();
    else if (!this.timer) this.timer = setTimeout(() => this.flush(), 1000);
  }

  async flush() {
    if (this.buffer.length === 0) return;
    await db.insert(agentSteps).values(this.buffer);
    this.buffer = [];
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
```

## 5. 示例

### 5.1 端到端 Plan + Tool + Reflection

**输入**：`"计划 计算 100 + 200"`

**SSE 事件**：
```
data: {"kind":"thought","content":"用户想要\"计算 100 + 200\"，我先制定一个计划。"}

data: {"kind":"plan","todos":[
  {"id":"step1","title":"理解目标：计算 100 + 200","status":"running"},
  {"id":"step2","title":"调用相关工具收集信息","status":"pending"},
  {"id":"step3","title":"整理信息并给出最终答案","status":"pending"}
]}

data: {"kind":"tool_call","name":"calculator","args":{"expression":"100 + 200"}}

data: {"kind":"tool_result","name":"calculator","result":{"value":300,"formatted":"300"}}

data: {"kind":"thought","content":"工具 calculator 返回了结果，我把它整理成自然语言。"}

data: {"kind":"reflection","score":0.85,"critique":"答案基于工具结果，可信度高。","revise":false}

data: {"kind":"delta","content":"计"} ... 18 个 delta

data: {"kind":"done","usage":{...},"runId":"mock-1783036255791"}
```

**DB 落库结果**：
```
agent_runs:
  id=b1f34686-..., user_message=计划 计算 100 + 200, status=success, total_rounds=19, total_tokens=27

agent_steps (7 条):
  1 thought  用户想要"计算 100 + 200"，我先制定一个计划。
  2 plan     [{step1/running, step2/pending, step3/pending}]
  3 tool_call    calculator
  4 tool_result  calculator
  5 thought  工具 calculator 返回了结果...
  6 reflection   答案基于工具结果，可信度高。
  19 done     done: mock-1783036255791
```

### 5.2 反思重试（Mock 演示）

**输入 A**：`"解释下 Rest API"`
→ 收到反思 score=0.88 → 不重试
→ 增量写入反思 step

**输入 B**（用户接管控制流）：
```
[System 注入]: [Reflection] 你的上一轮答案评分仅 0.30。Critique: 答非所问。
```

→ 触发反思重试
→ 输出"改进版答案" + score=0.92

### 5.3 DB 查询：最近 5 次运行

```sql
SELECT 
  r.id, 
  r.user_message, 
  r.status, 
  r.total_rounds, 
  r.reflection_score, 
  r.total_tokens, 
  COUNT(s.id) as step_count
FROM agent_runs r
LEFT JOIN agent_steps s ON s.run_id = r.id
GROUP BY r.id
ORDER BY r.started_at DESC
LIMIT 5;
```

```
                  id                  |    user_message     | status | total_rounds | reflection_score | total_tokens | step_count
--------------------------------------+---------------------+--------+--------------+------------------+--------------+------------
 b1f34686-6b69-49e3-9bf9-bace38cf10e7 | 计划 计算 100 + 200 | success |           19 |                  |           27 |          7
```

## 6. 验证结果

| 验证项 | 结果 |
|--------|------|
| `pnpm typecheck` | ✅ 0 error |
| `pnpm lint` | ✅ 0 warning |
| `pnpm test` | ✅ 5/5 calculator 测试通过 |
| `pnpm build` | ✅ Compiled successfully · 5 routes |
| `curl /api/chat` Plan+Tool+Reflection 流程 | ✅ 完整：thought → plan → tool_call → tool_result → thought → reflection → delta → done |
| DB 落库 | ✅ agent_runs / agent_steps 7 条数据 |
| Plan UI | ✅ 渲染待办清单 + 进度计数 |
| Reflection UI | ✅ 渲染评分 + 评语 + 重试徽章 |

## 7. 关键 ISSUE 修复

- **ISSUE-013** drizzle-kit push 在 macOS 卡死 → 写 `scripts/db-push.sh` 用 psql 直接执行
- **ISSUE-014** sessionId 是 nanoid 而非 UUID → schema 改 varchar(64)
- **ISSUE-015** agent_runs 外键约束违反 → dispatcher 自动 ensureSession

## 8. 关联文档

- 需求文档：[M3-react.md](../requirements/M3-react.md)
- M2 学习文档：[M2-tool-calling.md](../learning/M2-tool-calling.md)
- 架构总览：[00-architecture.md](../learning/00-architecture.md)
- 交接补充：[m2-supplement.md](../handoff/m2-supplement.md) + [m3-supplement.md](../handoff/m3-supplement.md)
