// 多智能体工作流引擎 —— 阶段调度 + SSE 事件 + 运行追踪

import { nanoid } from "nanoid";
import { createProvider, type ProviderConfig } from "@/server/providers";
import { PRESET_AGENTS, getAgentByRole, type AgentDefinition } from "./agents";
import {
  WORKFLOW_TEMPLATES,
  getWorkflowTemplate,
  type WorkflowStage,
  type WorkflowTask,
} from "./workflow-templates";
import { MessageBus, type BusMessage } from "./message-bus";

export type MaRunStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type MaStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface MaStep {
  id: string;
  runId: string;
  stageIndex: number;
  stepIndex: number;
  agentRole: string;
  agentName: string;
  status: MaStepStatus;
  input?: string;
  output?: string;
  error?: string;
  durationMs?: number;
  startedAt?: number;
  completedAt?: number;
}

export interface MaRun {
  id: string;
  teamId?: string;
  goal: string;
  status: MaRunStatus;
  totalStages: number;
  completedStages: number;
  totalSteps: number;
  completedSteps: number;
  stages: WorkflowStage[];
  steps: MaStep[];
  finalAnswer?: string;
  error?: string;
  durationMs?: number;
  startedAt?: number;
  completedAt?: number;
  createdAt: number;
}

export type MaEventType =
  | "run_started"
  | "stage_started"
  | "agent_started"
  | "agent_delta"
  | "agent_completed"
  | "stage_completed"
  | "run_completed"
  | "run_failed"
  | "log";

export interface MaEvent {
  type: MaEventType;
  runId: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

type EventCallback = (event: MaEvent) => void;

export interface WorkflowEngineOptions {
  workflowTemplateId?: string;
  customStages?: WorkflowStage[];
  goal: string;
  teamId?: string;
  onEvent?: EventCallback;
  llmConfig?: ProviderConfig;
}

export class WorkflowEngine {
  private run: MaRun;
  private bus: MessageBus;
  private onEvent?: EventCallback;
  private llmConfig?: ProviderConfig;
  private cancelled = false;

  constructor(options: WorkflowEngineOptions) {
    this.llmConfig = options.llmConfig;
    let stages: WorkflowStage[];
    if (options.customStages && options.customStages.length > 0) {
      stages = options.customStages;
    } else if (options.workflowTemplateId) {
      const template = getWorkflowTemplate(options.workflowTemplateId);
      stages = template?.stages || WORKFLOW_TEMPLATES[0].stages;
    } else {
      stages = WORKFLOW_TEMPLATES[0].stages;
    }

    const steps: MaStep[] = [];
    stages.forEach((stage, sIdx) => {
      stage.tasks.forEach((task, tIdx) => {
        const agent = getAgentByRole(task.assignee);
        steps.push({
          id: nanoid(8),
          runId: "",
          stageIndex: sIdx,
          stepIndex: tIdx,
          agentRole: task.assignee,
          agentName: agent?.name || task.assignee,
          status: "pending",
          input: task.description,
        });
      });
    });

    const runId = nanoid(12);
    steps.forEach((s) => (s.runId = runId));

    this.run = {
      id: runId,
      teamId: options.teamId,
      goal: options.goal,
      status: "pending",
      totalStages: stages.length,
      completedStages: 0,
      totalSteps: steps.length,
      completedSteps: 0,
      stages,
      steps,
      createdAt: Date.now(),
    };

    this.bus = new MessageBus();
    this.onEvent = options.onEvent;
  }

  getRun(): MaRun {
    return { ...this.run };
  }

  getSteps(): MaStep[] {
    return [...this.run.steps];
  }

  cancel(): void {
    this.cancelled = true;
  }

  private emit(event: MaEvent): void {
    this.onEvent?.(event);
  }

  async execute(): Promise<MaRun> {
    if (this.run.status !== "pending") {
      return this.run;
    }

    this.run.status = "running";
    this.run.startedAt = Date.now();
    this.emit({
      type: "run_started",
      runId: this.run.id,
      timestamp: Date.now(),
      data: {
        goal: this.run.goal,
        totalStages: this.run.totalStages,
        totalSteps: this.run.totalSteps,
        stages: this.run.stages,
      },
    });

    try {
      for (let sIdx = 0; sIdx < this.run.stages.length; sIdx++) {
        if (this.cancelled) {
          this.run.status = "cancelled";
          break;
        }

        const stage = this.run.stages[sIdx];

        this.emit({
          type: "stage_started",
          runId: this.run.id,
          timestamp: Date.now(),
          data: { stageIndex: sIdx, stageName: stage.name, stageDescription: stage.description },
        });

        // 阶段内并行执行所有任务
        const stageStepIndices = this.run.steps
          .filter((s) => s.stageIndex === sIdx)
          .map((s) => this.run.steps.indexOf(s));

        const context = this.buildStageContext(sIdx);
        const taskPromises = stageStepIndices.map((stepIdx) => this.executeStep(stepIdx, context));
        await Promise.all(taskPromises);

        this.run.completedStages = sIdx + 1;

        // 汇总阶段结果到消息总线
        const stageSteps = this.run.steps.filter((s) => s.stageIndex === sIdx);
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

        this.emit({
          type: "stage_completed",
          runId: this.run.id,
          timestamp: Date.now(),
          data: {
            stageIndex: sIdx,
            stageName: stage.name,
            completedSteps: stageSteps.filter((s) => s.status === "completed").length,
            totalStepsInStage: stageSteps.length,
          },
        });
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
    this.run.durationMs = this.run.startedAt ? this.run.completedAt - this.run.startedAt : 0;

    this.emit({
      type: this.run.status === "failed" ? "run_failed" : "run_completed",
      runId: this.run.id,
      timestamp: Date.now(),
      data: {
        status: this.run.status,
        finalAnswer: this.run.finalAnswer,
        error: this.run.error,
        durationMs: this.run.durationMs,
        completedSteps: this.run.completedSteps,
      },
    });

    return this.run;
  }

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

    this.emit({
      type: "agent_started",
      runId: this.run.id,
      timestamp: Date.now(),
      data: {
        stepId: step.id,
        stageIndex: step.stageIndex,
        stepIndex: step.stepIndex,
        agentRole: step.agentRole,
        agentName: step.agentName,
      },
    });

    try {
      const userMessage = context
        ? `【全局目标】${this.run.goal}\n\n【当前任务】${step.input}\n\n【上下文信息】\n${context}`
        : `【全局目标】${this.run.goal}\n\n【当前任务】${step.input}`;

      // 使用流式输出的简化版：先完整获取再模拟 delta
      const result = await createProvider(this.llmConfig).complete({
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

      // 模拟流式 delta 事件（每 50ms 发一段，提升可视化效果）
      const chunks = this.splitIntoChunks(result.content, 15);
      for (const chunk of chunks) {
        if (this.cancelled) break;
        this.emit({
          type: "agent_delta",
          runId: this.run.id,
          timestamp: Date.now(),
          data: {
            stepId: step.id,
            delta: chunk,
          },
        });
        await new Promise((r) => setTimeout(r, 20));
      }

      this.emit({
        type: "agent_completed",
        runId: this.run.id,
        timestamp: Date.now(),
        data: {
          stepId: step.id,
          status: "completed",
          output: step.output,
          durationMs: step.durationMs,
        },
      });

      this.run.completedSteps += 1;
    } catch (err) {
      step.status = "failed";
      step.error = err instanceof Error ? err.message : String(err);
      step.completedAt = Date.now();
      step.durationMs = step.startedAt ? step.completedAt - step.startedAt : 0;

      this.emit({
        type: "agent_completed",
        runId: this.run.id,
        timestamp: Date.now(),
        data: {
          stepId: step.id,
          status: "failed",
          error: step.error,
        },
      });
    }
  }

  private splitIntoChunks(text: string, size: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += size) {
      chunks.push(text.slice(i, i + size));
    }
    return chunks;
  }

  private buildStageContext(currentStageIndex: number): string {
    if (currentStageIndex === 0) return "";

    const prevSteps = this.run.steps.filter(
      (s) => s.stageIndex < currentStageIndex && s.status === "completed",
    );
    if (prevSteps.length === 0) return "";

    return prevSteps
      .map(
        (s) =>
          `【${s.agentName}】(${Math.round((s.durationMs || 0) / 1000)}s)\n${(s.output || "").slice(0, 500)}${(s.output || "").length > 500 ? "..." : ""}`,
      )
      .join("\n\n");
  }

  private buildFinalAnswer(): string {
    const completedSteps = this.run.steps.filter((s) => s.status === "completed");
    if (completedSteps.length === 0) return "";

    // 取最后一个写作/输出类 Agent 的结果作为最终答案
    const writerStep = [...completedSteps]
      .reverse()
      .find((s) => s.agentRole === "writer" || s.agentRole === "coder");
    if (writerStep?.output) return writerStep.output;

    // 否则汇总所有完成步骤的输出
    return completedSteps.map((s) => `## ${s.agentName}\n\n${s.output}`).join("\n\n---\n\n");
  }
}

export { PRESET_AGENTS, WORKFLOW_TEMPLATES, getAgentByRole, getWorkflowTemplate };
export type { AgentDefinition, WorkflowStage, WorkflowTask, BusMessage };
