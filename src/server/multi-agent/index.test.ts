// 多智能体模块单元测试

import { describe, it, expect } from "vitest";
import { PRESET_AGENTS, getAgentByRole } from "./agents";
import { WORKFLOW_TEMPLATES, getWorkflowTemplate } from "./workflow-templates";
import { MessageBus } from "./message-bus";

describe("Agent 定义", () => {
  it("应有 8 个预置 Agent", () => {
    expect(PRESET_AGENTS).toHaveLength(8);
  });

  it("每个 Agent 应有必需字段", () => {
    for (const agent of PRESET_AGENTS) {
      expect(agent.role).toBeTruthy();
      expect(agent.name).toBeTruthy();
      expect(agent.systemPrompt).toBeTruthy();
      expect(agent.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(agent.icon).toBeTruthy();
      expect(typeof agent.temperature).toBe("number");
      expect(agent.temperature).toBeGreaterThanOrEqual(0);
      expect(agent.temperature).toBeLessThanOrEqual(1);
    }
  });

  it("getAgentByRole 应正确返回", () => {
    const planner = getAgentByRole("planner");
    expect(planner).toBeDefined();
    expect(planner?.name).toBe("规划专家");

    const notFound = getAgentByRole("nonexistent");
    expect(notFound).toBeUndefined();
  });

  it("角色不应重复", () => {
    const roles = PRESET_AGENTS.map((a) => a.role);
    const unique = new Set(roles);
    expect(unique.size).toBe(roles.length);
  });
});

describe("工作流模板", () => {
  it("应有 3 种内置模板", () => {
    expect(WORKFLOW_TEMPLATES).toHaveLength(3);
  });

  it("每个模板应有阶段和任务", () => {
    for (const template of WORKFLOW_TEMPLATES) {
      expect(template.stages.length).toBeGreaterThan(0);
      for (const stage of template.stages) {
        expect(stage.name).toBeTruthy();
        expect(stage.tasks.length).toBeGreaterThan(0);
        for (const task of stage.tasks) {
          expect(task.title).toBeTruthy();
          expect(task.assignee).toBeTruthy();
          expect(task.description).toBeTruthy();
        }
      }
    }
  });

  it("getWorkflowTemplate 应正确返回", () => {
    const research = getWorkflowTemplate("research-analysis");
    expect(research).toBeDefined();
    expect(research?.name).toBe("研究分析流");

    const notFound = getWorkflowTemplate("nonexistent");
    expect(notFound).toBeUndefined();
  });

  it("所有任务的 assignee 应在预置 Agent 中存在", () => {
    const validRoles = new Set(PRESET_AGENTS.map((a) => a.role));
    for (const template of WORKFLOW_TEMPLATES) {
      for (const stage of template.stages) {
        for (const task of stage.tasks) {
          expect(validRoles.has(task.assignee)).toBe(true);
        }
      }
    }
  });
});

describe("MessageBus", () => {
  it("publish/subscribe 应正确工作", () => {
    const bus = new MessageBus();
    const received: string[] = [];

    bus.subscribe((msg) => {
      received.push(msg.content);
    });

    bus.publish({ from: "planner", type: "result", content: "计划完成" });
    bus.publish({ from: "researcher", type: "info", content: "研究完成" });

    expect(received).toEqual(["计划完成", "研究完成"]);
  });

  it("getByStage 应按阶段过滤", () => {
    const bus = new MessageBus();
    bus.publish({ from: "planner", type: "result", content: "阶段0", stageIndex: 0 });
    bus.publish({ from: "researcher", type: "result", content: "阶段1", stageIndex: 1 });

    const stage0 = bus.getByStage(0);
    expect(stage0).toHaveLength(1);
    expect(stage0[0].content).toBe("阶段0");
  });

  it("getResults 应只返回 result 类型", () => {
    const bus = new MessageBus();
    bus.publish({ from: "planner", type: "result", content: "结果" });
    bus.publish({ from: "researcher", type: "info", content: "信息" });
    bus.publish({ from: "analyst", type: "error", content: "错误" });

    const results = bus.getResults();
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("结果");
  });

  it("clear 应清空所有消息", () => {
    const bus = new MessageBus();
    bus.publish({ from: "planner", type: "info", content: "test" });
    expect(bus.getAll()).toHaveLength(1);

    bus.clear();
    expect(bus.getAll()).toHaveLength(0);
  });
});
