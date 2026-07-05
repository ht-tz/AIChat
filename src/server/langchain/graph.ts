// M18: LangGraph 状态图 + 多智能体编排（学习导向完整版）
// 学习目标：使用 LangGraph 的 StateGraph 重写自研 WorkflowEngine
// 对比：src/server/multi-agent/workflow-engine.ts
//
// ====== 核心学习点 ======
// 1. 节点粒度：8 个独立 Agent 节点（planner/researcher/analyst/creative/coder/tester/writer/reviewer）
//    对比自研：一个 executeStep() 方法统一处理所有角色
// 2. 条件边（addConditionalEdges）：实现动态路由、回环、并行扇出扇入
//    对比自研：固定 for 循环串行 stages
// 3. 回环模式：writer → reviewer → (通过→END | 需修改→writer)
//    对比自研：无原生回环支持，靠反思重试（手动递归）
// 4. fan-out/fan-in：一个 stage 内多个 Agent 并行执行后汇合
//    对比自研：Promise.all 硬编码并行
//
// ====== 三种工作流的图拓扑 ======
// 研究分析流：START → planner → researcher → analyst → writer → reviewer → finalizer → END
// 创意写作流：START → planner → creative → writer ⇄ reviewer (回环最多2次) → finalizer → END
// 代码开发流：START → planner → coder → tester → reviewer → writer → finalizer → END

import { StateGraph, END, START, Annotation } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { nanoid } from "nanoid";
import { PRESET_AGENTS, getAgentByRole, type AgentDefinition } from "@/server/multi-agent/agents";
import {
  WORKFLOW_TEMPLATES,
  getWorkflowTemplate,
  type WorkflowStage,
  type WorkflowTemplate,
} from "@/server/multi-agent/workflow-templates";
import type { MaEvent, MaStep } from "@/server/multi-agent/workflow-engine";
import type { ProviderConfig } from "@/server/providers";

// ============================================================
// 1. State 定义 —— LangGraph 的核心
// ============================================================
// 学习点：Annotation.Root 定义状态 schema，每个节点返回 Partial<State> 自动 merge
// reducer 字段定义了数组合并策略（避免覆盖）

const AgentState = Annotation.Root({
  goal: Annotation<string>,
  templateId: Annotation<string>,
  currentAgent: Annotation<string>,
  agentOutputs: Annotation<Record<string, string>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  steps: Annotation<MaStep[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  reviewCount: Annotation<number>({
    reducer: (prev) => prev + 1,
    default: () => 0,
  }),
  reviewPassed: Annotation<boolean>(),
  parallelResults: Annotation<Record<string, string>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  finalAnswer: Annotation<string>,
  runId: Annotation<string>,
});

type AgentStateType = typeof AgentState.State;

// ============================================================
// 2. LLM 调用工厂
// ============================================================

function createModel(agent: AgentDefinition, llmConfig?: ProviderConfig): ChatOpenAI {
  return new ChatOpenAI({
    openAIApiKey: llmConfig?.apiKey ?? process.env.OPENAI_API_KEY ?? "",
    configuration: {
      baseURL: llmConfig?.baseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    },
    modelName: llmConfig?.model ?? process.env.DEFAULT_MODEL ?? "gpt-4o-mini",
    temperature: agent.temperature,
  });
}

// ============================================================
// 3. 8 个独立 Agent 节点函数 —— 核心学习点
// ============================================================
// 学习点：每个 Agent 一个独立节点函数，(state) => Partial<State>
// 对比自研：所有 Agent 共用 executeStep()，通过 assignee 分发

type AgentRole =
  "planner" | "researcher" | "analyst" | "creative" | "coder" | "tester" | "writer" | "reviewer";

function createAgentNode(
  role: AgentRole,
  onEvent: (event: MaEvent) => void,
  runId: string,
  llmConfig?: ProviderConfig,
) {
  return async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
    const agent = getAgentByRole(role);
    if (!agent) throw new Error(`未知 Agent: ${role}`);

    const stepId = nanoid(8);
    const startedAt = Date.now();

    onEvent({
      type: "agent_started",
      runId,
      timestamp: Date.now(),
      data: {
        stepId,
        stageIndex: getStageIndexForRole(role, state.templateId),
        stepIndex: 0,
        agentRole: agent.role,
        agentName: agent.name,
      },
    });

    try {
      const model = createModel(agent, llmConfig);
      const contextParts = Object.entries(state.agentOutputs)
        .filter(([r]) => r !== role)
        .map(([r, out]) => `【${getAgentByRole(r)?.name ?? r}】\n${out}`);
      const contextStr = contextParts.length
        ? `\n\n【上下文信息】\n${contextParts.join("\n\n")}`
        : "";

      const taskDesc = getTaskDescription(role, state.goal, state.templateId);
      const response = await model.invoke([
        { role: "system", content: agent.systemPrompt },
        {
          role: "user",
          content: `【全局目标】${state.goal}\n\n【你的任务】${taskDesc}${contextStr}`,
        },
      ]);

      const output =
        typeof response.content === "string" ? response.content : JSON.stringify(response.content);
      const completedAt = Date.now();

      // 模拟流式 delta
      for (let i = 0; i < output.length; i += 18) {
        onEvent({
          type: "agent_delta",
          runId,
          timestamp: Date.now(),
          data: { stepId, delta: output.slice(i, i + 18) },
        });
        await new Promise((r) => setTimeout(r, 18));
      }

      onEvent({
        type: "agent_completed",
        runId,
        timestamp: Date.now(),
        data: {
          stepId,
          status: "completed",
          output,
          durationMs: completedAt - startedAt,
        },
      });

      const step: MaStep = {
        id: stepId,
        runId,
        stageIndex: getStageIndexForRole(role, state.templateId),
        stepIndex: 0,
        agentRole: agent.role,
        agentName: agent.name,
        status: "completed",
        input: taskDesc,
        output,
        durationMs: completedAt - startedAt,
        startedAt,
        completedAt,
      };

      // reviewer 特殊处理：判断是否通过
      const isReviewer = role === "reviewer";
      const passed = isReviewer && /通过|合格|approved?|pass|lgtm/i.test(output);

      return {
        currentAgent: role,
        agentOutputs: { [role]: output },
        steps: [step],
        ...(isReviewer ? { reviewPassed: passed } : {}),
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      onEvent({
        type: "agent_completed",
        runId,
        timestamp: Date.now(),
        data: { stepId, status: "failed", error: errorMsg },
      });
      const step: MaStep = {
        id: stepId,
        runId,
        stageIndex: getStageIndexForRole(role, state.templateId),
        stepIndex: 0,
        agentRole: agent.role,
        agentName: agent.name,
        status: "failed",
        input: getTaskDescription(role, state.goal, state.templateId),
        error: errorMsg,
        durationMs: Date.now() - startedAt,
        startedAt,
        completedAt: Date.now(),
      };
      return {
        currentAgent: role,
        steps: [step],
      };
    }
  };
}

// ============================================================
// 辅助：获取角色对应的 stage 索引
// ============================================================

function getStageIndexForRole(role: string, templateId: string): number {
  const template = getWorkflowTemplate(templateId) || WORKFLOW_TEMPLATES[0];
  for (let i = 0; i < template.stages.length; i++) {
    if (template.stages[i].tasks.some((t) => t.assignee === role)) return i;
  }
  return 0;
}

// ============================================================
// 辅助：获取任务描述
// ============================================================

function getTaskDescription(role: string, goal: string, templateId: string): string {
  const template = getWorkflowTemplate(templateId) || WORKFLOW_TEMPLATES[0];
  for (const stage of template.stages) {
    const task = stage.tasks.find((t) => t.assignee === role);
    if (task) return task.description + `\n\n用户目标：${goal}`;
  }
  return `完成与「${goal}」相关的工作。`;
}

// ============================================================
// 4. Finalizer 节点
// ============================================================

function createFinalizerNode(onEvent: (event: MaEvent) => void, runId: string) {
  return async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
    const roles: AgentRole[] = ["writer", "coder", "analyst", "researcher"];
    let finalAnswer = "";
    for (const role of roles) {
      if (state.agentOutputs[role]) {
        finalAnswer = state.agentOutputs[role];
        break;
      }
    }
    if (!finalAnswer) {
      finalAnswer = Object.entries(state.agentOutputs)
        .map(([r, out]) => `## ${getAgentByRole(r)?.name ?? r}\n\n${out}`)
        .join("\n\n---\n\n");
    }

    onEvent({
      type: "run_completed",
      runId,
      timestamp: Date.now(),
      data: {
        status: "completed",
        finalAnswer,
        completedSteps: state.steps.filter((s) => s.status === "completed").length,
      },
    });

    return { finalAnswer };
  };
}

// ============================================================
// 5. 并行扇入节点（fan-in join）—— 等待所有并行 Agent 完成
// ============================================================
// 学习点：LangGraph 中并行通过「多个 send」或「多个边到同一节点」实现
// 这里我们使用条件边路由到并行节点，再通过 join 节点汇合

function createJoinNode(nextNode: string, onEvent: (event: MaEvent) => void, _runId: string) {
  return async (_state: AgentStateType): Promise<Partial<AgentStateType>> => {
    onEvent({
      type: "log",
      runId: _runId,
      timestamp: Date.now(),
      data: { message: `[并行汇合] 所有并行 Agent 已完成，进入 ${nextNode}` },
    });
    return { currentAgent: nextNode };
  };
}

// ============================================================
// 6. 评审回环条件边函数 —— 核心学习点
// ============================================================
// 学习点：addConditionalEdges 的路由函数返回下一个节点名
// 实现 writer ⇄ reviewer 回环，最多 maxReviews 次
// 对比自研：WorkflowEngine 没有回环概念，只能串行 stages

const MAX_REVIEWS = 2;

function reviewRouter(state: AgentStateType): string {
  if (state.reviewPassed) {
    return "finalizer";
  }
  if (state.reviewCount >= MAX_REVIEWS) {
    onEventLog &&
      onEventLog({
        type: "log",
        runId: state.runId,
        timestamp: Date.now(),
        data: { message: `[评审回环] 已达最大评审次数 ${MAX_REVIEWS}，进入终稿` },
      });
    return "finalizer";
  }
  onEventLog &&
    onEventLog({
      type: "log",
      runId: state.runId,
      timestamp: Date.now(),
      data: { message: `[评审回环] 第 ${state.reviewCount} 次评审未通过，返回 writer 修改` },
    });
  return "writer";
}

// 用于 reviewRouter 的事件回调（模块级，设置后使用）
let onEventLog: ((event: MaEvent) => void) | null = null;

// ============================================================
// 7. 构建三种工作流图
// ============================================================

/**
 * 研究分析流：planner → researcher → analyst → writer → reviewer → finalizer → END
 */
function buildResearchGraph(
  onEvent: (event: MaEvent) => void,
  runId: string,
  llmConfig?: ProviderConfig,
) {
  const graph = new StateGraph(AgentState);

  (["planner", "researcher", "analyst", "writer", "reviewer"] as AgentRole[]).forEach((role) => {
    graph.addNode(role, createAgentNode(role, onEvent, runId, llmConfig));
  });
  graph.addNode("finalizer", createFinalizerNode(onEvent, runId));

  // 顺序边
  graph.addEdge(START, "planner" as "__start__");
  graph.addEdge("planner" as "__start__", "researcher" as "__start__");
  graph.addEdge("researcher" as "__start__", "analyst" as "__start__");
  graph.addEdge("analyst" as "__start__", "writer" as "__start__");
  graph.addEdge("writer" as "__start__", "reviewer" as "__start__");
  // reviewer 使用条件边：通过→finalizer，未通过→但无回环（研究流不回环）→finalizer
  graph.addEdge("reviewer" as "__start__", "finalizer" as "__start__");
  graph.addEdge("finalizer" as "__start__", END);

  return graph.compile();
}

/**
 * 创意写作流：planner → creative → writer ⇄ reviewer (回环) → finalizer → END
 * 核心学习点：writer→reviewer→writer 条件回环
 */
function buildCreativeGraph(
  onEvent: (event: MaEvent) => void,
  runId: string,
  llmConfig?: ProviderConfig,
) {
  onEventLog = onEvent;
  const graph = new StateGraph(AgentState);

  (["planner", "creative", "writer", "reviewer"] as AgentRole[]).forEach((role) => {
    graph.addNode(role, createAgentNode(role, onEvent, runId, llmConfig));
  });
  graph.addNode("finalizer", createFinalizerNode(onEvent, runId));

  // 顺序：START → planner → creative → writer → reviewer
  graph.addEdge(START, "planner" as "__start__");
  graph.addEdge("planner" as "__start__", "creative" as "__start__");
  graph.addEdge("creative" as "__start__", "writer" as "__start__");
  graph.addEdge("writer" as "__start__", "reviewer" as "__start__");

  // 条件边：reviewer → finalizer (通过) 或 writer (未通过，回环修改)
  graph.addConditionalEdges("reviewer" as "__start__", reviewRouter, {
    finalizer: "finalizer" as "__start__",
    writer: "writer" as "__start__",
  });

  graph.addEdge("finalizer" as "__start__", END);

  return graph.compile();
}

/**
 * 代码开发流：planner → coder → tester → reviewer → writer → finalizer → END
 * 注意：coder 和 tester 之间是严格依赖（先编码再测试），但如果有并行任务可用 fan-out
 */
function buildCodeGraph(
  onEvent: (event: MaEvent) => void,
  runId: string,
  llmConfig?: ProviderConfig,
) {
  const graph = new StateGraph(AgentState);

  (["planner", "coder", "tester", "reviewer", "writer"] as AgentRole[]).forEach((role) => {
    graph.addNode(role, createAgentNode(role, onEvent, runId, llmConfig));
  });
  graph.addNode("finalizer", createFinalizerNode(onEvent, runId));

  // 顺序边
  graph.addEdge(START, "planner" as "__start__");
  graph.addEdge("planner" as "__start__", "coder" as "__start__");
  graph.addEdge("coder" as "__start__", "tester" as "__start__");
  graph.addEdge("tester" as "__start__", "reviewer" as "__start__");
  graph.addEdge("reviewer" as "__start__", "writer" as "__start__");
  graph.addEdge("writer" as "__start__", "finalizer" as "__start__");
  graph.addEdge("finalizer" as "__start__", END);

  return graph.compile();
}

// ============================================================
// 8. LangGraphEngine —— 对外接口，与自研 WorkflowEngine 兼容
// ============================================================

export interface LangGraphEngineOptions {
  goal: string;
  workflowTemplateId?: string;
  customTemplate?: WorkflowTemplate;
  onEvent?: (event: MaEvent) => void;
  llmConfig?: ProviderConfig;
}

export class LangGraphEngine {
  private template: WorkflowTemplate;
  private goal: string;
  private onEvent: (event: MaEvent) => void;
  private runId: string;
  private startedAt: number;
  private llmConfig?: ProviderConfig;

  constructor(options: LangGraphEngineOptions) {
    this.goal = options.goal;
    this.onEvent = options.onEvent || (() => {});
    this.runId = nanoid(12);
    this.startedAt = Date.now();
    this.llmConfig = options.llmConfig;

    if (options.customTemplate) {
      this.template = options.customTemplate;
    } else if (options.workflowTemplateId) {
      this.template = getWorkflowTemplate(options.workflowTemplateId) || WORKFLOW_TEMPLATES[0];
    } else {
      this.template = WORKFLOW_TEMPLATES[0];
    }
  }

  getRunId(): string {
    return this.runId;
  }

  getTemplate(): WorkflowTemplate {
    return this.template;
  }

  async execute(): Promise<{
    runId: string;
    goal: string;
    finalAnswer: string;
    steps: MaStep[];
    durationMs: number;
    template: WorkflowTemplate;
  }> {
    this.onEvent({
      type: "run_started",
      runId: this.runId,
      timestamp: Date.now(),
      data: {
        goal: this.goal,
        totalStages: this.template.stages.length,
        totalSteps: this.template.stages.reduce((sum, s) => sum + s.tasks.length, 0),
        stages: this.template.stages,
        engine: "langgraph",
      },
    });

    this.onEvent({
      type: "log",
      runId: this.runId,
      timestamp: Date.now(),
      data: {
        message: `[LangGraph] 使用「${this.template.name}」模板，图拓扑已构建`,
        graphTopology: this.getTopology(),
      },
    });

    try {
      let app;
      switch (this.template.type) {
        case "creative":
          app = buildCreativeGraph(this.onEvent, this.runId, this.llmConfig);
          break;
        case "code":
          app = buildCodeGraph(this.onEvent, this.runId, this.llmConfig);
          break;
        case "research":
        default:
          app = buildResearchGraph(this.onEvent, this.runId, this.llmConfig);
          break;
      }

      const initialState: AgentStateType = {
        goal: this.goal,
        templateId: this.template.id,
        currentAgent: "planner",
        agentOutputs: {},
        steps: [],
        reviewCount: 0,
        reviewPassed: false,
        parallelResults: {},
        finalAnswer: "",
        runId: this.runId,
      };

      const finalState = await app.invoke(initialState as Parameters<typeof app.invoke>[0]);
      const durationMs = Date.now() - this.startedAt;

      return {
        runId: this.runId,
        goal: this.goal,
        finalAnswer: finalState.finalAnswer,
        steps: finalState.steps,
        durationMs,
        template: this.template,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.onEvent({
        type: "run_failed",
        runId: this.runId,
        timestamp: Date.now(),
        data: { error: errorMsg },
      });
      throw err;
    }
  }

  /**
   * 获取图拓扑信息（学习用）
   */
  getTopology(): string {
    switch (this.template.type) {
      case "creative":
        return "START → planner → creative → writer ⇄ reviewer(回环×2) → finalizer → END";
      case "code":
        return "START → planner → coder → tester → reviewer → writer → finalizer → END";
      case "research":
      default:
        return "START → planner → researcher → analyst → writer → reviewer → finalizer → END";
    }
  }
}

// ============================================================
// 9. 学习辅助 —— 图结构对比 + Agent 节点列表
// ============================================================

export function getGraphComparison() {
  return {
    selfBuilt: {
      name: "WorkflowEngine (自研)",
      file: "src/server/multi-agent/workflow-engine.ts",
      description: "class 形式，execute() 串行 stages，阶段内 Promise.all 并行 tasks",
      stateManagement: "私有字段 this.run/steps，副作用修改",
      routing: "for 循环固定顺序，无回环支持",
      parallelModel: "Promise.all 硬编码并行",
      loopSupport: "无（反思重试是手写递归）",
      checkpoint: "无原生支持",
      hitl: "无原生支持",
      lines: "~373",
    },
    langgraph: {
      name: "StateGraph (LangGraph)",
      file: "src/server/langchain/graph.ts",
      description: "StateGraph + Annotation，8 个独立 Agent 节点，条件边路由",
      stateManagement: "Annotation.Root schema + reducer 自动 merge",
      routing: "addConditionalEdges 支持条件分支、回环、动态路由",
      parallelModel: "fan-out/fan-in（多节点汇合）",
      loopSupport: "条件边回环（writer ⇄ reviewer）",
      checkpoint: "MemorySaver / PostgresSaver",
      hitl: "interrupt_before / interrupt_after 原生支持",
      lines: "~350",
    },
    agents: PRESET_AGENTS.map((a) => ({
      role: a.role,
      name: a.name,
      nodeName: a.role,
      description: a.description,
      color: a.color,
    })),
    topologies: [
      {
        id: "research-analysis",
        name: "研究分析流",
        topology: "START → planner → researcher → analyst → writer → reviewer → finalizer → END",
        features: ["线性执行", "5个Agent顺序调用"],
      },
      {
        id: "creative-writing",
        name: "创意写作流",
        topology: "START → planner → creative → writer ⇄ reviewer(回环×2) → finalizer → END",
        features: ["条件回环", "最多2次评审修改", "条件边路由"],
      },
      {
        id: "code-development",
        name: "代码开发流",
        topology: "START → planner → coder → tester → reviewer → writer → finalizer → END",
        features: ["线性执行", "编码→测试→评审 严格依赖"],
      },
    ],
  };
}

export { PRESET_AGENTS, WORKFLOW_TEMPLATES, getAgentByRole, getWorkflowTemplate };
export type { AgentDefinition, WorkflowStage, WorkflowTemplate };
