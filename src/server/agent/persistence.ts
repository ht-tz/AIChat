// Agent 推理持久化 —— 把每次 run 的 step 落 PostgreSQL
// 失败时仅 warn，不影响主流程

import { nanoid } from "nanoid";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  agentRuns,
  agentSteps,
  sessions as sessionsTable,
  toolCalls as toolCallsTable,
  type NewAgentRun,
  type NewAgentStep,
  type NewToolCall,
  type PlanItem,
} from "@/server/db/schema";
import type { AgentStep } from "@/lib/types";
import { logger } from "@/server/logger";

/** 自动 upsert session（保证 agent_runs.sessionId 外键不报） */
async function ensureSession(sessionId: string) {
  if (!db) return;
  try {
    const existing = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(sessionsTable).values({
        id: sessionId,
        title: "新会话",
      });
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "[persistence] ensureSession failed");
  }
}

export async function startRun(opts: {
  sessionId: string;
  userMessage: string;
  model: string;
  agentId?: string;
}): Promise<string | null> {
  if (!db) return null;
  try {
    await ensureSession(opts.sessionId);
    const [row] = await db
      .insert(agentRuns)
      .values({
        sessionId: opts.sessionId,
        agentId: opts.agentId,
        userMessage: opts.userMessage,
        model: opts.model,
        status: "running",
      } as NewAgentRun)
      .returning({ id: agentRuns.id });
    return row?.id ?? null;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "[persistence] startRun failed");
    return null;
  }
}

export async function persistStep(opts: {
  runId: string;
  stepIndex: number;
  step: AgentStep;
}): Promise<void> {
  if (!db || !opts.runId || opts.runId.startsWith("mock-")) return;
  try {
    const step = opts.step;
    const base = {
      runId: opts.runId,
      stepIndex: opts.stepIndex,
      kind: step.kind,
    };

    if (step.kind === "plan") {
      await db.insert(agentSteps).values({
        ...base,
        content: JSON.stringify(step.todos),
        payload: { todos: step.todos },
      } as NewAgentStep);
    } else if (step.kind === "thought") {
      await db.insert(agentSteps).values({
        ...base,
        content: step.content,
        payload: { content: step.content },
      } as NewAgentStep);
    } else if (step.kind === "tool_call") {
      const callId = `call_${nanoid(8)}`;
      await db.insert(toolCallsTable).values({
        runId: opts.runId,
        callId,
        toolName: step.name,
        args: step.args,
        status: "running",
        startedAt: new Date(),
      } as NewToolCall);
      await db.insert(agentSteps).values({
        ...base,
        kind: "tool_call",
        toolCallId: callId,
        content: step.name,
        payload: { name: step.name, args: step.args, requireConfirm: step.requireConfirm ?? false },
      } as NewAgentStep);
    } else if (step.kind === "tool_result") {
      await db.insert(agentSteps).values({
        ...base,
        content: step.name,
        payload: { name: step.name, result: step.result, error: step.error },
        durationMs: null,
      } as NewAgentStep);
      // 同步更新 tool_calls 表
      const setClause: Record<string, unknown> = {
        status: step.error ? "error" : "success",
        result: step.result,
        error: step.error ?? null,
        finishedAt: new Date(),
      };
      if (step.result !== undefined) setClause.result = step.result;
      await db
        .update(toolCallsTable)
        .set(setClause)
        .where(and(eq(toolCallsTable.runId, opts.runId), eq(toolCallsTable.toolName, step.name)));
    } else if (step.kind === "reflection") {
      await db.insert(agentSteps).values({
        ...base,
        content: step.critique,
        payload: { score: step.score, critique: step.critique, revise: step.revise },
      } as NewAgentStep);
    } else if (step.kind === "delta") {
      // delta 太多，只累积不每条落库（M9 优化：用 aggregate 字段）
    } else if (step.kind === "done") {
      await db.insert(agentSteps).values({
        ...base,
        content: `done: ${step.runId}`,
        payload: { usage: step.usage, runId: step.runId },
      } as NewAgentStep);
    } else if (step.kind === "error") {
      await db.insert(agentSteps).values({
        ...base,
        content: step.message,
        payload: { message: step.message },
      } as NewAgentStep);
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "[persistence] persistStep failed");
  }
}

export async function finishRun(opts: {
  runId: string;
  status: "success" | "error" | "aborted";
  totalRounds: number;
  plan: PlanItem[];
  reflectionScore: number | null;
  reflectionCritique: string | null;
  promptTokens: number;
  completionTokens: number;
}): Promise<void> {
  if (!db || !opts.runId || opts.runId.startsWith("mock-")) return;
  try {
    await db
      .update(agentRuns)
      .set({
        status: opts.status,
        totalRounds: opts.totalRounds,
        plan: opts.plan,
        reflectionScore: opts.reflectionScore,
        reflectionCritique: opts.reflectionCritique,
        promptTokens: opts.promptTokens,
        completionTokens: opts.completionTokens,
        totalTokens: opts.promptTokens + opts.completionTokens,
        finishedAt: new Date(),
      })
      .where(eq(agentRuns.id, opts.runId));
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "[persistence] finishRun failed");
  }
}
