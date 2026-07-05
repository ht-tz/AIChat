// 多 Agent 协作框架 —— 专家 Agent + 协调器模式

import { getProvider } from "@/server/providers";

export type AgentRole = "planner" | "researcher" | "analyst" | "writer" | "reviewer";

export interface ExpertAgent {
  role: AgentRole;
  name: string;
  systemPrompt: string;
  availableTools: string[];
}

export const EXPERT_AGENTS: ExpertAgent[] = [
  {
    role: "planner",
    name: "规划专家",
    systemPrompt:
      "你是一名任务规划专家。分析用户需求，将其分解为清晰的子任务，并指定每个子任务由哪个专家负责。输出格式为 JSON：{ tasks: [{ title, assignee, description }] }",
    availableTools: [],
  },
  {
    role: "researcher",
    name: "研究专家",
    systemPrompt:
      "你是一名研究专家。负责搜索信息、查阅文档、收集数据。使用搜索工具和知识库检索来获取所需信息。",
    availableTools: ["web_search", "read_file"],
  },
  {
    role: "analyst",
    name: "分析专家",
    systemPrompt:
      "你是一名分析专家。负责分析数据、识别模式、提出见解。使用计算器和代码运行器进行数据处理。",
    availableTools: ["calculator", "code_runner"],
  },
  {
    role: "writer",
    name: "写作专家",
    systemPrompt:
      "你是一名写作专家。负责撰写结构化报告、总结分析结果、生成高质量文档。使用总结报告工具生成最终输出。",
    availableTools: ["summarize_report"],
  },
  {
    role: "reviewer",
    name: "评审专家",
    systemPrompt:
      "你是一名评审专家。负责检查输出质量、验证事实准确性、提出改进建议。如果发现问题，返回修改意见；如果通过，返回认可。",
    availableTools: [],
  },
];

export interface CollaborationResult {
  success: boolean;
  finalAnswer: string;
  steps: Array<{ role: AgentRole; name: string; output: string }>;
  sources: string[];
}

export class MultiAgentCoordinator {
  private agents: Map<AgentRole, ExpertAgent>;

  constructor() {
    this.agents = new Map(EXPERT_AGENTS.map((a) => [a.role, a]));
  }

  getAgent(role: AgentRole): ExpertAgent | undefined {
    return this.agents.get(role);
  }

  listAgents(): ExpertAgent[] {
    return Array.from(this.agents.values());
  }

  async collaborate(goal: string): Promise<CollaborationResult> {
    const steps: Array<{ role: AgentRole; name: string; output: string }> = [];

    try {
      const planner = this.agents.get("planner");
      if (!planner) {
        return { success: false, finalAnswer: "规划专家不可用", steps: [], sources: [] };
      }

      const planResult = await getProvider().complete({
        messages: [
          { role: "system", content: planner.systemPrompt },
          { role: "user", content: `用户需求：${goal}\n\n请输出任务规划 JSON。` },
        ],
        jsonMode: true,
      });

      let plan: { tasks: Array<{ title: string; assignee: string; description: string }> };
      try {
        plan = JSON.parse(planResult.content);
      } catch {
        plan = { tasks: [{ title: "直接执行", assignee: "analyst", description: goal }] };
      }

      steps.push({ role: "planner", name: planner.name, output: JSON.stringify(plan, null, 2) });

      const taskOutputs: Record<string, string> = {};

      for (const task of plan.tasks) {
        const assigneeRole = task.assignee as AgentRole;
        const agent = this.agents.get(assigneeRole);
        if (!agent) continue;

        const context = Object.entries(taskOutputs)
          .map(([k, v]) => `${k}: ${v.slice(0, 200)}`)
          .join("\n");
        const agentInput = context
          ? `${task.description}\n\n已完成任务结果：\n${context}`
          : task.description;

        const agentResult = await getProvider().complete({
          messages: [
            { role: "system", content: agent.systemPrompt },
            { role: "user", content: agentInput },
          ],
        });

        taskOutputs[task.title] = agentResult.content;
        steps.push({ role: assigneeRole, name: agent.name, output: agentResult.content });
      }

      const reviewer = this.agents.get("reviewer");
      if (reviewer) {
        const reviewInput = `请评审以下工作成果：\n\n${JSON.stringify(taskOutputs, null, 2)}`;
        const reviewResult = await getProvider().complete({
          messages: [
            { role: "system", content: reviewer.systemPrompt },
            { role: "user", content: reviewInput },
          ],
        });
        steps.push({ role: "reviewer", name: reviewer.name, output: reviewResult.content });

        if (
          reviewResult.content.toLowerCase().includes("需要修改") ||
          reviewResult.content.toLowerCase().includes("问题")
        ) {
          return {
            success: false,
            finalAnswer: reviewResult.content,
            steps,
            sources: [],
          };
        }
      }

      const finalAnswer = Object.values(taskOutputs).join("\n\n");

      return {
        success: true,
        finalAnswer,
        steps,
        sources: [],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        finalAnswer: `协作失败：${msg}`,
        steps,
        sources: [],
      };
    }
  }
}

export const multiAgentCoordinator = new MultiAgentCoordinator();
