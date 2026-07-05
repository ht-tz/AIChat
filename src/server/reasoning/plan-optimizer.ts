// Plan 优化器 —— 任务分解 + 依赖图 + 并行执行

/** 子任务状态 */
export type TaskStatus = "pending" | "ready" | "running" | "done" | "failed" | "skipped";

/** 子任务定义 */
export interface SubTask {
  id: string;
  title: string;
  description: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  dependencies: string[]; // 依赖的其他子任务 ID
  status: TaskStatus;
  result?: string;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

/** Plan 树 */
export interface PlanTree {
  id: string;
  goal: string;
  tasks: Map<string, SubTask>;
  executionOrder: string[][]; // 按层级组织，每层可并行
  createdAt: number;
}

/** 创建子任务 ID */
function taskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** 任务分解：将目标拆分为子任务列表 */
export function decomposeTask(goal: string, availableTools: string[]): SubTask[] {
  const tasks: SubTask[] = [];
  const lower = goal.toLowerCase();

  // 基于关键词模式匹配分解任务
  if (lower.includes("计算") || lower.includes("算")) {
    tasks.push({
      id: taskId(),
      title: "解析表达式",
      description: "从输入中提取数学表达式",
      toolName: undefined,
      dependencies: [],
      status: "pending",
      retryCount: 0,
      maxRetries: 2,
    });
    tasks.push({
      id: taskId(),
      title: "执行计算",
      description: "使用计算器工具执行计算",
      toolName: "calculator",
      dependencies: [tasks[0].id],
      status: "pending",
      retryCount: 0,
      maxRetries: 2,
    });
  }

  if (lower.includes("搜索") || lower.includes("查找") || lower.includes("查询")) {
    tasks.push({
      id: taskId(),
      title: "提取搜索关键词",
      description: "从输入中提取搜索关键词",
      toolName: undefined,
      dependencies: [],
      status: "pending",
      retryCount: 0,
      maxRetries: 2,
    });
    tasks.push({
      id: taskId(),
      title: "执行搜索",
      description: "使用搜索工具执行搜索",
      toolName: "web_search",
      dependencies: [tasks[tasks.length - 1].id],
      status: "pending",
      retryCount: 0,
      maxRetries: 2,
    });
  }

  if (lower.includes("运行") || lower.includes("执行代码") || lower.includes("code")) {
    tasks.push({
      id: taskId(),
      title: "提取代码",
      description: "从输入中提取要运行的代码",
      toolName: undefined,
      dependencies: [],
      status: "pending",
      retryCount: 0,
      maxRetries: 2,
    });
    tasks.push({
      id: taskId(),
      title: "执行代码",
      description: "使用代码运行器执行代码",
      toolName: "code_runner",
      dependencies: [tasks[tasks.length - 1].id],
      status: "pending",
      retryCount: 0,
      maxRetries: 2,
    });
  }

  if (lower.includes("分析") || lower.includes("审查") || lower.includes("review")) {
    tasks.push({
      id: taskId(),
      title: "收集信息",
      description: "收集分析所需的输入信息",
      toolName: undefined,
      dependencies: [],
      status: "pending",
      retryCount: 0,
      maxRetries: 2,
    });
    tasks.push({
      id: taskId(),
      title: "执行分析",
      description: "基于收集的信息执行分析",
      toolName: undefined,
      dependencies: [tasks[tasks.length - 1].id],
      status: "pending",
      retryCount: 0,
      maxRetries: 2,
    });
  }

  // 默认：不分解，返回单任务
  if (tasks.length === 0) {
    tasks.push({
      id: taskId(),
      title: `执行: ${goal.slice(0, 50)}`,
      description: goal,
      toolName: undefined,
      dependencies: [],
      status: "pending",
      retryCount: 0,
      maxRetries: 2,
    });
  }

  return tasks;
}

/** 构建依赖图并计算执行层级 */
export function buildExecutionOrder(tasks: SubTask[]): string[][] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const levels: string[][] = [];
  const completed = new Set<string>();

  let remaining = tasks.length;
  let safety = 0;

  while (remaining > 0 && safety < tasks.length + 5) {
    safety++;
    const ready: string[] = [];

    for (const task of tasks) {
      if (completed.has(task.id)) continue;
      const depsComplete = task.dependencies.every((depId) => completed.has(depId));
      if (depsComplete) {
        ready.push(task.id);
      }
    }

    if (ready.length === 0) {
      // 死锁：强制解锁没有完成的依赖
      for (const task of tasks) {
        if (!completed.has(task.id)) {
          ready.push(task.id);
          break;
        }
      }
    }

    levels.push(ready);
    ready.forEach((id) => completed.add(id));
    remaining -= ready.length;
  }

  return levels;
}

/** 创建 Plan 树 */
export function createPlanTree(goal: string, availableTools: string[]): PlanTree {
  const tasks = decomposeTask(goal, availableTools);
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const executionOrder = buildExecutionOrder(tasks);

  return {
    id: `plan-${Date.now()}`,
    goal,
    tasks: taskMap,
    executionOrder,
    createdAt: Date.now(),
  };
}

/** 获取当前可执行的任务 */
export function getReadyTasks(plan: PlanTree): SubTask[] {
  return Array.from(plan.tasks.values()).filter((t) => {
    if (t.status !== "pending") return false;
    return t.dependencies.every((depId) => {
      const dep = plan.tasks.get(depId);
      return dep && dep.status === "done";
    });
  });
}

/** 标记任务完成 */
export function completeTask(plan: PlanTree, taskId: string, result: string): void {
  const task = plan.tasks.get(taskId);
  if (task) {
    task.status = "done";
    task.result = result;
  }
}

/** 标记任务失败 */
export function failTask(plan: PlanTree, taskId: string, error: string): void {
  const task = plan.tasks.get(taskId);
  if (task) {
    task.status = "failed";
    task.error = error;
  }
}

/** 拓扑排序：返回所有任务的执行顺序 */
export function topologicalSort(tasks: SubTask[]): string[] {
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  for (const task of tasks) {
    inDegree.set(task.id, task.dependencies.length);
    adjList.set(task.id, []);
  }

  for (const task of tasks) {
    for (const depId of task.dependencies) {
      const list = adjList.get(depId);
      if (list) list.push(task.id);
    }
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    const neighbors = adjList.get(current) || [];
    for (const neighbor of neighbors) {
      const degree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, degree);
      if (degree === 0) queue.push(neighbor);
    }
  }

  return result;
}

/** 序列化 Plan 树为 JSON（用于传输和存储） */
export function serializePlanTree(plan: PlanTree): string {
  return JSON.stringify({
    id: plan.id,
    goal: plan.goal,
    tasks: Array.from(plan.tasks.entries()),
    executionOrder: plan.executionOrder,
    createdAt: plan.createdAt,
  });
}

/** 反序列化 Plan 树 */
export function deserializePlanTree(json: string): PlanTree {
  const data = JSON.parse(json);
  return {
    id: data.id,
    goal: data.goal,
    tasks: new Map(data.tasks),
    executionOrder: data.executionOrder,
    createdAt: data.createdAt,
  };
}
