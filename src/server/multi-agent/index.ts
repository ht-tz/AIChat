// 多智能体协作模块 —— 统一导出

export {
  WorkflowEngine,
  type MaRun,
  type MaStep,
  type MaRunStatus,
  type MaStepStatus,
  type MaEvent,
  type MaEventType,
  type WorkflowEngineOptions,
} from "./workflow-engine";

export { PRESET_AGENTS, getAgentByRole, type AgentDefinition } from "./agents";

export {
  WORKFLOW_TEMPLATES,
  getWorkflowTemplate,
  type WorkflowTemplate,
  type WorkflowStage,
  type WorkflowTask,
} from "./workflow-templates";

export { MessageBus, type BusMessage } from "./message-bus";
