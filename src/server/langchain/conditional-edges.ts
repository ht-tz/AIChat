// M18 补全：addConditionalEdges 条件路由示例
// 学习目标：LangGraph 的条件边 vs 自研固定顺序
// 对比自研：src/server/multi-agent/workflow-engine.ts（for 循环固定顺序，无回环）
//
// 核心概念：
// 1. addConditionalEdges(from, routerFn) —— 根据 state 动态决定下一个节点
// 2. 回环（loop） —— reviewer 不通过则回到 writer 重写
// 3. 路由函数签名：(state) => "next_node" | END
//
// 本文件实现两个经典条件路由示例：
// 示例 1：评审回环（writer → reviewer → writer/END）
// 示例 2：智能分流（router 节点分发到不同专家）

import { StateGraph, END, START, Annotation } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { nanoid } from "nanoid";
import { getAgentByRole } from "@/server/multi-agent/agents";
import type { MaEvent, MaStep } from "@/server/multi-agent/workflow-engine";

// ============================================================
// 1. State 定义
// ============================================================

const LoopState = Annotation.Root({
  goal: Annotation<string>,
  currentContent: Annotation<string>, // 当前内容（writer 输出）
  reviewScore: Annotation<number>, // 评审分数 0-10
  reviewCritique: Annotation<string>, // 评审意见
  reviewPassed: Annotation<boolean>, // 是否通过
  iterations: Annotation<number>, // 迭代次数
  steps: Annotation<MaStep[]>,
  runId: Annotation<string>,
  maxIterations: Annotation<number>, // 最大迭代次数（防死循环）
});

type LoopStateType = typeof LoopState.State;

// ============================================================
// 2. 节点：Writer（写作）
// ============================================================

function createWriterNode(onEvent: (event: MaEvent) => void, runId: string) {
  return async (state: LoopStateType): Promise<Partial<LoopStateType>> => {
    const agent = getAgentByRole("writer");
    if (!agent) throw new Error("writer agent not found");

    const stepId = nanoid(8);
    const iter = state.iterations + 1;
    onEvent({
      type: "log",
      runId,
      timestamp: Date.now(),
      data: {
        message: `[Writer] 第 ${iter} 轮写作开始`,
        stepId,
        iteration: iter,
      },
    });

    const startedAt = Date.now();
    const model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY ?? "",
      configuration: { baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1" },
      modelName: process.env.DEFAULT_MODEL ?? "gpt-4o-mini",
      temperature: 0.7,
    });

    const userPrompt =
      state.iterations === 0
        ? `请为以下主题写一篇文章：\n${state.goal}`
        : `根据评审意见修改文章：\n\n【当前内容】\n${state.currentContent}\n\n【评审意见】\n${state.reviewCritique}`;

    const response = await model.invoke([
      { role: "system", content: agent.systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    const content =
      typeof response.content === "string" ? response.content : JSON.stringify(response.content);
    const completedAt = Date.now();

    const step: MaStep = {
      id: stepId,
      runId,
      stageIndex: state.iterations,
      stepIndex: 0,
      agentRole: "writer",
      agentName: "写作专家",
      status: "completed",
      input: userPrompt,
      output: content,
      durationMs: completedAt - startedAt,
      startedAt,
      completedAt,
    };

    return {
      currentContent: content,
      iterations: iter,
      steps: [...state.steps, step],
    };
  };
}

// ============================================================
// 3. 节点：Reviewer（评审）
// ============================================================

function createReviewerNode(onEvent: (event: MaEvent) => void, runId: string) {
  return async (state: LoopStateType): Promise<Partial<LoopStateType>> => {
    const agent = getAgentByRole("reviewer");
    if (!agent) throw new Error("reviewer agent not found");

    const stepId = nanoid(8);
    onEvent({
      type: "log",
      runId,
      timestamp: Date.now(),
      data: {
        message: `[Reviewer] 第 ${state.iterations} 轮评审开始`,
        stepId,
        iteration: state.iterations,
      },
    });

    const startedAt = Date.now();
    const model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY ?? "",
      configuration: { baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1" },
      modelName: process.env.DEFAULT_MODEL ?? "gpt-4o-mini",
      temperature: 0.3,
    });

    // 结构化输出：评审结果（分数 + 意见 + 是否通过）
    const reviewPrompt = `请评审以下文章，给出分数（0-10）和改进意见。

【主题】${state.goal}

【文章内容】
${state.currentContent}

请以 JSON 格式输出：
{
  "score": 0,
  "critique": "具体改进意见",
  "passed": false
}
通过标准：score >= 7.0`;

    const response = await model.invoke([
      { role: "system", content: agent.systemPrompt + "\n\n你需要以严格 JSON 格式输出评审结果。" },
      { role: "user", content: reviewPrompt },
    ]);

    const text =
      typeof response.content === "string" ? response.content : JSON.stringify(response.content);
    let score = 0;
    let critique = "解析失败";
    let passed = false;

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        score = Number(parsed.score) || 0;
        critique = parsed.critique || String(text);
        passed = !!parsed.passed || score >= 7.0;
      }
    } catch {
      // 解析失败时根据文本猜测
      const scoreMatch = text.match(/(\d+(\.\d+)?)\s*\/?\s*1?0?/);
      if (scoreMatch) score = Number(scoreMatch[1]);
      critique = text;
      passed = score >= 7.0;
    }

    const completedAt = Date.now();
    const step: MaStep = {
      id: stepId,
      runId,
      stageIndex: state.iterations,
      stepIndex: 1,
      agentRole: "reviewer",
      agentName: "评审专家",
      status: "completed",
      input: `评审第 ${state.iterations} 版内容`,
      output: JSON.stringify({ score, critique, passed }),
      durationMs: completedAt - startedAt,
      startedAt,
      completedAt,
    };

    onEvent({
      type: "log",
      runId,
      timestamp: Date.now(),
      data: {
        message: `[Reviewer] 评分 ${score}/10 - ${passed ? "通过" : "不通过"}`,
        stepId,
        score,
        passed,
      },
    });

    return {
      reviewScore: score,
      reviewCritique: critique,
      reviewPassed: passed,
      steps: [...state.steps, step],
    };
  };
}

// ============================================================
// 4. 路由函数：评审后决定去向
// ============================================================
// 学习点：这是 addConditionalEdges 的核心
// 自研没有对应机制（for 循环固定顺序，无法动态跳转）

function reviewRouter(state: LoopStateType): string {
  // 达到最大迭代次数，强制结束（防死循环）
  if (state.iterations >= state.maxIterations) {
    return "END";
  }
  // 通过评审 → 结束
  if (state.reviewPassed) {
    return "END";
  }
  // 未通过 → 回到 writer 重写（回环！）
  return "writer";
}

// ============================================================
// 5. 构建回环图
// ============================================================

export function buildReviewLoopGraph(onEvent: (event: MaEvent) => void, runId: string) {
  const graph = new StateGraph(LoopState);

  graph.addNode("writer", createWriterNode(onEvent, runId));
  graph.addNode("reviewer", createReviewerNode(onEvent, runId));

  graph.addEdge(START, "writer" as "__start__");
  graph.addEdge("writer" as "__start__", "reviewer" as "__start__");

  // 关键：条件边 —— reviewer 后根据结果决定去向
  // 1. 通过 → END
  // 2. 不通过 → writer（回环）
  // 3. 达到最大迭代 → END
  graph.addConditionalEdges("reviewer" as "__start__", reviewRouter, {
    writer: "writer" as "__start__",
    END,
  });

  return graph.compile();
}

// ============================================================
// 6. 运行回环工作流
// ============================================================

export interface ReviewLoopOptions {
  goal: string;
  maxIterations?: number;
  onEvent?: (event: MaEvent) => void;
}

export async function runReviewLoop(options: ReviewLoopOptions): Promise<{
  runId: string;
  finalContent: string;
  finalScore: number;
  iterations: number;
  passed: boolean;
  steps: MaStep[];
}> {
  const runId = nanoid(12);
  const onEvent = options.onEvent || (() => {});
  const maxIterations = options.maxIterations ?? 3;

  onEvent({
    type: "run_started",
    runId,
    timestamp: Date.now(),
    data: {
      goal: options.goal,
      totalStages: 2,
      totalSteps: 0,
      stages: [
        {
          name: "writer",
          description: "写作专家",
          tasks: [{ assignee: "writer", description: options.goal }],
        },
        {
          name: "reviewer",
          description: "评审专家",
          tasks: [{ assignee: "reviewer", description: "评审文章" }],
        },
      ],
      note: `评审回环模式，最多 ${maxIterations} 轮`,
    },
  });

  const app = buildReviewLoopGraph(onEvent, runId);
  const finalState = await app.invoke({
    goal: options.goal,
    currentContent: "",
    reviewScore: 0,
    reviewCritique: "",
    reviewPassed: false,
    iterations: 0,
    steps: [],
    runId,
    maxIterations,
  });

  onEvent({
    type: "run_completed",
    runId,
    timestamp: Date.now(),
    data: {
      status: finalState.reviewPassed ? "completed" : "completed_with_max_iter",
      finalAnswer: finalState.currentContent,
      completedSteps: finalState.steps.length,
      iterations: finalState.iterations,
      score: finalState.reviewScore,
    },
  });

  return {
    runId,
    finalContent: finalState.currentContent,
    finalScore: finalState.reviewScore,
    iterations: finalState.iterations,
    passed: finalState.reviewPassed,
    steps: finalState.steps,
  };
}

// ============================================================
// 7. 第二个示例：智能分流图（Router 模式）
// ============================================================
// 学习点：一个 router 节点，根据用户意图分发到不同专家

const RouterState = Annotation.Root({
  query: Annotation<string>,
  category: Annotation<"code" | "writing" | "analysis" | "general">,
  answer: Annotation<string>,
  runId: Annotation<string>,
});

type RouterStateType = typeof RouterState.State;

function createRouterNode(onEvent: (event: MaEvent) => void, runId: string) {
  return async (state: RouterStateType): Promise<Partial<RouterStateType>> => {
    onEvent({
      type: "log",
      runId,
      timestamp: Date.now(),
      data: { message: "[Router] 分析用户意图...", query: state.query },
    });

    const model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY ?? "",
      configuration: { baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1" },
      modelName: process.env.DEFAULT_MODEL ?? "gpt-4o-mini",
      temperature: 0,
    });

    const response = await model.invoke([
      {
        role: "system",
        content: `你是一个意图分类器。将用户问题分类为以下类别之一：
- code: 编程、代码、技术实现
- writing: 写作、文章、文案、内容创作
- analysis: 分析、研究、报告、数据解读
- general: 其他通用问题

只输出类别名称，不要输出其他内容。`,
      },
      { role: "user", content: state.query },
    ]);

    const raw =
      typeof response.content === "string" ? response.content.trim().toLowerCase() : "general";
    const category = (
      ["code", "writing", "analysis"].includes(raw) ? raw : "general"
    ) as RouterStateType["category"];

    onEvent({
      type: "log",
      runId,
      timestamp: Date.now(),
      data: { message: `[Router] 分类结果: ${category}` },
    });

    return { category };
  };
}

function expertRouter(state: RouterStateType): string {
  return state.category;
}

function createExpertNode(
  role: string,
  name: string,
  onEvent: (e: MaEvent) => void,
  runId: string,
) {
  return async (state: RouterStateType): Promise<Partial<RouterStateType>> => {
    const agent = getAgentByRole(role as any) || {
      systemPrompt: `你是${name}，专业回答${role}相关问题。`,
    };

    onEvent({
      type: "log",
      runId,
      timestamp: Date.now(),
      data: { message: `[${name}] 回答问题...` },
    });

    const model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY ?? "",
      configuration: { baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1" },
      modelName: process.env.DEFAULT_MODEL ?? "gpt-4o-mini",
      temperature: 0.7,
    });

    const response = await model.invoke([
      { role: "system", content: agent.systemPrompt },
      { role: "user", content: state.query },
    ]);

    const answer =
      typeof response.content === "string" ? response.content : JSON.stringify(response.content);
    return { answer };
  };
}

export function buildRouterGraph(onEvent: (event: MaEvent) => void, runId: string) {
  const graph = new StateGraph(RouterState);

  graph.addNode("router", createRouterNode(onEvent, runId));
  graph.addNode("code", createExpertNode("coder", "代码专家", onEvent, runId));
  graph.addNode("writing", createExpertNode("writer", "写作专家", onEvent, runId));
  graph.addNode("analysis", createExpertNode("analyst", "分析专家", onEvent, runId));
  graph.addNode("general", createExpertNode("researcher", "研究专家", onEvent, runId));

  graph.addEdge(START, "router" as "__start__");

  // 条件边：router → 分发到不同专家 → 汇合到 END
  graph.addConditionalEdges("router" as "__start__", expertRouter, {
    code: "code" as "__start__",
    writing: "writing" as "__start__",
    analysis: "analysis" as "__start__",
    general: "general" as "__start__",
  });

  graph.addEdge("code" as "__start__", END);
  graph.addEdge("writing" as "__start__", END);
  graph.addEdge("analysis" as "__start__", END);
  graph.addEdge("general" as "__start__", END);

  return graph.compile();
}

export async function runRouterGraph(
  query: string,
  onEvent?: (e: MaEvent) => void,
): Promise<{
  runId: string;
  category: string;
  answer: string;
}> {
  const runId = nanoid(12);
  const eventCb = onEvent || (() => {});
  const app = buildRouterGraph(eventCb, runId);
  const finalState = await app.invoke({ query, answer: "", runId, category: "general" });
  return {
    runId,
    category: finalState.category,
    answer: finalState.answer,
  };
}

// ============================================================
// 8. 学习辅助 —— 条件路由对比
// ============================================================

export function getConditionalEdgeComparison() {
  return {
    reviewLoop: {
      name: "评审回环（Review Loop）",
      diagram: "START → writer → reviewer → (passed → END | not passed → writer)",
      useCase: "需要迭代优化的任务（写作、设计、代码审查）",
      selfBuiltCapable: false,
      selfBuiltNote: "自研 WorkflowEngine 用 for 循环固定顺序，无法回环",
    },
    router: {
      name: "智能分流（Router Pattern）",
      diagram: "START → router → code/writing/analysis/general → END",
      useCase: "根据用户意图分发到不同专家/模型",
      selfBuiltCapable: false,
      selfBuiltNote: "自研需手写 if-else 路由逻辑，图结构更清晰",
    },
    otherPatterns: [
      "分支汇合（Fan-out/Fan-in）：并行节点 → 汇合节点",
      "条件回退（Fallback）：主路径失败 → 备用路径",
      "子图调用（Subgraph）：图中嵌套图",
      "Map-Reduce：批量处理 → 汇总结果",
    ],
    selfBuiltLimitation:
      "自研 WorkflowEngine 只支持「stage 串行 + stage 内并行」的固定模式，\n无法表达回环、条件分支、动态路由等复杂工作流。",
  };
}
