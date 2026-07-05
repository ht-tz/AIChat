# M19: LangGraph HITL + Checkpoint —— 学习文档

> 里程碑：LangGraph Checkpoint + 人工审批 + 断点续跑 + 时间旅行
> 对比自研模块：`src/server/tools/types.ts`（`requireConfirm` 机制）
> 学习目标：理解状态持久化与人工介入的工业级实现

---

## 一、需求思路

### 1.1 学习动机

自研项目的 HITL（Human-in-the-Loop）能力有限：
- `Tool.requireConfirm` 标记 —— 仅暂停单个工具调用
- 前端确认弹窗 —— 用户 approve/reject
- **无持久化** —— 页面刷新即丢失上下文
- **无断点续跑** —— 必须重新开始
- **无时间旅行** —— 无法回退到历史状态

LangGraph 提供了完整的 HITL 解决方案：
- `MemorySaver` —— 内存级 Checkpointer（生产用 `PostgresSaver`）
- `interrupt_before` —— 在指定节点前自动暂停
- `thread_id` —— 会话标识，支持跨请求状态共享
- `getStateHistory()` —— 获取所有历史 Checkpoint
- `rollback` —— 时间旅行，从任意 Checkpoint 重新执行

### 1.2 核心场景

1. **人工审批** —— 工作流执行到关键节点前暂停，等待人工 approve/reject
2. **断点续跑** —— 服务重启或用户离开后，从暂停点继续
3. **时间旅行** —— 发现历史某步有问题，回退到该步重新执行
4. **状态审计** —— 查看工作流每个阶段的完整状态快照

---

## 二、代码思路

### 2.1 Checkpointer —— 状态持久化

**LangGraph 的 Checkpointer 抽象**：
```typescript
interface Checkpointer {
  put(config, checkpoint, metadata): Promise<RunnableConfig>;
  getTuple(config): Promise<CheckpointTuple | undefined>;
  list(config, filter?): AsyncIterable<CheckpointTuple>;
}
```

**MemorySaver 使用**：
```typescript
import { MemorySaver } from "@langchain/langgraph";

const globalCheckpointer = new MemorySaver();

const app = graph.compile({
  checkpointer: globalCheckpointer,  // 自动保存每个节点后的状态
  interruptBefore: ["approval_gate"],
});
```

**工作原理**：
1. 每个节点执行后，LangGraph 自动调用 `checkpointer.put()` 保存当前 state
2. 暂停时（`interrupt_before`），状态已持久化
3. 续跑时，`checkpointer.getTuple()` 加载最新 state，从暂停点继续

**对比自研**：`WorkflowEngine` 的 `this.run` 仅存在于内存，无持久化。

### 2.2 interrupt_before —— 人工审批

**HITL 工作流设计**：
```
START → stage_0 → stage_1 → ... → stage_N → [暂停]approval_gate → finalizer → END
                                              ↑
                                    interrupt_before 在此暂停
```

**实现**：
```typescript
const app = graph.compile({
  checkpointer: globalCheckpointer,
  interruptBefore: ["approval_gate"],  // 在 approval_gate 前暂停
});

// 启动 —— 执行到 approval_gate 前自动暂停
await app.invoke(initialState, {
  configurable: { thread_id: "thread-123" },
});
// 此时状态已保存，工作流暂停

// 续跑 —— 用户 approve 后继续
await app.invoke(
  { approval: "approved" },  // 注入审批状态
  { configurable: { thread_id: "thread-123" } },  // 同一 thread
);
// 图从 approval_gate 继续执行到 END
```

**对比自研 `requireConfirm`**：
| 维度 | 自研 requireConfirm | LangGraph interrupt_before |
|------|--------------------|--------------------------|
| 范围 | 单个工具调用 | 整个工作流（多节点） |
| 持久化 | 无（内存） | MemorySaver / PostgresSaver |
| 续跑 | 不支持 | `invoke(null, {thread_id})` |
| 审批数据 | 工具参数 | State 字段（如 `approval`） |

### 2.3 thread_id —— 会话标识

**核心概念**：`thread_id` 标识一个工作流会话，同一 `thread_id` 的多次 `invoke` 共享状态。

```typescript
// 第一次 invoke —— 启动工作流
await app.invoke(initialState, {
  configurable: { thread_id: "session-001" },
});

// 第二次 invoke —— 续跑（无需传 initialState）
await app.invoke({approval: "approved"}, {
  configurable: { thread_id: "session-001" },  // 同一 thread
});
```

**Thread 元数据管理**：
```typescript
interface ThreadMetadata {
  threadId: string;
  runId: string;
  goal: string;
  templateId?: string;
  status: "running" | "paused" | "completed" | "rejected" | "failed";
  createdAt: number;
  updatedAt: number;
  pausedAt?: string;  // 暂停的节点名
}

const threadStore = new Map<string, ThreadMetadata>();
```

### 2.4 断点续跑

**实现**：
```typescript
static async resume(threadId, decision, onEvent) {
  const meta = threadStore.get(threadId);
  if (!meta) throw new Error(`未找到 thread: ${threadId}`);
  if (meta.status !== "paused") throw new Error(`状态非 paused`);
  
  // 重建图（使用相同 template）
  const app = buildGraph(template, globalCheckpointer);
  
  // 续跑 —— 注入审批决定，图自动从暂停点继续
  const finalState = await app.invoke(
    { approval: decision },
    { configurable: { thread_id: threadId } },
  );
  
  return { threadId, status: "completed", finalAnswer: finalState.finalAnswer };
}
```

**关键点**：
- 续跑时**无需传 initialState**，Checkpointer 自动加载
- 续跑时传入的 `{approval: decision}` 会 merge 到现有 state
- 图自动跳过已完成的节点，从 `approval_gate` 继续

### 2.5 时间旅行

**getStateHistory**：
```typescript
const history = await app.getStateHistory({configurable: {thread_id}});
for await (const state of history) {
  console.log({
    checkpointId: state.config.configurable.checkpoint_id,
    nextStep: state.next,  // 下一个要执行的节点
    values: state.values,  // 完整 state 快照
  });
}
```

**rollback**：
```typescript
// 从指定 checkpoint 重新执行
await app.invoke(
  null,  // 不传新 state，使用 checkpoint 中的 state
  {
    configurable: {
      thread_id: threadId,
      checkpoint_id: "historical-checkpoint-id",  // 回滚到此处
    },
  },
);
```

**应用场景**：
1. 发现 stage_2 的分析有问题 → 回滚到 stage_1 后的 checkpoint
2. 修改输入参数 → 从 stage_2 重新执行
3. 对比不同参数下的执行路径

### 2.6 审批节点设计

```typescript
function createApprovalNode(onEvent, runId) {
  return async (state) => {
    // 这个节点本身只是个标记
    // 实际暂停由 interrupt_before 完成
    // resume 时会先设置 approval 状态，然后图继续执行此节点
    onEvent({
      type: "log",
      data: { message: `审批结果：${state.approval}` },
    });
    
    if (state.approval === "rejected") {
      onEvent({type: "run_failed", data: {error: "用户拒绝"}});
    }
    
    return {};  // 不修改 state
  };
}
```

**设计要点**：
- `approval_gate` 节点本身是空操作
- 暂停由 `interrupt_before` 在**进入节点前**触发
- `resume` 时传入 `{approval: "approved"}`，图继续执行 `approval_gate` 节点
- 节点内根据 `state.approval` 决定是否触发 `run_failed`

---

## 三、技术架构

### 3.1 文件结构

```
src/server/langchain/
└── checkpoint.ts                    # HITLWorkflowEngine + MemorySaver

src/app/api/langchain/graph/
├── start/route.ts                   # POST 启动 HITL 工作流
├── resume/route.ts                  # POST 断点续跑（SSE）
├── states/[threadId]/route.ts       # GET 状态历史
├── rollback/route.ts                # POST 时间旅行回滚
└── threads/route.ts                 # GET thread 列表
```

### 3.2 HITL 完整流程

```
┌──────────────────────────────────────────────────────────┐
│ 1. POST /api/langchain/graph/start                       │
│    body: {goal, workflowTemplateId}                      │
│    → 启动工作流，执行到 approval_gate 前暂停              │
│    → 返回 {threadId, status: "paused"}                   │
├──────────────────────────────────────────────────────────┤
│ 2. 前端展示审批请求，用户选择 approve/reject              │
├──────────────────────────────────────────────────────────┤
│ 3a. POST /api/langchain/graph/resume                     │
│     body: {threadId, decision: "approved"}               │
│     → 从 approval_gate 继续执行到 END                    │
│     → SSE 返回 run_completed                              │
├──────────────────────────────────────────────────────────┤
│ 3b. POST /api/langchain/graph/resume                     │
│     body: {threadId, decision: "rejected"}               │
│     → 触发 run_failed，工作流终止                         │
├──────────────────────────────────────────────────────────┤
│ 4. GET /api/langchain/graph/states/:threadId             │
│    → 返回所有 Checkpoint（时间旅行）                      │
├──────────────────────────────────────────────────────────┤
│ 5. POST /api/langchain/graph/rollback                    │
│    body: {threadId, checkpointId}                        │
│    → 从历史 Checkpoint 重新执行                           │
└──────────────────────────────────────────────────────────┘
```

### 3.3 State 扩展

M18 的 `AgentState` 基础上添加 `approval` 字段：
```typescript
const HitlState = Annotation.Root({
  ...AgentState,  // 继承 M18 的所有字段
  approval: Annotation<"pending" | "approved" | "rejected">,  // M19 新增
});
```

---

## 四、技术扩展

### 4.1 PostgresSaver —— 生产级持久化

`MemorySaver` 重启后丢失，生产环境用 `PostgresSaver`：
```typescript
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const checkpointer = PostgresSaver.fromConnString(
  process.env.DATABASE_URL!
);
await checkpointer.setup();  // 自动创建表

const app = graph.compile({checkpointer});
```

**对比自研**：项目已用 PostgreSQL + Drizzle ORM，可无缝集成。

### 4.2 多种审批策略

除 `interrupt_before` 外，LangGraph 还支持：
- `interrupt_after` —— 节点执行后暂停
- 动态中断 —— 节点内调用 `state.interrupt()` 主动暂停
- 多审批点 —— `interruptBefore: ["gate1", "gate2", "gate3"]`

### 4.3 并发 Thread

同一 checkpointer 可管理多个 thread：
```typescript
// 用户 A 的工作流
await app.invoke(stateA, {configurable: {thread_id: "user-A"}});

// 用户 B 的工作流（互不干扰）
await app.invoke(stateB, {configurable: {thread_id: "user-B"}});
```

### 4.4 Checkpoint 内容

每个 Checkpoint 包含：
- `values` —— 完整 state 快照
- `next` —— 下一个要执行的节点
- `config` —— `{thread_id, checkpoint_id}`
- `metadata` —— `{source, step, writes}`

可用于审计、调试、回放。

---

## 五、示例

### 5.1 HITL 完整流程

```bash
# 1. 启动 HITL 工作流
THREAD_ID=$(curl -X POST http://localhost:3000/api/langchain/graph/start \
  -H "Content-Type: application/json" \
  -d '{"goal":"分析 AI 趋势","workflowTemplateId":"research-analysis"}' \
  | jq -r '.threadId')

# 2. 查看状态历史
curl http://localhost:3000/api/langchain/graph/states/$THREAD_ID

# 3a. 通过审批
curl -X POST http://localhost:3000/api/langchain/graph/resume \
  -H "Content-Type: application/json" \
  -d "{\"threadId\":\"$THREAD_ID\",\"decision\":\"approved\"}"

# 3b. 或拒绝
curl -X POST http://localhost:3000/api/langchain/graph/resume \
  -H "Content-Type: application/json" \
  -d "{\"threadId\":\"$THREAD_ID\",\"decision\":\"rejected\"}"
```

### 5.2 时间旅行

```bash
# 1. 获取历史 Checkpoint
curl http://localhost:3000/api/langchain/graph/states/$THREAD_ID
# 返回：[{checkpointId: "ckpt-1", nextStep: ["stage_1"]}, ...]

# 2. 回滚到指定 Checkpoint
curl -X POST http://localhost:3000/api/langchain/graph/rollback \
  -H "Content-Type: application/json" \
  -d "{\"threadId\":\"$THREAD_ID\",\"checkpointId\":\"ckpt-1\"}"
```

### 5.3 Thread 管理

```bash
# 列出所有 thread
curl http://localhost:3000/api/langchain/graph/threads
```

---

## 六、验收结果

- `MemorySaver` 可正确保存和恢复状态
- `interrupt_before` 在 `approval_gate` 前自动暂停
- `resume` 可从暂停点继续执行（approve/reject）
- `getStateHistory` 返回所有 Checkpoint
- `rollback` 可从历史 Checkpoint 重新执行
- `pnpm run typecheck` 0 错误
- `pnpm run lint` 0 警告

## 七、关键学习点

1. **Checkpointer 是 HITL 的基础** —— 没有持久化，断点续跑无从谈起
2. **thread_id 是会话标识** —— 同一 thread 的多次 invoke 共享状态
3. **interrupt_before 是声明式暂停** —— 无需手写暂停逻辑，编译时指定
4. **节点是纯函数 + Checkpoint 自动保存** —— 每个节点后自动持久化
5. **时间旅行 = 历史快照 + 重新执行** —— `getStateHistory` + `rollback`
6. **MemorySaver 适合学习，PostgresSaver 适合生产** —— 接口一致，无缝切换

## 八、与自研的差距分析

| 能力 | 自研 | LangGraph | 差距 |
|------|------|-----------|------|
| 工具级 HITL | ✅ `requireConfirm` | ✅ `interrupt_before` | 持久化差距 |
| 工作流级 HITL | ❌ | ✅ | 自研缺失 |
| 状态持久化 | ❌ | ✅ MemorySaver | 自研缺失 |
| 断点续跑 | ❌ | ✅ `invoke(null, {thread_id})` | 自研缺失 |
| 时间旅行 | ❌ | ✅ `getStateHistory` + `rollback` | 自研缺失 |
| 状态审计 | ❌ | ✅ Checkpoint 完整快照 | 自研缺失 |

**结论**：LangGraph 的 HITL + Checkpoint 能力是工业级的，自研项目在这方面有明显差距。这正是引入 LangGraph 的核心价值。

---

## 九、两种 HITL 审批模式（补充）

LangGraph 实现支持两种审批级别，对比自研 `requireConfirm`。**关键设计点：使用「门节点（gate node）」而非直接在 Agent 节点上 interrupt_before**。

### 9.0 核心学习点：为什么用 gate 节点？

`interrupt_before` 在指定节点执行**前**暂停。如果直接 `interruptBefore: ["researcher"]`，会在 researcher 节点**执行前**就暂停——此时 Agent 还没产生任何输出，无从审批。

**正确做法**：在会使用工具的 Agent **之后**插入一个专门的 gate 节点，`interruptBefore` 作用在 gate 上：

```
researcher (执行完毕，输出已在 state.pendingToolCall 中)
    ↓
[tool_research_gate] ← interrupt_before 暂停点（此时能看到 agent 的输出和工具调用意图）
    ↓ 用户审批通过
analyst (继续执行)
```

gate 节点内部重置 `approval: "pending"`，以便后续其他 gate 也能触发中断——这是支持"多次暂停/恢复"的关键。

### 9.1 终稿审批模式（hitlMode: "final"）

- **interrupt_before**: `["approval_gate"]`
- **图拓扑**：
  ```
  START → planner → ...agents... → reviewer → [approval_gate *HITL*] → finalizer → END
  ```
- **流程**：所有 Agent 节点执行完毕 → 在 approval_gate 前暂停 → 用户审批终稿 → finalizer 汇总输出
- **对比自研**：自研无此机制（工作流一旦启动无法暂停看中间状态）
- **适用场景**：最终结果审核、重要决策确认

### 9.2 工具调用审批模式（hitlMode: "tool"）

- **interrupt_before（研究流）**: `["tool_research_gate", "approval_gate"]`
- **interrupt_before（代码流）**: `["tool_code_gate", "approval_gate"]`
- **图拓扑（研究流）**：
  ```
  START → planner → researcher → [tool_research_gate *HITL*] → analyst
       → writer → reviewer → [approval_gate *HITL*] → finalizer → END
  ```
- **流程**：
  1. researcher 完成后暂停在 tool_research_gate（展示 pendingToolCall 信息，由用户决定是否允许调用 web_search）
  2. 用户审批通过 → tool_research_gate 重置 approval 为 pending → 继续执行 analyst/writer/reviewer
  3. reviewer 结束后暂停在 approval_gate（终稿审批）
  4. 用户审批通过 → finalizer 输出终稿
- **支持多次暂停/恢复**：前端 resume SSE 处理 `hitl_paused` 事件，若 resume 后再次暂停（下一个 gate），会自动重新显示审批面板
- **对比自研**：对应 `Tool.requireConfirm`，但 LangGraph 版本支持 checkpoint 持久化、时间旅行、任意深度嵌套
- **适用场景**：敏感操作确认（发送邮件、写入数据库、调用付费 API）

### 9.3 前端交互

在 `/collaboration` 页面的顶部工具栏，LangGraph 模式下可看到 HITL 模式选择器：
- **无**：直接执行，不暂停
- **终稿审批**：执行完暂停在终稿前
- **工具审批**：工具类 Agent 完成后暂停审批，终稿前也暂停

暂停时右下角弹出审批面板：
- 工具审批模式下会展示「哪个 Agent 请求调用什么工具、输入内容预览」
- 终稿审批模式下提示审核最终结果
- 右侧栏 Checkpoint 时间线展示所有历史检查点，支持回滚

