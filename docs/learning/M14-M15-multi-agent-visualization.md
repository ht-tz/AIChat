# M14 多智能体协作增强 + M15 过程可视化

## 基本信息

- **里程碑**：M14 + M15
- **标题**：多智能体协作增强 + 过程可视化
- **完成日期**：2026-07-03
- **作者**：AI Agent Team
- **状态**：✅ 已完成

## 1. 需求思路

### 1.1 为什么需要多智能体协作

单 Agent 系统在处理复杂任务时存在明显局限：

1. **能力单一**：一个 Agent 难以同时擅长规划、研究、编码、测试等多种技能
2. **注意力有限**：长任务中 Agent 容易遗忘早期细节或偏离目标
3. **质量难以保证**：没有评审机制，输出质量波动大
4. **效率低下**：串行处理，无法并行执行独立子任务
5. **过程不透明**：用户只能看到最终结果，不知道中间发生了什么

多智能体协作系统通过「专家分工 + 流水线协作」的模式，让不同专长的 Agent 各司其职，共同完成复杂任务。

### 1.2 为什么需要过程可视化

多智能体协作过程复杂，如果没有可视化，用户会：

1. **缺乏掌控感**：不知道当前执行到哪一步、哪个 Agent 在工作
2. **无法干预**：出了问题不知道在哪，也无法及时调整
3. **信任度低**：看不到过程，难以信任最终结果
4. **学习成本高**：无法理解 Agent 是如何协作的

过程可视化通过工作流图、进度面板、时间线、消息气泡等方式，让整个协作过程透明可追溯。

### 1.3 整体思路

- **8 个预置 Agent 角色**：覆盖规划、研究、分析、创意、编码、测试、写作、评审全流程
- **3 种工作流模板**：研究分析流、创意写作流、代码开发流，适应不同任务类型
- **阶段串行 + 阶段内并行**：保证依赖顺序的同时最大化并行效率
- **消息总线**：Agent 间通过发布/订阅模式传递上下文
- **SSE 事件流**：实时推送执行状态，驱动前端可视化更新
- **三栏布局工作台**：工作流图 + 消息气泡 + 时间线，全方位展示协作过程

## 2. 技术架构

### 2.1 系统分层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端 (Next.js Client)                     │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  collaboration/  │  │  stores/ma.ts    │  │  components/  │  │
│  │  page.tsx        │  │  (Zustand状态)   │  │  multi-agent/ │  │
│  │  - 三栏布局      │◄─►│  - run/steps    │◄─►│  - workflow-  │  │
│  │  - SSE 事件处理  │  │    /progress     │  │    graph.tsx  │  │
│  │  - 目标输入      │  │  - 状态更新方法  │  │  - progress-   │  │
│  │  - 团队选择      │  │                  │  │    panel.tsx  │  │
│  └────────┬─────────┘  └──────────────────┘  │  - step-      │  │
│           │                                   │    timeline.tsx│  │
└───────────┼───────────────────────────────────┴───────────────┘
            │ SSE (text/event-stream)
┌───────────▼─────────────────────────────────────────────────────┐
│                     API 路由层 (Next.js Route)                    │
│                                                                 │
│  GET  /api/multi-agent/teams       —— 团队/模板列表              │
│  POST /api/multi-agent/run         —— 启动运行 (SSE 流式)       │
│  GET  /api/multi-agent/runs        —— 历史运行列表              │
│  GET  /api/multi-agent/runs/[id]   —— 运行详情                  │
└───────────┬─────────────────────────────────────────────────────┘
            │
┌───────────▼─────────────────────────────────────────────────────┐
│                    服务层 (Server Multi-Agent)                    │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ WorkflowEngine   │  │  MessageBus      │  │  PRESET_      │  │
│  │ - execute()      │  │ - publish()      │  │    AGENTS     │  │
│  │ - executeStep()  │  │ - subscribe()    │  │  (8个角色)    │  │
│  │ - 阶段串行       │  │ - getByStage()   │  │               │  │
│  │ - 阶段内并行     │  │ - getResults()   │  └───────────────┘  │
│  │ - SSE 事件发射   │  └──────────────────┘                     │
│  └──────────────────┘                                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  WORKFLOW_TEMPLATES (3种模板)                             │   │
│  │  - 研究分析流 (5阶段: 规划→研究→分析→写作→评审)           │   │
│  │  - 创意写作流 (5阶段: 规划→创意→写作→评审→润色)           │   │
│  │  - 代码开发流 (5阶段: 规划→编码→测试→评审→文档)           │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────┬─────────────────────────────────────────────────────┘
            │
┌───────────▼─────────────────────────────────────────────────────┐
│                      数据层 (Database)                            │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │
│  │ maTeams  │  │  maRuns  │  │ maSteps  │                       │
│  │ (团队配置)│  │ (运行记录)│  │ (步骤明细)│                       │
│  └──────────┘  └──────────┘  └──────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流图（从启动到完成）

```
用户输入目标 + 选择团队模板
        │
        ▼
  POST /api/multi-agent/run
        │
        ▼
  WorkflowEngine.constructor
  ├─ 加载工作流模板
  ├─ 生成所有 steps (pending 状态)
  ├─ 初始化 MessageBus
  └─ 返回 runId
        │
        ▼
  WorkflowEngine.execute()
  ├─ emit: run_started
  │
  ├─ 循环每个 Stage (串行)
  │   ├─ emit: stage_started
  │   ├─ buildStageContext(前序阶段输出)
  │   ├─ Promise.all 所有 Task (并行)
  │   │   └─ 每个 executeStep()
  │   │       ├─ emit: agent_started
  │   │       ├─ 调用 LLM Provider
  │   │       ├─ 循环 emit: agent_delta (打字机效果)
  │   │       └─ emit: agent_completed
  │   ├─ 汇总阶段结果发布到 MessageBus
  │   └─ emit: stage_completed
  │
  ├─ buildFinalAnswer()
  └─ emit: run_completed / run_failed
        │
        ▼
  SSE 事件流推送到前端
        │
        ▼
  前端 stores/ma.ts 更新状态
        │
        ▼
  三大可视化组件联动渲染：
  - WorkflowGraph (节点状态变化)
  - ProgressPanel (进度条 + 计时器)
  - StepTimeline (时间线 + 输出展开)
  - AgentMessages (聊天式消息气泡)
```

### 2.3 SSE 事件协议

后端通过 Server-Sent Events 向前端推送事件，事件类型如下：

| 事件类型 | 触发时机 | 主要数据 |
|---------|---------|---------|
| `run_started` | 运行开始时 | runId, goal, totalStages, totalSteps, stages |
| `stage_started` | 阶段开始时 | stageIndex, stageName, stageDescription |
| `agent_started` | Agent 开始执行时 | stepId, stageIndex, stepIndex, agentRole, agentName |
| `agent_delta` | Agent 输出过程中（流式） | stepId, delta |
| `agent_completed` | Agent 执行完成时 | stepId, status, output, error, durationMs |
| `stage_completed` | 阶段完成时 | stageIndex, stageName, completedSteps, totalStepsInStage |
| `run_completed` | 运行成功完成时 | status, finalAnswer, durationMs, completedSteps |
| `run_failed` | 运行失败时 | error |
| `log` | 日志信息 | message |

事件格式（符合 SSE 标准）：
```
event: agent_delta
data: {"type":"agent_delta","runId":"xxx","timestamp":1234567890,"data":{"stepId":"abc","delta":"Hello"}}

```

## 3. 核心代码解读

### 3.1 WorkflowEngine — 工作流引擎核心

**文件**：`src/server/multi-agent/workflow-engine.ts`

`WorkflowEngine` 是整个多智能体系统的大脑，负责任务调度、Agent 执行、上下文管理和事件发射。

#### constructor() — 初始化运行

```typescript
constructor(options: WorkflowEngineOptions) {
  // 1. 确定阶段配置（自定义 > 模板 > 默认）
  let stages: WorkflowStage[];
  if (options.customStages?.length) {
    stages = options.customStages;
  } else if (options.workflowTemplateId) {
    stages = getWorkflowTemplate(options.workflowTemplateId)?.stages
      || WORKFLOW_TEMPLATES[0].stages;
  } else {
    stages = WORKFLOW_TEMPLATES[0].stages;
  }

  // 2. 生成所有步骤（展平 stages → steps）
  const steps: MaStep[] = [];
  stages.forEach((stage, sIdx) => {
    stage.tasks.forEach((task, tIdx) => {
      const agent = getAgentByRole(task.assignee);
      steps.push({
        id: nanoid(8),
        stageIndex: sIdx,
        stepIndex: tIdx,
        agentRole: task.assignee,
        agentName: agent?.name || task.assignee,
        status: "pending",
        input: task.description,
      });
    });
  });

  // 3. 初始化运行对象
  this.run = {
    id: nanoid(12),
    goal: options.goal,
    status: "pending",
    totalStages: stages.length,
    totalSteps: steps.length,
    stages,
    steps,
    createdAt: Date.now(),
  };

  this.bus = new MessageBus();
  this.onEvent = options.onEvent;
}
```

**设计要点**：
- **三级降级**：自定义阶段 → 指定模板 → 默认模板，确保总能运行
- **步骤预生成**：constructor 里就把所有 step 创建好，前端可以立即展示完整工作流图
- **nanoid 生成 ID**：runId 12 位，stepId 8 位，兼顾唯一性和长度

#### execute() — 主执行循环

```typescript
async execute(): Promise<MaRun> {
  this.run.status = "running";
  this.run.startedAt = Date.now();
  this.emit({ type: "run_started", ... });

  try {
    // 阶段串行执行
    for (let sIdx = 0; sIdx < this.run.stages.length; sIdx++) {
      if (this.cancelled) break;

      const stage = this.run.stages[sIdx];
      this.emit({ type: "stage_started", ... });

      // 阶段内并行执行
      const stageStepIndices = this.run.steps
        .filter(s => s.stageIndex === sIdx)
        .map(s => this.run.steps.indexOf(s));

      const context = this.buildStageContext(sIdx);
      const taskPromises = stageStepIndices.map(
        stepIdx => this.executeStep(stepIdx, context)
      );
      await Promise.all(taskPromises);  // 并行！

      this.run.completedStages = sIdx + 1;

      // 汇总阶段结果到消息总线
      const stageSteps = this.run.steps.filter(s => s.stageIndex === sIdx);
      for (const step of stageSteps) {
        if (step.output && step.status === "completed") {
          this.bus.publish({
            from: step.agentRole,
            type: "result",
            content: step.output,
            stageIndex: sIdx,
          });
        }
      }

      this.emit({ type: "stage_completed", ... });
    }

    if (this.run.status === "running") {
      this.run.status = "completed";
      this.run.finalAnswer = this.buildFinalAnswer();
    }
  } catch (err) {
    this.run.status = "failed";
    this.run.error = err instanceof Error ? err.message : String(err);
  }

  this.run.completedAt = Date.now();
  this.run.durationMs = this.run.startedAt
    ? this.run.completedAt - this.run.startedAt : 0;

  this.emit({
    type: this.run.status === "failed" ? "run_failed" : "run_completed",
    ...
  });

  return this.run;
}
```

**核心设计模式**：

| 模式 | 说明 |
|------|------|
| **阶段串行** | Stage 1 → Stage 2 → Stage 3... 保证依赖顺序，前一阶段输出作为后一阶段输入 |
| **阶段内并行** | 同一 Stage 内的多个 Agent 通过 `Promise.all` 并发执行，提升效率 |
| **事件驱动** | 每个状态变化都 emit 事件，前端通过 SSE 实时接收更新 |
| **取消机制** | `cancelled` 标志位支持中途取消（阶段间检查 + delta 循环检查） |
| **错误隔离** | 单个 Agent 失败不影响整体（executeStep 内 try-catch），但整体异常会终止运行 |

#### executeStep() — 单个 Agent 执行

```typescript
private async executeStep(stepIdx: number, context: string): Promise<void> {
  const step = this.run.steps[stepIdx];
  const agent = getAgentByRole(step.agentRole);

  if (!agent) {
    step.status = "failed";
    step.error = `未知 Agent 角色: ${step.agentRole}`;
    return;
  }

  step.status = "running";
  step.startedAt = Date.now();
  this.emit({ type: "agent_started", ... });

  try {
    // 构建用户消息：全局目标 + 当前任务 + 上下文
    const userMessage = context
      ? `【全局目标】${this.run.goal}\n\n【当前任务】${step.input}\n\n【上下文信息】\n${context}`
      : `【全局目标】${this.run.goal}\n\n【当前任务】${step.input}`;

    // 调用 LLM
    const result = await getProvider().complete({
      messages: [
        { role: "system", content: agent.systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: agent.temperature,
    });

    step.output = result.content;
    step.status = "completed";
    step.completedAt = Date.now();
    step.durationMs = step.startedAt ? step.completedAt - step.startedAt : 0;

    // 模拟流式 delta 事件（提升可视化效果）
    const chunks = this.splitIntoChunks(result.content, 15);
    for (const chunk of chunks) {
      if (this.cancelled) break;
      this.emit({
        type: "agent_delta",
        data: { stepId: step.id, delta: chunk },
      });
      await new Promise(r => setTimeout(r, 20));  // 每片 20ms
    }

    this.emit({ type: "agent_completed", ... });
    this.run.completedSteps += 1;
  } catch (err) {
    step.status = "failed";
    step.error = err instanceof Error ? err.message : String(err);
    this.emit({ type: "agent_completed", data: { status: "failed", ... } });
  }
}
```

**关键设计**：

1. **上下文注入**：
   - 第一阶段没有上下文
   - 后续阶段通过 `buildStageContext()` 注入前序阶段的所有输出
   - 消息结构：`【全局目标】+【当前任务】+【上下文信息】`

2. **流式 delta 模拟**：
   - 先完整获取 LLM 输出（简化实现）
   - 然后按 15 字符切分，每 20ms 推送一片
   - 目的：提升前端可视化效果，让用户看到「打字机」效果
   - 生产优化：可改为真正的流式调用

3. **错误处理**：
   - Step 级别 try-catch：单个 Agent 失败不会终止整个工作流
   - 失败的 step 会标记 status = "failed" 并记录 error
   - 前端会用红色显示失败状态

#### buildStageContext() — 构建阶段上下文

```typescript
private buildStageContext(currentStageIndex: number): string {
  if (currentStageIndex === 0) return "";  // 第一阶段无上下文

  const prevSteps = this.run.steps.filter(
    s => s.stageIndex < currentStageIndex && s.status === "completed"
  );
  if (prevSteps.length === 0) return "";

  return prevSteps
    .map(s => `【${s.agentName}】(${Math.round((s.durationMs||0)/1000)}s)\n${(s.output||"").slice(0, 500)}${(s.output||"").length > 500 ? "..." : ""}`)
    .join("\n\n");
}
```

**设计考量**：
- **截断机制**：每个 Agent 输出最多取 500 字符，避免上下文爆炸
- **元信息**：包含 Agent 名称和耗时，帮助后续 Agent 理解来源
- **按需构建**：只包含已完成的步骤，未完成/失败的不注入

#### buildFinalAnswer() — 汇总最终输出

```typescript
private buildFinalAnswer(): string {
  const completedSteps = this.run.steps.filter(s => s.status === "completed");
  if (completedSteps.length === 0) return "";

  // 优先取最后一个 writer/coder 的输出
  const writerStep = [...completedSteps].reverse().find(
    s => s.agentRole === "writer" || s.agentRole === "coder"
  );
  if (writerStep?.output) return writerStep.output;

  // 否则汇总所有输出
  return completedSteps
    .map(s => `## ${s.agentName}\n\n${s.output}`)
    .join("\n\n---\n\n");
}
```

**策略**：
1. **智能选择**：优先取最后一个「写作/编码」专家的输出作为最终答案
2. **降级汇总**：如果没有这类角色，就把所有完成步骤的输出拼起来
3. **为什么反向查找**：越靠后的阶段输出越接近最终成果

### 3.2 MessageBus — Agent 间消息总线

**文件**：`src/server/multi-agent/message-bus.ts`

```typescript
export class MessageBus {
  private messages: BusMessage[] = [];
  private listeners: Set<(msg: BusMessage) => void> = new Set();

  publish(msg: Omit<BusMessage, "id" | "timestamp">): void {
    const fullMsg: BusMessage = {
      ...msg,
      id: Math.random().toString(36).slice(2, 10),
      timestamp: Date.now(),
    };
    this.messages.push(fullMsg);
    for (const listener of this.listeners) {
      try {
        listener(fullMsg);
      } catch {
        // 监听器错误不影响发布者
      }
    }
  }

  subscribe(listener: (msg: BusMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getByStage(stageIndex: number): BusMessage[] {
    return this.messages.filter(m => m.stageIndex === stageIndex);
  }

  getResults(): BusMessage[] {
    return this.messages.filter(m => m.type === "result");
  }
}
```

**设计模式**：发布-订阅模式（Pub/Sub）

| 方法 | 用途 |
|------|------|
| `publish()` | 发布消息，自动附加 id 和 timestamp |
| `subscribe()` | 订阅消息，返回取消订阅函数 |
| `getByStage()` | 按阶段查询历史消息 |
| `getResults()` | 查询所有结果类消息 |

**消息类型**：
- `info` — 普通信息
- `result` — 执行结果
- `question` — 问题（Agent 间求助）
- `error` — 错误通知
- `status` — 状态更新

### 3.3 PRESET_AGENTS — 8 个预置 Agent

**文件**：`src/server/multi-agent/agents.ts`

| 角色 | 名称 | 温度 | 工具 | 颜色 | 图标 | 定位 |
|------|------|------|------|------|------|------|
| `planner` | 规划专家 | 0.3 | - | 青色 | 📋 | 任务拆解、计划制定 |
| `researcher` | 研究专家 | 0.5 | web_search, read_file | 紫色 | 🔍 | 信息收集、文献调研 |
| `analyst` | 分析专家 | 0.4 | calculator, code_runner | 蓝绿 | 📊 | 数据分析、洞察提取 |
| `creative` | 创意专家 | 0.9 | - | 粉色 | 💡 | 头脑风暴、创意构思 |
| `coder` | 编码专家 | 0.2 | code_runner, read_file | 绿色 | 💻 | 代码开发、功能实现 |
| `tester` | 测试专家 | 0.3 | code_runner, calculator | 黄色 | 🧪 | 质量保证、Bug 发现 |
| `writer` | 写作专家 | 0.6 | summarize_report | 蓝色 | ✍️ | 报告撰写、内容整合 |
| `reviewer` | 评审专家 | 0.2 | - | 红色 | 🔍 | 质量把关、改进建议 |

**温度设计原则**：
- 创造性工作（creative）→ 高温度（0.9）→ 发散性思维
- 严谨性工作（coder/reviewer/planner）→ 低温度（0.2-0.3）→ 稳定输出
- 平衡型工作（researcher/writer）→ 中温度（0.5-0.6）→ 兼顾创意和准确

### 3.4 WORKFLOW_TEMPLATES — 3 种工作流模板

**文件**：`src/server/multi-agent/workflow-templates.ts`

| 模板 | 类型 | 阶段数 | 适用场景 |
|------|------|--------|---------|
| 研究分析流 | `research` | 5 | 市场调研、数据分析、学术研究 |
| 创意写作流 | `creative` | 5 | 文案撰写、内容创作、故事编写 |
| 代码开发流 | `code` | 5 | 功能开发、Bug 修复、技术方案 |

**研究分析流阶段**：
```
规划阶段 → 研究阶段 → 分析阶段 → 输出阶段 → 评审阶段
(planner)  (researcher) (analyst)   (writer)   (reviewer)
```

**创意写作流阶段**：
```
规划阶段 → 创意阶段 → 写作阶段 → 评审阶段 → 润色阶段
(planner)  (creative)  (writer)   (reviewer)  (writer)
```

**代码开发流阶段**：
```
规划阶段 → 编码阶段 → 测试阶段 → 评审阶段 → 文档阶段
(planner)  (coder)   (tester)  (reviewer)  (writer)
```

### 3.5 SSE API 路由

**文件**：`src/app/api/multi-agent/run/route.ts`

```typescript
export async function POST(req: NextRequest) {
  const body = RunSchema.parse(await req.json());
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: MaEvent) => {
        const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      try {
        const engine = new WorkflowEngine({
          goal: body.goal,
          workflowTemplateId: body.workflowTemplateId,
          customStages: body.customStages,
          onEvent: sendEvent,   // 事件直接推送到 SSE 流
        });

        await engine.execute();
        const finalRun = engine.getRun();
        storeRun(finalRun);
      } catch (err) {
        // 错误也通过 SSE 推送
        controller.enqueue(encoder.encode(
          `event: run_failed\ndata: ${JSON.stringify({ error: msg, ... })}\n\n`
        ));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

**关键实现**：
- **POST + ReadableStream**：原生 SSE 只支持 GET，这里用 POST + 手动 ReadableStream 实现，支持请求体
- **onEvent 桥接**：WorkflowEngine 的事件通过 `sendEvent` 直接写入 SSE 流
- **运行持久化**：执行完成后调用 `storeRun()` 保存运行记录
- **错误兜底**：engine.execute() 外的 try-catch 确保即使崩溃也能推送失败事件

### 3.6 前端 SSE 解析（fetch + ReadableStream）

**文件**：`src/app/collaboration/page.tsx`

```typescript
const response = await fetch("/api/multi-agent/run", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ goal: goal.trim(), workflowTemplateId: selectedTeamId }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

const read = async () => {
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // 按 SSE 事件分割（\n\n）
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";  // 保留不完整的事件

    for (const eventStr of events) {
      const lines = eventStr.split("\n");
      let eventType = "";
      let dataStr = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) eventType = line;
        else if (line.startsWith("data: ")) dataStr = line.replace("data: ", "");
      }
      processEvent(eventType, dataStr);
    }
  }
};
```

**为什么不用 EventSource？**
- EventSource 只支持 GET 请求，无法传复杂的 JSON body
- fetch + ReadableStream 更灵活，支持 POST、自定义 headers
- 需要手动解析 SSE 格式（按 `\n\n` 分割事件）

### 3.7 前端状态管理（Zustand）

**文件**：`src/stores/ma.ts`

状态机设计：

```
idle → running → completed
            ↘  failed
            ↘  cancelled
```

**核心 action 与 SSE 事件映射**：

| SSE 事件 | Store Action | 状态变化 |
|---------|-------------|---------|
| `run_started` | `initRun()` | idle → running，初始化 steps |
| `stage_started` | `setStageStarted()` | 更新 currentStageIndex |
| `agent_started` | `setAgentStarted()` | step: pending → running |
| `agent_delta` | `setAgentDelta()` | step.output += delta |
| `agent_completed` | `setAgentCompleted()` | step: running → completed/failed |
| `stage_completed` | `setStageCompleted()` | currentStageIndex++ |
| `run_completed` | `setRunCompleted()` | running → completed |
| `run_failed` | `setRunFailed()` | running → failed |

**Step ID 映射问题**：
- 后端在 constructor 里生成 stepId（nanoid）
- 前端在 initRun 里也生成 stepId（stageIndex-stepIndex）
- 通过 `stageIndex + stepIndex` 的组合键建立映射
- delta 事件用「当前 running 的 step」简化匹配（同一时间只有一个 Agent 在打字？不，阶段内是并行的！这里是简化实现）

> ⚠️ **注意**：当前实现中，阶段内并行执行时，`agent_delta` 事件是通过「找到当前 running 的 step」来匹配的。如果同一阶段有多个并行 Agent，delta 可能会错乱。生产环境应该在 delta 事件里携带 stepId，前端直接匹配。

## 4. 前端可视化组件设计

### 4.1 三栏布局

```
┌─────────────────────────────────────────────────────────┐
│  顶部工具栏：团队选择 + 目标输入 + 开始/停止按钮          │
├──────────────┬──────────────────────┬───────────────────┤
│  左栏         │   中栏                │   右栏            │
│  (320px)     │   (flex-1)           │   (384px)         │
│              │                      │                   │
│  执行进度     │   Agent 消息气泡      │   执行时间线       │
│  ProgressPanel│   AgentMessages      │   StepTimeline    │
│              │   (聊天式布局)        │   (可展开)        │
│  工作流图     │                      │                   │
│  WorkflowGraph│                      │                   │
│  (SVG节点图)  │                      │                   │
└──────────────┴──────────────────────┴───────────────────┘
```

### 4.2 WorkflowGraph — 工作流图

**实现要点**：
- SVG 绘制阶段节点和 Agent 节点
- 竖线连接阶段，横线连接 Agent
- 4 种状态样式：pending（灰色）、running（脉冲动画）、completed（绿色）、failed（红色）
- 霓虹发光动画：running 状态用 `box-shadow` + `animation` 实现呼吸效果
- 点击节点可跳转查看详情

### 4.3 ProgressPanel — 进度面板

**组成**：
- **状态徽章**：当前运行状态（idle/running/completed/failed）
- **运行计时器**：已运行时间（秒表式更新）
- **总进度条**：completedSteps / totalSteps
- **阶段进度条**：当前阶段内完成度
- **错误信息**：失败时显示错误详情

### 4.4 StepTimeline — 步骤时间线

**设计**：
- 时间线竖线贯穿所有步骤
- 每个步骤一个时间节点（圆点图标）
- 状态图标颜色区分：pending(灰) / running(黄) / completed(绿) / failed(红)
- 点击可展开/收起输出内容
- 显示 Agent 名称、耗时、状态

### 4.5 AgentMessages — 消息气泡

**聊天式布局**：
- Agent 头像（彩色边框 + 图标）
- Agent 名称 + 阶段标签
- 消息气泡（半透明背景 + 边框颜色对应 Agent 颜色）
- 打字机光标：running 状态显示闪烁光标
- 最终答案卡片：completed 时显示绿色边框的总结卡片

## 5. 数据库设计

**文件**：`src/server/db/schema.ts`

### 5.1 三表结构

```
maTeams (团队配置)
  └─ maRuns (运行记录)
       └─ maSteps (步骤明细)
```

### 5.2 maTeams 表 — 团队配置

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| name | varchar(128) | 团队名称 |
| description | text | 描述 |
| teamType | enum | research/creative/code/custom |
| agents | jsonb | Agent 配置数组 |
| workflow | jsonb | 工作流阶段配置 |
| userId | uuid | 创建用户（可选） |

### 5.3 maRuns 表 — 运行记录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| teamId | uuid | 关联团队 |
| goal | text | 运行目标 |
| status | enum | pending/running/completed/failed/cancelled |
| totalStages | integer | 总阶段数 |
| completedStages | integer | 已完成阶段数 |
| totalSteps | integer | 总步骤数 |
| completedSteps | integer | 已完成步骤数 |
| finalAnswer | text | 最终输出 |
| error | text | 错误信息 |
| durationMs | integer | 总耗时（毫秒） |
| startedAt | timestamp | 开始时间 |
| completedAt | timestamp | 结束时间 |

### 5.4 maSteps 表 — 步骤明细

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| runId | uuid | 关联运行（外键 cascade） |
| stageIndex | integer | 阶段索引 |
| stepIndex | integer | 步骤索引 |
| agentRole | varchar(64) | Agent 角色 |
| agentName | varchar(128) | Agent 名称 |
| status | enum | pending/running/completed/failed/skipped |
| input | text | 任务输入 |
| output | text | 执行输出 |
| error | text | 错误信息 |
| durationMs | integer | 耗时 |
| startedAt | timestamp | 开始时间 |
| completedAt | timestamp | 结束时间 |

**索引设计**：
- `ma_runs_team_idx` — 按团队查询运行历史
- `ma_runs_status_idx` — 按状态筛选
- `ma_runs_created_at_idx` — 按时间排序
- `ma_steps_run_idx` — 按运行查询步骤
- `ma_steps_stage_idx` — 按运行+阶段查询

## 6. 安全设计要点

### 6.1 输入验证

| 层级 | 措施 |
|------|------|
| API 层 | Zod schema 验证（goal 长度 1-5000） |
| 中间件 | 输入验证中间件（XSS 过滤、URL 校验） |
| 限流 | 速率限制（防止滥用） |

### 6.2 资源保护

| 风险 | 措施 |
|------|------|
| 无限循环 | 阶段数、步骤数有上限（模板内限制） |
| 上下文爆炸 | buildStageContext 截断到 500 字符/Agent |
| 运行超时 | 可配置超时时间（当前未实现，建议扩展） |
| 并发限制 | 可限制单用户同时运行数（当前未实现） |

### 6.3 内存降级

与其他模块一致，多智能体模块也支持内存降级运行：
- 无数据库时，运行记录存在内存 Map 中（`storeRun` / `getRun`）
- 重启后数据丢失，但不影响功能使用
- 生产环境建议接入真实数据库

## 7. 使用指南

### 7.1 快速开始

1. **进入协作工作台**：点击侧边栏「多智能体协作」或访问 `/collaboration`
2. **选择团队模板**：顶部下拉框选择（研究分析流/创意写作流/代码开发流）
3. **输入目标**：在输入框中描述你想要完成的任务
4. **开始运行**：点击「开始运行」按钮
5. **观察过程**：
   - 左栏：看工作流图和进度条
   - 中栏：看 Agent 实时输出
   - 右栏：看时间线和步骤详情
6. **查看结果**：运行完成后，中栏底部显示最终答案

### 7.2 API 调用示例

```bash
# 启动运行（SSE 流式）
curl -N -X POST http://localhost:3000/api/multi-agent/run \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "分析人工智能的发展趋势",
    "workflowTemplateId": "research-analysis"
  }'

# 获取团队列表
curl http://localhost:3000/api/multi-agent/teams

# 获取历史运行列表
curl http://localhost:3000/api/multi-agent/runs

# 获取运行详情
curl http://localhost:3000/api/multi-agent/runs/{runId}
```

### 7.3 自定义工作流

```typescript
// 传入自定义阶段配置
const response = await fetch("/api/multi-agent/run", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    goal: "我的自定义任务",
    customStages: [
      {
        name: "第一阶段",
        description: "规划",
        tasks: [
          { title: "任务拆解", assignee: "planner", description: "..." }
        ]
      },
      // 更多阶段...
    ]
  })
});
```

## 8. 技术扩展方向

### 8.1 短期优化

- **真实流式输出**：当前 delta 是模拟的，接入 LLM 的真实 streaming API
- **Step ID 修正**：agent_delta 事件携带 stepId，解决并行 Agent delta 错乱问题
- **运行超时**：为 WorkflowEngine 增加超时机制，防止无限运行
- **并行 Agent 消息气泡**：中栏支持同时显示多个 Agent 的输出
- **人工介入（HITL）**：关键节点支持用户审核/修改后再继续

### 8.2 中期优化

- **Agent 间对话**：支持 Agent 之间互相提问、讨论（MessageBus 订阅模式）
- **动态工作流**：Planner Agent 可以动态调整后续阶段和任务分配
- **工具调用集成**：让 Agent 真正调用 tools（researcher 用 web_search 等）
- **运行历史管理**：完整的历史记录页面、运行对比、重新运行
- **自定义 Agent 编辑**：前端页面允许用户创建/修改 Agent 角色
- **自定义工作流编辑器**：可视化拖拽编排工作流

### 8.3 长期方向

- **Agent 自治**：Agent 自主决定是否需要调用工具、是否需要求助其他 Agent
- **多团队协作**：不同团队（如研究团队 + 开发团队）协同工作
- **记忆集成**：Agent 可以访问长期记忆、知识库（RAG）
- **性能监控**：每个 Agent 的 Token 消耗、耗时统计、成本核算
- **插件系统**：支持第三方 Agent 插件、工作流模板市场
- **分布式执行**：Agent 执行分布到多个 Worker 节点，支持大规模并行

## 9. 验证记录

- 跑了哪些命令 / 测试：
  - `pnpm run typecheck` ✅ 0 error
  - `pnpm run lint` ✅ 0 warning
- 功能验证：
  - 工作流引擎 ✅ 阶段串行 + 阶段内并行
  - SSE 事件流 ✅ 9 种事件类型完整推送
  - 前端可视化 ✅ 三栏布局 + 实时更新
  - 3 种模板 ✅ 研究/创意/代码流均可运行
  - 8 个 Agent ✅ 角色定义 + 系统提示词
  - 内存降级 ✅ 无数据库时正常运行
- 已知遗留问题：
  - agent_delta 并行时匹配可能不准（简化实现）
  - delta 是模拟的（先完整获取再分片推送）

## 10. 收获与踩坑

- 学到了什么：
  - 多智能体协作的核心模式：阶段串行 + 阶段内并行
  - SSE + POST 的实现方式（fetch + ReadableStream 手动解析）
  - 工作流引擎的设计：事件驱动、状态追踪、上下文管理
  - 可视化三栏布局的信息架构：流程概览 + 详细输出 + 时间线
- 踩过的坑：
  - 原生 EventSource 不支持 POST，需要用 fetch + ReadableStream 自己解析 SSE
  - 前后端 stepId 不一致，需要通过 stageIndex + stepIndex 建立映射
  - 并行 Agent 的 delta 事件如果用「当前 running 的 step」匹配会错乱
  - 工作流图 SVG 绘制时，节点坐标计算需要考虑动态内容
- 下次会怎么做：
  - delta 事件直接携带 stepId，避免模糊匹配
  - 从一开始就设计真实流式输出，而不是先模拟再改造
  - 可视化组件用更灵活的布局方案（如 react-flow），减少手动计算坐标
