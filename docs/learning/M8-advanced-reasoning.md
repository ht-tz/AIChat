# M8 高级推理 · 学习文档

> M8 建立了高级推理框架，包括 Plan 优化器、结构化反思、工具选择策略和推理可视化。配套需求文档：[M8-advanced-reasoning.md](../requirements/M8-advanced-reasoning.md)。

## 1. 需求思路

### 1.1 M7 的局限

M7 建立了记忆系统，但推理能力有限：
- Plan 是扁平列表，无法表达步骤间依赖
- 反思只是简单重试，缺乏结构化自省
- 工具选择无策略约束

### 1.2 M8 要解决什么

| 能力 | 体现 |
|------|------|
| **任务分解** | 将复杂目标拆分为子任务树 |
| **依赖图** | 识别步骤间依赖，支持并行执行 |
| **结构化反思** | 分析失败原因、提出修正方案 |
| **失败恢复** | 错误分类 + 恢复策略（重试/跳过/降级/中止） |
| **工具选择策略** | 基于规则 + 记忆驱动的工具选择 |
| **推理可视化** | 展示思考链、Plan 树、依赖图 |

## 2. 代码思路

### 2.1 关键文件

| 文件 | 职责 |
|------|------|
| `src/server/reasoning/plan-optimizer.ts` | Plan 优化器（任务分解 + 依赖图 + 拓扑排序） |
| `src/server/reasoning/reflection-engine.ts` | 反思引擎（错误分类 + 恢复策略 + 信心度） |
| `src/server/reasoning/tool-strategy.ts` | 工具选择策略（规则 + 记忆驱动） |
| `src/server/reasoning/index.ts` | 统一导出 |
| `src/app/api/reasoning/decompose/route.ts` | POST /api/reasoning/decompose |
| `src/app/api/reasoning/reflect/route.ts` | POST /api/reasoning/reflect |
| `src/features/reasoning/reasoning-lab.tsx` | 推理实验室 UI |
| `src/app/reasoning/page.tsx` | /reasoning 页面路由 |

### 2.2 任务分解流程

```
用户目标: "搜索 AI 最新进展并计算 42 * 58"
            ↓
decomposeTask():
  匹配关键词 "搜索" → 创建 "提取搜索关键词" + "执行搜索"
  匹配关键词 "计算" → 创建 "解析表达式" + "执行计算"
            ↓
SubTask[]:
  ├── 解析表达式 (无依赖)
  ├── 执行计算 (依赖: 解析表达式)
  ├── 提取搜索关键词 (无依赖)
  └── 执行搜索 (依赖: 提取搜索关键词)
            ↓
buildExecutionOrder():
  层级 1: [解析表达式, 提取搜索关键词] ← 可并行
  层级 2: [执行计算, 执行搜索] ← 可并行
```

### 2.3 依赖图与拓扑排序

```
邻接表表示:
  解析表达式 → [执行计算]
  提取搜索关键词 → [执行搜索]

拓扑排序: [解析表达式, 提取搜索关键词, 执行计算, 执行搜索]

执行层级:
  Level 0: 解析表达式, 提取搜索关键词 (并行)
  Level 1: 执行计算, 执行搜索 (并行)
```

### 2.4 反思引擎

```
错误发生 → categorizeError()
  ├── "not found" → tool_not_found
  ├── "execution failed" → tool_execution
  ├── "invalid input" → invalid_input
  ├── "timeout" → timeout
  ├── "overflow" → context_overflow
  └── 其他 → unknown
            ↓
selectRecoveryStrategy(category, retryCount, maxRetries):
  ├── tool_not_found → degrade (降级)
  ├── tool_execution → retry (重试)
  ├── invalid_input → retry_modified (修改参数重试)
  ├── timeout → retry (重试)
  ├── context_overflow → degrade (降级)
  └── 超过最大重试次数 → abort (中止)
            ↓
reflect() → ReflectionResult:
  { errorCategory, errorAnalysis, recoveryStrategy, suggestion, confidence }
```

### 2.5 工具选择策略

```
用户消息: "计算 123 * 456"
            ↓
selectToolsByRules():
  1. 检查 deny 规则 → 过滤禁止工具
  2. 关键词匹配 → calculator 匹配 "计算" "*"
  3. 按优先级排序 → calculator (10) > web_search (8)
            ↓
optimizeWithMemory():
  1. 查询历史成功率
  2. 过滤成功率 < 30% 的工具
  3. 添加记忆驱动的推理
            ↓
ToolSelection:
  selectedTools: [calculator]
  reasoning: "calculator: 关键词匹配 + 策略prefer; 记忆: calculator: 历史成功率 92%"
```

## 3. 技术架构

### 3.1 推理实验室页面

```
/reasoning (ReasoningLab)
├── 顶部: 返回链接 + "推理实验室"标题
├── Tab: 任务分解 | 结构化反思 | 工具选择策略
├── 任务分解:
│   ├── 输入目标 → 调用 /api/reasoning/decompose
│   ├── 执行层级可视化（每层可并行的任务）
│   ├── 任务详情（标题、描述、工具、依赖、状态）
│   └── 依赖图 SVG 可视化
├── 结构化反思:
│   ├── 输入错误信息 → 调用 /api/reasoning/reflect
│   └── 展示：错误类型、恢复策略、信心度、分析、建议
└── 工具选择策略:
    ├── 输入用户消息 → 调用 /api/reasoning/reflect
    └── 展示：选择/拒绝的工具、选择理由
```

### 3.2 错误分类与恢复策略映射

| 错误类型 | 恢复策略 | 信心度 |
|----------|----------|--------|
| tool_not_found | degrade | 0.7 |
| tool_execution | retry | 0.6 |
| invalid_input | retry_modified | 0.8 |
| timeout | retry | 0.5 |
| context_overflow | degrade | 0.4 |
| model_error | retry → abort | 0.3 |
| unknown | retry → abort | 0.2 |

## 4. 技术拓展

### 4.1 基于 LLM 的智能分解

当前使用关键词匹配，升级方向：

```ts
async function llmDecompose(goal: string): Promise<SubTask[]> {
  const result = await getProvider().complete({
    messages: [{
      role: "user",
      content: `将以下目标分解为子任务，每个子任务包含：title, description, toolName?, dependencies[]
      
      目标：${goal}
      
      可用工具：calculator, web_search, code_runner, read_file, generate_image
      
      请以 JSON 数组格式输出。`
    }],
    jsonMode: true,
  });
  return JSON.parse(result.content);
}
```

### 4.2 强化学习训练策略（M10+）

```ts
// Q-Learning for tool selection
interface QState { messageFeatures: number[]; availableTools: string[]; }
interface QAction { toolName: string; }

const qTable = new Map<string, Map<string, number>>();

function updateQValue(state: QState, action: QAction, reward: number): void {
  const key = JSON.stringify(state);
  const actions = qTable.get(key) || new Map<string, number>();
  const current = actions.get(action.toolName) || 0;
  actions.set(action.toolName, current + 0.1 * (reward - current));
  qTable.set(key, actions);
}
```

### 4.3 多 Agent 协作推理（M9+）

```ts
interface AgentRole {
  name: string;
  systemPrompt: string;
  tools: string[];
}

const REASONING_TEAM: AgentRole[] = [
  { name: "planner", systemPrompt: "你是任务规划专家...", tools: [] },
  { name: "executor", systemPrompt: "你是执行专家...", tools: ["*"] },
  { name: "critic", systemPrompt: "你是评审专家...", tools: [] },
];

async function collaborativeReasoning(goal: string): Promise<string> {
  const plan = await runAgent("planner", goal);
  const result = await runAgent("executor", plan);
  const review = await runAgent("critic", result);
  return review.approved ? result : collaborativeReasoning(goal); // 迭代改进
}
```

## 5. 验证结果

| 验证项 | 结果 |
|--------|------|
| `npx tsc --noEmit` | ✅ 0 error |
| /reasoning 页面 | ✅ 任务分解 + 反思 + 工具选择 |
| 任务分解 | ✅ 自动拆分子任务 + 依赖图 + 执行层级 |
| 结构化反思 | ✅ 错误分类 + 恢复策略 + 信心度 |
| 工具选择 | ✅ 规则 + 关键词匹配 + 记忆驱动 |
| 依赖图可视化 | ✅ SVG 箭头连接 |
| 导航入口 | ✅ sidebar 添加推理实验室链接 |

## 6. 待优化（M9+ 处理）

- **ISSUE-M8-001** LLM 驱动的智能分解 → M9 多 Agent 协作
- **ISSUE-M8-002** 强化学习训练策略 → M10 Eval 体系
- **ISSUE-M8-003** 多 Agent 协作推理 → M9 知识库增强
- **ISSUE-M8-004** 推理过程实时可视化 → 后续迭代
- **ISSUE-M8-005** 失败恢复自动执行 → 集成到 dispatcher

## 7. 关联文档

- 需求文档：[M8-advanced-reasoning.md](../requirements/M8-advanced-reasoning.md)
- 架构总览：[00-architecture.md](./00-architecture.md)
