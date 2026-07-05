// 工具调用扩展类型 —— 在 M1 协议基础上补充 UI/调度所需字段
// ToolCall 来自 src/lib/types.ts，这里只补充展示/调度层的类型

/** 工具执行状态 */
export type ToolCallStatus = "pending" | "running" | "success" | "error";

/** 工具调用记录（带 UI 状态）—— 前端 Message.toolCalls 存储这种形态 */
export interface ToolCallRecord {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
  status: ToolCallStatus;
  durationMs?: number;
  startedAt: number;
  finishedAt?: number;
}

/** 工具注册接口 —— 一个工具就是一个对象 */
import type { z } from "zod";
import type { ToolDefinition } from "@/lib/types";

export interface ToolContext {
  /** 是否处于 abort 状态 */
  signal?: AbortSignal;
  /** 当前 sessionId（可写入工具审计日志） */
  sessionId?: string;
  /** 当前运行 id */
  runId?: string;
}

export interface Tool<TArgs extends z.ZodTypeAny = z.ZodTypeAny, TResult = unknown> {
  /** 工具名（全局唯一） */
  name: string;
  /** 工具描述，会发给 LLM */
  description: string;
  /** zod 参数 schema */
  parameters: TArgs;
  /** 真正执行的函数（同步结果或异步结果都会 await） */
  execute: (args: z.infer<TArgs>, ctx: ToolContext) => Promise<TResult>;
  /** 是否需要人类审批（用于 M7 HITL） */
  requireConfirm?: boolean;
  /** OpenAI Function Calling 协议中的标准描述（自动从 parameters 推导） */
  toDefinition(): ToolDefinition;
}
