// M19: LangGraph HITL + Checkpoint + 断点续跑 + 时间旅行（完整版）
// 学习目标：LangGraph 的高级特性
// 对比：自研项目无原生 Checkpoint 机制，反思重试是手写的（reasoning 实验室）
//
// ====== 核心概念 ======
// 1. Checkpointer —— 状态持久化（MemorySaver 内存版，生产用 PostgresSaver）
// 2. thread_id —— 会话标识，同一 thread 的多次 invoke 共享状态
// 3. interrupt_before —— 在指定节点前暂停，等待人工审批
//    - 终稿审批：interrupt_before: ["approval_gate"] —— 所有工作完成后审批最终结果
//    - 工具审批：interrupt_before: ["tool_gate"] —— 每次工具调用前审批（对比 requireConfirm）
// 4. getStateHistory —— 获取所有历史 Checkpoint（时间旅行）
// 5. 断点续跑 —— 从暂停点继续 invoke
//
// ====== 两种 HITL 模式 ======
// Mode 1 (终稿审批): 执行所有 Agent 节点 → 暂停在 approval_gate → 审批 → finalizer → END
// Mode 2 (工具审批): Agent 产生输出后 → 暂停在 tool_gate（审批工具调用）→ 继续 →
//                    …循环到所有 Agent 完成 → 暂停在 approval_gate（终稿审批）→ finalizer → END
//
// 关键设计：gate 节点
//   interrupt_before 必须放在"门节点"上而不是 Agent 节点本身，因为：
//   - interrupt_before: ["researcher"] 会在 researcher 执行前暂停（Agent 还没有输出）
//   - interrupt_before: ["tool_research_gate"] 在 researcher 执行完毕、进入 gate 前暂停
//     此时我们能看到 researcher 的输出，决定是否"批准"它调用工具
//
// 对比自研:
// - 自研 requireConfirm: 仅单个工具调用确认，无状态持久化
// - LangGraph HITL: 任意节点前/后暂停，checkpointer 持久化，支持时间旅行

import {
  StateGraph,
  END,
  START,
  Annotation,
  MemorySaver,
  GraphInterrupt,
} from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { nanoid } from "nanoid";
import { getAgentByRole, type AgentDefinition } from "@/server/multi-agent/agents";
import {
  getWorkflowTemplate,
  type WorkflowTemplate,
} from "@/server/multi-agent/workflow-templates";
import type { MaEvent, MaStep } from "@/server/multi-agent/workflow-engine";
import type { ProviderConfig } from "@/server/providers";

type AgentRole =
  "planner" | "researcher" | "analyst" | "creative" | "coder" | "tester" | "writer" | "reviewer";

// gate 节点名（工具审批模式下使用）
const TOOL_GATE_RESEARCH = "tool_research_gate";
const TOOL_GATE_CODE = "tool_code_gate";
const APPROVAL_GATE = "approval_gate";

const HitlState = Annotation.Root({
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
  finalAnswer: Annotation<string>,
  runId: Annotation<string>,
  threadId: Annotation<string>,
  approval: Annotation<"pending" | "approved" | "rejected">,
  pausedReason: Annotation<string | null>,
  pendingToolCall: Annotation<{
    toolName: string;
    toolInput: string;
    agentRole: string;
  } | null>,
  hitlMode: Annotation<"final" | "tool">,
  lastAgentWithTool: Annotation<string | null>,
});

type HitlStateType = typeof HitlState.State;

// ============================================================
// 全局 MemorySaver 单例 + thread 元数据
// ============================================================

const globalCheckpointer = new MemorySaver();

type HitlMode = "final" | "tool";

interface ThreadMetadata {
  threadId: string;
  runId: string;
  goal: string;
  templateId?: string;
  templateName: string;
  status: "running" | "paused" | "completed" | "rejected" | "failed";
  hitlMode: HitlMode;
  createdAt: number;
  updatedAt: number;
  pausedAt?: string;
  pausedReason?: string;
  pendingToolCall?: {
    toolName: string;
    toolInput: string;
    agentRole: string;
  };
}

const threadStore = new Map<string, ThreadMetadata>();

// ============================================================
// LLM 调用
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
// 辅助函数
// ============================================================

function getStageIndexForRole(role: string, templateId: string): number {
  const template = getWorkflowTemplate(templateId) || getWorkflowTemplate("research-analysis")!;
  for (let i = 0; i < template.stages.length; i++) {
    if (template.stages[i].tasks.some((t) => t.assignee === role)) return i;
  }
  return 0;
}

function getTaskDescription(role: string, goal: string, templateId: string): string {
  const template = getWorkflowTemplate(templateId) || getWorkflowTemplate("research-analysis")!;
  for (const stage of template.stages) {
    const task = stage.tasks.find((t) => t.assignee === role);
    if (task) return task.description + `\n\n用户目标：${goal}`;
  }
  return `完成与「${goal}」相关的工作。`;
}

const TOOLS_FOR_ROLE: Record<string, string[]> = {
  researcher: ["web_search", "read_file"],
  analyst: ["calculator", "code_runner"],
  coder: ["code_runner", "read_file"],
  tester: ["code_runner", "calculator"],
};

function pickToolForAgent(
  agentRole: string,
  output: string,
): { toolName: string; toolInput: string } {
  const tools = TOOLS_FOR_ROLE[agentRole] || ["web_search"];
  const toolName = tools[0];
  const toolInput = output.slice(0, 120);
  return { toolName, toolInput };
}

// ============================================================
// Agent 节点
// ============================================================

function createHitlAgentNode(
  role: AgentRole,
  onEvent: (event: MaEvent) => void,
  runId: string,
  llmConfig?: ProviderConfig,
) {
  return async (state: HitlStateType): Promise<Partial<HitlStateType>> => {
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
        .map(([r, out]) => `【${getAgentByRole(r)?.name ?? r}】\n${out.slice(0, 200)}`);
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

      for (let i = 0; i < output.length; i += 18) {
        onEvent({
          type: "agent_delta",
          runId,
          timestamp: Date.now(),
          data: { stepId, delta: output.slice(i, i + 18) },
        });
        await new Promise((r) => setTimeout(r, 15));
      }

      onEvent({
        type: "agent_completed",
        runId,
        timestamp: Date.now(),
        data: { stepId, status: "completed", output, durationMs: completedAt - startedAt },
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

      const isReviewer = role === "reviewer";
      const passed = isReviewer && /通过|合格|approved?|pass|lgtm/i.test(output);

      // 如果该 agent 需要工具，记录工具调用信息到 state 供 gate 节点读取
      const needsTool = state.hitlMode === "tool" && TOOLS_FOR_ROLE[role]?.length > 0;
      const pendingToolCall = needsTool
        ? { ...pickToolForAgent(role, output), agentRole: role }
        : null;
      const lastAgentWithTool = needsTool ? role : null;

      return {
        currentAgent: role,
        agentOutputs: { [role]: output },
        steps: [step],
        ...(isReviewer ? { reviewPassed: passed } : {}),
        pendingToolCall,
        lastAgentWithTool,
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
      return { currentAgent: role, steps: [step] };
    }
  };
}

// ============================================================
// 工具审批 gate 节点（在工具使用型 Agent 之后执行）
// interrupt_before 作用在这个节点上：Agent 输出已产生，等待人工决定是否"放行"工具调用
// 学习点：对比自研 Tool.requireConfirm 只是前端弹窗，无状态持久化、无法 resume/rollback
// ============================================================

function createToolGateNode(gateName: string, onEvent: (event: MaEvent) => void, runId: string) {
  return async (state: HitlStateType): Promise<Partial<HitlStateType>> => {
    onEvent({
      type: "log",
      runId,
      timestamp: Date.now(),
      data: {
        message:
          state.approval === "approved"
            ? `[工具审批] ${gateName} 通过：${state.pendingToolCall?.toolName ?? "tool"} 已执行`
            : `[工具审批] ${gateName} 已被拒绝，工作流终止`,
        approval: state.approval,
      },
    });
    if (state.approval === "rejected") {
      onEvent({
        type: "run_failed",
        runId,
        timestamp: Date.now(),
        data: { error: `用户拒绝了 ${state.pendingToolCall?.agentRole ?? "agent"} 的工具调用` },
      });
    }
    // 审批通过后重置 approval 为 pending，以便后续 gate 能再次触发中断
    return { pausedReason: null, pendingToolCall: null, approval: "pending" };
  };
}

// ============================================================
// 终稿审批 gate 节点（所有 Agent 结束后）
// ============================================================

function createApprovalNode(onEvent: (event: MaEvent) => void, runId: string) {
  return async (state: HitlStateType): Promise<Partial<HitlStateType>> => {
    onEvent({
      type: "log",
      runId,
      timestamp: Date.now(),
      data: { message: `[终稿审批] 审批结果：${state.approval}`, approval: state.approval },
    });
    if (state.approval === "rejected") {
      onEvent({
        type: "run_failed",
        runId,
        timestamp: Date.now(),
        data: { error: "用户拒绝了最终输出" },
      });
    }
    return { pausedReason: null };
  };
}

// ============================================================
// Finalizer 节点
// ============================================================

function createFinalizerNode(onEvent: (event: MaEvent) => void, runId: string) {
  return async (state: HitlStateType): Promise<Partial<HitlStateType>> => {
    const priorityRoles: AgentRole[] = ["writer", "coder", "analyst", "researcher"];
    let finalAnswer = "";
    for (const role of priorityRoles) {
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
// 评审回环条件路由（创意写作流）
// ============================================================

const MAX_REVIEWS = 2;

function hitlReviewRouter(state: HitlStateType): string {
  if (state.reviewPassed) return APPROVAL_GATE;
  if (state.reviewCount >= MAX_REVIEWS) return APPROVAL_GATE;
  return "writer";
}

// ============================================================
// 构建 HITL 图
// ============================================================

function buildHitlGraph(
  template: WorkflowTemplate,
  hitlMode: HitlMode,
  onEvent: (event: MaEvent) => void,
  runId: string,
  llmConfig?: ProviderConfig,
) {
  const graph = new StateGraph(HitlState);
  const type = template.type;

  const asNode = (name: string) => name as "__start__";

  const agentNode = (role: AgentRole) =>
    graph.addNode(role, createHitlAgentNode(role, onEvent, runId, llmConfig));

  agentNode("planner");
  if (type === "creative") {
    agentNode("creative");
    agentNode("writer");
    agentNode("reviewer");
  } else if (type === "code") {
    agentNode("coder");
    agentNode("tester");
    agentNode("reviewer");
    agentNode("writer");
  } else {
    agentNode("researcher");
    agentNode("analyst");
    agentNode("writer");
    agentNode("reviewer");
  }

  graph.addNode(APPROVAL_GATE, createApprovalNode(onEvent, runId));
  graph.addNode("finalizer", createFinalizerNode(onEvent, runId));

  // interrupt_before 配置
  const interruptBefore: string[] = [APPROVAL_GATE];

  if (hitlMode === "tool") {
    // 工具审批模式：在使用工具的 Agent 之后插入 gate 节点
    if (type === "research") {
      graph.addNode(TOOL_GATE_RESEARCH, createToolGateNode(TOOL_GATE_RESEARCH, onEvent, runId));
      interruptBefore.push(TOOL_GATE_RESEARCH);
    }
    if (type === "code") {
      graph.addNode(TOOL_GATE_CODE, createToolGateNode(TOOL_GATE_CODE, onEvent, runId));
      interruptBefore.push(TOOL_GATE_CODE);
    }
    // creative 流没有工具类 agent，不加工具 gate
  }

  // 构建边
  if (type === "creative") {
    // START → planner → creative → writer → reviewer ⇄ writer → approval_gate → finalizer → END
    graph.addEdge(START, asNode("planner"));
    graph.addEdge(asNode("planner"), asNode("creative"));
    graph.addEdge(asNode("creative"), asNode("writer"));
    graph.addEdge(asNode("writer"), asNode("reviewer"));
    graph.addConditionalEdges(asNode("reviewer"), hitlReviewRouter, {
      [APPROVAL_GATE]: asNode(APPROVAL_GATE),
      writer: asNode("writer"),
    });
  } else if (type === "code") {
    graph.addEdge(START, asNode("planner"));
    graph.addEdge(asNode("planner"), asNode("coder"));
    if (hitlMode === "tool") {
      // START → planner → coder → [tool_code_gate *HITL*] → tester → reviewer → writer → [approval_gate *HITL*] → finalizer → END
      graph.addEdge(asNode("coder"), asNode(TOOL_GATE_CODE));
      graph.addEdge(asNode(TOOL_GATE_CODE), asNode("tester"));
    } else {
      graph.addEdge(asNode("coder"), asNode("tester"));
    }
    graph.addEdge(asNode("tester"), asNode("reviewer"));
    graph.addEdge(asNode("reviewer"), asNode("writer"));
    graph.addEdge(asNode("writer"), asNode(APPROVAL_GATE));
  } else {
    // research
    graph.addEdge(START, asNode("planner"));
    graph.addEdge(asNode("planner"), asNode("researcher"));
    if (hitlMode === "tool") {
      // START → planner → researcher → [tool_research_gate *HITL*] → analyst → writer → reviewer → [approval_gate *HITL*] → finalizer → END
      graph.addEdge(asNode("researcher"), asNode(TOOL_GATE_RESEARCH));
      graph.addEdge(asNode(TOOL_GATE_RESEARCH), asNode("analyst"));
    } else {
      graph.addEdge(asNode("researcher"), asNode("analyst"));
    }
    graph.addEdge(asNode("analyst"), asNode("writer"));
    graph.addEdge(asNode("writer"), asNode("reviewer"));
    graph.addEdge(asNode("reviewer"), asNode(APPROVAL_GATE));
  }

  graph.addEdge(asNode(APPROVAL_GATE), asNode("finalizer"));
  graph.addEdge(asNode("finalizer"), END);

  return graph.compile({
    checkpointer: globalCheckpointer,
    interruptBefore: interruptBefore as never[],
  });
}

// ============================================================
// 辅助：执行 invoke 并检测中断点
// ============================================================

async function runUntilPause(
  app: ReturnType<typeof buildHitlGraph>,
  input: Partial<HitlStateType> | null,
  threadId: string,
): Promise<{
  state: HitlStateType;
  paused: boolean;
  pausedAtNode?: string;
  rejected?: boolean;
}> {
  const config = { configurable: { thread_id: threadId } };
  try {
    await app.invoke(input, config);
  } catch (err) {
    // LangGraph 在 interrupt 点会抛 GraphInterrupt（部分版本行为）
    if (!(err instanceof GraphInterrupt)) throw err;
  }

  // 检查当前状态，判断是否暂停以及在哪个节点暂停
  const currentState = await app.getState(config);
  const nextNodes: string[] = (currentState.next as string[]) || [];
  const values = currentState.values as HitlStateType;

  // 如果 approval 被置为 rejected 且下一个节点是 END，则视为已拒绝
  if (values.approval === "rejected" && (!nextNodes.length || nextNodes.includes(END))) {
    return { state: values, paused: false, rejected: true };
  }

  // 如果没有下一个节点且 finalAnswer 存在 → 已完成
  if (!nextNodes.length && values.finalAnswer) {
    return { state: values, paused: false };
  }

  // 否则是在 interruptBefore 点暂停
  const pausedAtNode = nextNodes[0];
  return { state: values, paused: Boolean(pausedAtNode), pausedAtNode };
}

// ============================================================
// HITLWorkflowEngine —— 对外接口
// ============================================================

export interface HitlEngineOptions {
  goal: string;
  workflowTemplateId?: string;
  threadId?: string;
  onEvent?: (event: MaEvent) => void;
  hitlMode?: HitlMode;
  llmConfig?: ProviderConfig;
}

export class HITLWorkflowEngine {
  private template: WorkflowTemplate;
  private goal: string;
  private onEvent: (event: MaEvent) => void;
  private runId: string;
  private threadId: string;
  private startedAt: number;
  private hitlMode: HitlMode;
  private llmConfig?: ProviderConfig;

  constructor(options: HitlEngineOptions) {
    this.goal = options.goal;
    this.onEvent = options.onEvent || (() => {});
    this.runId = nanoid(12);
    this.threadId = options.threadId || nanoid(12);
    this.startedAt = Date.now();
    this.hitlMode = options.hitlMode ?? "final";
    this.llmConfig = options.llmConfig;
    this.template =
      getWorkflowTemplate(options.workflowTemplateId || "research-analysis") ||
      getWorkflowTemplate("research-analysis")!;
  }

  getRunId(): string {
    return this.runId;
  }
  getThreadId(): string {
    return this.threadId;
  }
  getTemplate(): WorkflowTemplate {
    return this.template;
  }
  getHitlMode(): HitlMode {
    return this.hitlMode;
  }

  async start(): Promise<{
    runId: string;
    threadId: string;
    status: "paused";
    pausedAt: string;
    pausedReason: string;
    hitlMode: HitlMode;
    pendingToolCall?: { toolName: string; toolInput: string; agentRole: string };
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
        threadId: this.threadId,
        hitl: true,
        hitlMode: this.hitlMode,
      },
    });

    threadStore.set(this.threadId, {
      threadId: this.threadId,
      runId: this.runId,
      goal: this.goal,
      templateId: this.template.id,
      templateName: this.template.name,
      status: "running",
      hitlMode: this.hitlMode,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const app = buildHitlGraph(
      this.template,
      this.hitlMode,
      this.onEvent,
      this.runId,
      this.llmConfig,
    );

    const initialState: Partial<HitlStateType> = {
      goal: this.goal,
      templateId: this.template.id,
      currentAgent: "planner",
      agentOutputs: {},
      steps: [],
      reviewCount: 0,
      reviewPassed: false,
      finalAnswer: "",
      runId: this.runId,
      threadId: this.threadId,
      approval: "pending",
      pausedReason: null,
      pendingToolCall: null,
      hitlMode: this.hitlMode,
      lastAgentWithTool: null,
    };

    const { paused, pausedAtNode, state } = await runUntilPause(app, initialState, this.threadId);

    const meta = threadStore.get(this.threadId)!;
    if (paused && pausedAtNode) {
      const isToolGate = pausedAtNode.startsWith("tool_");
      meta.status = "paused";
      meta.pausedAt = pausedAtNode;
      meta.pausedReason = isToolGate ? "tool_call" : "final_review";
      if (isToolGate && state.pendingToolCall) {
        meta.pendingToolCall = state.pendingToolCall;
      }
      meta.updatedAt = Date.now();

      this.onEvent({
        type: "log",
        runId: this.runId,
        timestamp: Date.now(),
        data: {
          message: isToolGate
            ? `[HITL] 工作流已暂停于工具审批门（${state.pendingToolCall?.agentRole} 准备调用 ${state.pendingToolCall?.toolName}）`
            : "[HITL] 工作流已暂停，等待终稿审批",
          threadId: this.threadId,
          pausedAt: pausedAtNode,
          hitlMode: this.hitlMode,
          pendingToolCall: state.pendingToolCall ?? undefined,
        },
      });

      return {
        runId: this.runId,
        threadId: this.threadId,
        status: "paused",
        pausedAt: pausedAtNode,
        pausedReason: isToolGate ? "tool_call" : "final_review",
        hitlMode: this.hitlMode,
        pendingToolCall: state.pendingToolCall ?? undefined,
      };
    }

    meta.status = "completed";
    meta.updatedAt = Date.now();
    return {
      runId: this.runId,
      threadId: this.threadId,
      status: "paused",
      pausedAt: APPROVAL_GATE,
      pausedReason: "final_review",
      hitlMode: this.hitlMode,
    };
  }

  static async resume(
    threadId: string,
    decision: "approved" | "rejected",
    onEvent?: (event: MaEvent) => void,
    llmConfig?: ProviderConfig,
  ): Promise<{
    threadId: string;
    status: "paused" | "completed" | "rejected";
    pausedAt?: string;
    pausedReason?: string;
    finalAnswer?: string;
    pendingToolCall?: { toolName: string; toolInput: string; agentRole: string };
  }> {
    const meta = threadStore.get(threadId);
    if (!meta) throw new Error(`未找到 thread: ${threadId}`);
    if (meta.status !== "paused") throw new Error(`thread 状态非 paused，当前：${meta.status}`);

    const eventCb = onEvent || (() => {});
    const template = getWorkflowTemplate(meta.templateId || "research-analysis")!;

    eventCb({
      type: "log",
      runId: meta.runId,
      timestamp: Date.now(),
      data: { message: `[HITL] 收到审批决定：${decision}（${meta.hitlMode} 模式）`, threadId },
    });

    const app = buildHitlGraph(template, meta.hitlMode, eventCb, meta.runId, llmConfig);

    // 传入审批决定，驱动图继续执行（approval 在 tool gate 节点内会被重置为 pending）
    const { paused, pausedAtNode, state, rejected } = await runUntilPause(
      app,
      { approval: decision },
      threadId,
    );

    if (rejected || decision === "rejected") {
      meta.status = "rejected";
      meta.updatedAt = Date.now();
      return { threadId, status: "rejected" };
    }

    if (paused && pausedAtNode) {
      // 又暂停了（下一个 gate 点）—— 这是工具审批模式下可能出现的：通过了 tool gate 后继续到 approval_gate
      const isToolGate = pausedAtNode.startsWith("tool_");
      meta.status = "paused";
      meta.pausedAt = pausedAtNode;
      meta.pausedReason = isToolGate ? "tool_call" : "final_review";
      meta.pendingToolCall = state.pendingToolCall ?? undefined;
      meta.updatedAt = Date.now();

      eventCb({
        type: "log",
        runId: meta.runId,
        timestamp: Date.now(),
        data: {
          message: isToolGate
            ? `[HITL] 工作流已暂停于下一个工具审批门（${state.pendingToolCall?.agentRole} 准备调用 ${state.pendingToolCall?.toolName}）`
            : "[HITL] 工作流已暂停，等待终稿审批",
          threadId,
          pausedAt: pausedAtNode,
          hitlMode: meta.hitlMode,
          pendingToolCall: state.pendingToolCall ?? undefined,
        },
      });

      return {
        threadId,
        status: "paused",
        pausedAt: pausedAtNode,
        pausedReason: isToolGate ? "tool_call" : "final_review",
        pendingToolCall: state.pendingToolCall ?? undefined,
      };
    }

    meta.status = "completed";
    meta.updatedAt = Date.now();
    return { threadId, status: "completed", finalAnswer: state.finalAnswer };
  }

  static async getStateHistory(threadId: string): Promise<{
    threadId: string;
    checkpoints: Array<{
      checkpointId: string;
      createdAt: number;
      nextStep: string[];
      stepCount: number;
    }>;
    currentStatus: string;
    hitlMode?: string;
  }> {
    const meta = threadStore.get(threadId);
    const template = meta
      ? getWorkflowTemplate(meta.templateId || "research-analysis")!
      : getWorkflowTemplate("research-analysis")!;

    const app = buildHitlGraph(
      template,
      meta?.hitlMode ?? "final",
      () => {},
      meta?.runId ?? "dummy",
      undefined,
    );
    const config = { configurable: { thread_id: threadId } };

    const historyIter = await app.getStateHistory(config);
    const checkpoints: Array<{
      checkpointId: string;
      createdAt: number;
      nextStep: string[];
      stepCount: number;
    }> = [];

    for await (const state of historyIter) {
      const values = (state.values || {}) as Partial<HitlStateType>;
      checkpoints.push({
        checkpointId: state.config.configurable?.checkpoint_id || "",
        createdAt: values.steps?.[0]?.startedAt || Date.now(),
        nextStep: (state.next as string[]) || [],
        stepCount: values.steps?.length || 0,
      });
    }

    return {
      threadId,
      checkpoints,
      currentStatus: meta?.status || "unknown",
      hitlMode: meta?.hitlMode,
    };
  }

  static async rollback(
    threadId: string,
    checkpointId: string,
    onEvent?: (event: MaEvent) => void,
  ): Promise<{ threadId: string; checkpointId: string; message: string }> {
    const meta = threadStore.get(threadId);
    if (!meta) throw new Error(`未找到 thread: ${threadId}`);

    const eventCb = onEvent || (() => {});
    eventCb({
      type: "log",
      runId: meta.runId,
      timestamp: Date.now(),
      data: { message: `[时间旅行] 回滚到 checkpoint: ${checkpointId}`, threadId },
    });

    const template = getWorkflowTemplate(meta.templateId || "research-analysis")!;
    const app = buildHitlGraph(template, meta.hitlMode, eventCb, meta.runId, undefined);

    await app.invoke(null, {
      configurable: { thread_id: threadId, checkpoint_id: checkpointId },
    });

    meta.status = "running";
    meta.updatedAt = Date.now();
    return { threadId, checkpointId, message: `已从 checkpoint ${checkpointId} 恢复执行` };
  }

  static listThreads(): ThreadMetadata[] {
    return Array.from(threadStore.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  static getThread(threadId: string): ThreadMetadata | undefined {
    return threadStore.get(threadId);
  }
}

// ============================================================
// 学习辅助：HITL 对比表
// ============================================================

export function getHitlComparison() {
  return {
    selfBuilt: {
      name: "自研 requireConfirm",
      file: "src/server/tools/types.ts + agent-engine.ts",
      mechanism: "Tool.requireConfirm 标记 + 前端确认弹窗",
      scope: "仅单个工具调用",
      persistence: "无（页面刷新即丢失）",
      timeTravel: "无",
      resume: "无（必须重新开始）",
      approvalLevels: "1 级（工具调用前）",
    },
    langgraph: {
      name: "LangGraph interrupt_before + MemorySaver",
      file: "src/server/langchain/checkpoint.ts",
      mechanism: "compile({ interruptBefore }) + gate 节点 + checkpointer 自动保存",
      scope: "任意节点级（终稿审批 / 工具审批 / 自定义节点）",
      persistence: "MemorySaver 内存 / PostgresSaver 持久化",
      timeTravel: "getStateHistory + rollback 到任意 checkpoint",
      resume: "app.invoke({ approval }, { thread_id }) 自动续跑，支持多次暂停",
      approvalLevels: "2 级（终稿审批 + 工具调用审批，可叠加）",
    },
    hitlModes: [
      {
        mode: "final",
        name: "终稿审批",
        description: "所有 Agent 执行完毕、输出终稿前暂停审批",
        interruptBefore: [APPROVAL_GATE],
        graphFlow: "planner → ...agents... → reviewer → [approval_gate 暂停] → finalizer → END",
        compareTo: "自研无对应机制（只能看最终结果）",
      },
      {
        mode: "tool",
        name: "工具调用审批",
        description: "使用工具的 Agent 输出后暂停，审批工具调用；所有 Agent 结束后还有终稿审批",
        interruptBeforeResearch: [TOOL_GATE_RESEARCH, APPROVAL_GATE],
        interruptBeforeCode: [TOOL_GATE_CODE, APPROVAL_GATE],
        graphFlowResearch:
          "planner → researcher → [tool_research_gate 暂停] → analyst → writer → reviewer → [approval_gate 暂停] → finalizer → END",
        graphFlowCode:
          "planner → coder → [tool_code_gate 暂停] → tester → reviewer → writer → [approval_gate 暂停] → finalizer → END",
        compareTo: "自研 Tool.requireConfirm 机制（但无持久化/续跑）",
      },
    ],
    keyLearningPoint:
      "interrupt_before 作用于 gate 节点而非 agent 节点本身，因为 gate 节点可以访问 agent 的输出（state.pendingToolCall）做决策；gate 通过后需要将 approval 重置为 pending，以便后续 gate 再次触发中断。",
  };
}
