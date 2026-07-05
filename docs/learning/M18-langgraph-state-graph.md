# M18: LangGraph 状态图 + 多智能体编排 —— 学习文档

> 里程碑：LangGraph StateGraph + 节点 + 边 + 多智能体编排
> 对比自研模块：`src/server/multi-agent/workflow-engine.ts`
> 学习目标：理解图编排模型 vs 命令式调度

---

## 一、需求思路

### 1.1 学习动机

自研已实现完整的多智能体协作系统：
- `WorkflowEngine`（class 形式，`execute()` 串行 stages）
- `PRESET_AGENTS`（8 个预置专家角色）
- `WORKFLOW_TEMPLATES`（3 种模板：研究分析/创意写作/代码开发）
- `MessageBus`（智能体间通信）
- SSE 事件协议（`run_started`/`stage_started`/`agent_started`/`agent_delta`/`agent_completed`/`stage_completed`/`run_completed`）

LangGraph 提供了更高级的图编排模型：
- `StateGraph` —— 状态图（显式 schema）
- `Annotation.Root` —— 状态定义
- `addNode` / `addEdge` / `addConditionalEdges` —— 图构建
- `compile()` —— 编译为可执行图
- 原生支持 checkpoint / HITL / 流式（M19 用）

### 1.2 核心对比

| 维度 | 自研 WorkflowEngine | LangGraph StateGraph |
|------|--------------------|---------------------|
| 状态管理 | class 私有字段 `this.run/steps` | `Annotation.Root` 显式 schema |
| 节点 | `executeStep()` 私有方法 | 纯函数 `(state) => Partial<state>` |
| 路由 | `for` 循环固定顺序 | `addEdge` / `addConditionalEdges` |
| 副作用 | 直接修改 `this.run.steps.push()` | 返回新状态，自动 merge |
| Checkpoint | 无 | `MemorySaver` / `PostgresSaver` |
| HITL | 无原生支持 | `interrupt_before` 原生支持 |
| 可视化 | 无 | `graph.draw()` 输出图结构 |

---

## 二、代码思路

### 2.1 State 定义 —— 图的核心

**LangGraph 的 State 设计**：
```typescript
const AgentState = Annotation.Root({
  goal: Annotation<string>,           // 全局目标（不变）
  template: Annotation<WorkflowTemplate>,  // 工作流模板
  currentStage: Annotation<number>,   // 当前阶段索引
  stageOutputs: Annotation<Record<number, string>>,  // 各阶段产出
  steps: Annotation<MaStep[]>,        // 步骤详情
  finalAnswer: Annotation<string>,    // 最终答案
  error: Annotation<string | null>,   // 错误信息
  runId: Annotation<string>,          // 运行 ID
});
```

**关键概念**：
- `Annotation.Root({...})` 定义状态 schema
- 每个字段默认是「覆盖」语义（后写覆盖前写）
- 可通过 `Annotation<T>({ reducer: customReducer })` 自定义合并逻辑
- 节点返回 `Partial<State>`，框架自动 merge

**对比自研**：`WorkflowEngine` 用 `private run: MaRun` 维护所有状态，节点函数直接 `this.run.steps.push()`，副作用式更新。

### 2.2 节点函数 —— 纯函数

**LangGraph 节点签名**：
```typescript
type Node = (state: State) => Promise<Partial<State>>;

// 示例：Stage 节点
function createStageNode(stageIndex, stage, onEvent, runId): Node {
  return async (state) => {
    onEvent({type: "stage_started", ...});
    
    // 并行执行 stage 内所有 tasks
    const results = await Promise.all(
      stage.tasks.map(task => executeTask(task, state))
    );
    
    // 返回新状态（不修改原 state）
    return {
      currentStage: stageIndex + 1,
      stageOutputs: {...state.stageOutputs, [stageIndex]: stageOutput},
      steps: [...state.steps, ...newSteps],
    };
  };
}
```

**核心差异**：
- 自研：`executeStep(stepIdx)` 直接修改 `this.run.steps[stepIdx].status = "running"`
- LangGraph：节点返回 `Partial<State>`，框架自动 merge，无副作用

### 2.3 图构建 —— addNode + addEdge

```typescript
const graph = new StateGraph(AgentState);

// 1. 添加节点
template.stages.forEach((stage, idx) => {
  graph.addNode(`stage_${idx}`, createStageNode(idx, stage, onEvent, runId));
});
graph.addNode("finalizer", createFinalizerNode(onEvent, runId));

// 2. 添加边（顺序连接）
graph.addEdge(START, "stage_0");
for (let i = 0; i < stages.length - 1; i++) {
  graph.addEdge(`stage_${i}`, `stage_${i + 1}`);
}
graph.addEdge(`stage_${last}`, "finalizer");
graph.addEdge("finalizer", END);

// 3. 编译
const app = graph.compile();
```

**对比自研**：
```typescript
// 自研：for 循环串行执行
for (let sIdx = 0; sIdx < stages.length; sIdx++) {
  const stage = stages[sIdx];
  await Promise.all(stage.tasks.map(task => executeStep(task)));
}
```

LangGraph 的图结构是**声明式**的，自研是**命令式**的。图结构的好处：
1. 可视化（`graph.draw()`）
2. 可分析（拓扑排序、循环检测）
3. 可扩展（条件边、并行分支）

### 2.4 条件路由 —— addConditionalEdges

LangGraph 支持条件边（自研没有）：
```typescript
graph.addConditionalEdges("reviewer", (state) => {
  if (state.approval === "approved") return "finalizer";
  if (state.approval === "needs_revision") return "writer";  // 回环
  return "END";
});
```

这实现了**循环工作流**（如 writer → reviewer → writer 修订循环），自研的 for 循环无法表达。

### 2.5 SSE 事件适配

LangGraph 的图执行映射为现有 SSE 协议：

| LangGraph 阶段 | SSE 事件 |
|---------------|---------|
| `app.invoke()` 开始 | `run_started` |
| 节点函数开始 | `stage_started` |
| 节点内 task 开始 | `agent_started` |
| 流式输出 | `agent_delta` |
| 节点内 task 完成 | `agent_completed` |
| 节点完成 | `stage_completed` |
| 图执行完成 | `run_completed` |

**适配策略**：在节点函数内部手动 `onEvent()`，与自研 `WorkflowEngine` 完全兼容。前端 `/collaboration` 页面无需修改即可消费。

### 2.6 双引擎切换

`/api/multi-agent/run` 新增 `engine` 参数：
```typescript
const RunSchema = z.object({
  goal: z.string(),
  workflowTemplateId: z.string().optional(),
  engine: z.enum(["builtin", "langgraph"]).optional(),  // M18 新增
});

if (engineKind === "langgraph") {
  const engine = new LangGraphEngine({goal, workflowTemplateId, onEvent});
  await engine.execute();
} else {
  const engine = new WorkflowEngine({goal, workflowTemplateId, onEvent});
  await engine.execute();
}
```

前端 collaboration 页面添加切换开关，同一 UI 消费两种引擎的 SSE 事件。

---

## 三、技术架构

### 3.1 文件结构

```
src/server/langchain/
└── graph.ts                         # LangGraphEngine + StateGraph

src/app/api/langchain/graph/
└── run/route.ts                     # LangGraph 执行 SSE 端点

src/app/api/multi-agent/run/route.ts # 修改：支持 engine 参数
src/app/collaboration/page.tsx       # 修改：添加引擎切换开关
```

### 3.2 图结构可视化

研究分析流（5 个 stage）：
```
START → stage_0(规划) → stage_1(研究) → stage_2(分析) → stage_3(写作) → stage_4(评审) → finalizer → END
```

创意写作流（5 个 stage）：
```
START → stage_0(规划) → stage_1(创意) → stage_2(写作) → stage_3(评审) → stage_4(润色) → finalizer → END
```

### 3.3 State 流转

```
initialState: {goal, template, currentStage:0, stageOutputs:{}, steps:[], finalAnswer:""}
    ↓ stage_0 执行
state: {currentStage:1, stageOutputs:{0:"..."}, steps:[step0]}
    ↓ stage_1 执行
state: {currentStage:2, stageOutputs:{0:"...",1:"..."}, steps:[step0,step1]}
    ↓ ...
finalizer: 提取 finalAnswer
END
```

---

## 四、技术扩展

### 4.1 并行分支

LangGraph 支持并行节点（自研用 `Promise.all` 在节点内实现）：
```typescript
// 节点级并行
graph.addEdge("planner", "researcher");
graph.addEdge("planner", "analyst");  // researcher 和 analyst 并行
graph.addEdge("researcher", "writer");
graph.addEdge("analyst", "writer");   // writer 等待两者完成
```

### 4.2 Subgraph —— 图嵌套

```typescript
const subgraph = new StateGraph(SubState)
  .addNode("research", researchNode)
  .addNode("analyze", analyzeNode)
  .compile();

const mainGraph = new StateGraph(MainState)
  .addNode("research_phase", subgraph)  // 嵌套子图
  .addNode("write", writeNode)
  .compile();
```

### 4.3 StreamEvents API

LangGraph 原生支持流式事件（优于自研手写 SSE）：
```typescript
const stream = app.streamEvents(initialState, {version: "v2"});
for await (const event of stream) {
  // event.type: "on_chain_start" | "on_chain_end" | "on_llm_stream" | ...
  console.log(event);
}
```

### 4.4 可视化图结构

```typescript
import { MermaidGraph } from "@langchain/langgraph";

const graph = buildWorkflowGraph(template, () => {}, "run1");
const mermaid = MermaidGraph.draw(graph);
// 输出 Mermaid 语法，可渲染为图片
```

---

## 五、示例

### 5.1 LangGraph 执行

```bash
curl -X POST http://localhost:3000/api/langchain/graph/run \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "分析 2024 年 AI Agent 发展趋势",
    "workflowTemplateId": "research-analysis"
  }'
```

### 5.2 双引擎切换

访问 `/collaboration` 页面：
1. 顶部工具栏出现「自研 / LangGraph」切换按钮
2. 选择 LangGraph，输入目标，点击「开始运行」
3. SSE 事件与自研引擎完全兼容，可视化无差异

### 5.3 学习要点

| 概念 | 自研对应 | LangGraph 优势 |
|------|---------|---------------|
| State schema | `MaRun` interface | `Annotation.Root` 显式 + reducer |
| Node 纯函数 | `executeStep()` 方法 | 无副作用，可测试 |
| Edge 路由 | `for` 循环 | 声明式 + 条件边 |
| 并行 | `Promise.all` | `addEdge` 多目标自动并行 |
| 循环 | 不支持 | `addConditionalEdges` 回环 |
| 可视化 | 无 | Mermaid 图 |

---

## 六、验收结果

- LangGraph 可执行 3 种工作流模板
- SSE 事件与现有前端可视化完全兼容
- 引擎切换开关可正常工作（自研 ↔ LangGraph）
- `pnpm run typecheck` 0 错误
- `pnpm run lint` 0 警告

## 七、关键学习点

1. **State 是图的核心** —— `Annotation.Root` 显式定义，优于隐式 class 字段
2. **节点是纯函数** —— `(state) => Partial<state>`，无副作用，可测试
3. **边是声明式路由** —— `addEdge` / `addConditionalEdges`，支持条件分支和回环
4. **图可编译** —— `compile()` 生成可执行 app，支持 checkpoint/HITL/流式
5. **SSE 适配** —— 通过在节点内 `onEvent()`，实现与自研完全兼容的事件协议
