// 核心类型定义

export type Role = "system" | "user" | "assistant" | "tool";

/** Plan 步骤 */
export interface PlanItem {
  id: string;
  title: string;
  status: "pending" | "running" | "done";
}

/** M4: 附件类型 */
export interface Attachment {
  id: string;
  type: "file" | "image";
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
  fileId?: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  name?: string; // tool 名称
  toolCallId?: string;
  toolCalls?: ToolCallRecord[];
  thoughts?: string[];
  /** M3：计划清单 */
  plans?: PlanItem[];
  /** M3：反思 */
  reflections?: Array<{ score: number; critique: string; revise: boolean }>;
  /** M4：附件列表 */
  attachments?: Attachment[];
  createdAt: number;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  /** OpenAI Function Calling 协议中的标准描述 */
  definition?: { name: string; description: string; parameters: Record<string, unknown> };
}

/** 工具调用记录（带 UI 状态）—— 前端 Message.toolCalls 存这种形态 */
export interface ToolCallRecord {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
  status: "pending" | "running" | "success" | "error";
  durationMs?: number;
  startedAt: number;
  finishedAt?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export type AgentStep =
  | {
      kind: "plan";
      todos: Array<{ id: string; title: string; status: "pending" | "running" | "done" }>;
    }
  | { kind: "thought"; content: string }
  | { kind: "tool_call"; name: string; args: Record<string, unknown>; requireConfirm?: boolean }
  | { kind: "tool_result"; name: string; result: unknown; error?: string }
  | { kind: "reflection"; score: number; critique: string; revise: boolean }
  | { kind: "delta"; content: string }
  | { kind: "done"; usage: { prompt: number; completion: number; total: number }; runId: string }
  | { kind: "error"; message: string }
  | {
      kind: "memory_injection";
      memories: Array<{
        id: string;
        summary: string;
        kind: "short" | "long" | "episodic";
        similarity: number;
      }>;
    };

export type ChatChunk = AgentStep;

export interface ChatRequest {
  sessionId?: string;
  agentId?: string;
  messages: Array<{ role: Role; content: string; attachments?: Attachment[] }>;
  stream?: boolean;
  enablePlan?: boolean;
  enableReflection?: boolean;
  requireHITL?: string[];
  model?: string;
  temperature?: number;
  tools?: ToolDefinition[];
}

export interface Agent {
  id: string;
  slug: string;
  name: string;
  description?: string;
  systemPrompt: string;
  config: {
    enablePlan?: boolean;
    enableReflection?: boolean;
    maxSteps?: number;
    requireHITL?: string[];
  };
  published: boolean;
  avatar?: string;
  tags?: string[];
}

export interface Session {
  id: string;
  title: string;
  agentId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Memory {
  id: string;
  kind: "long" | "episodic";
  content: string;
  importance: number;
  createdAt: number;
}
