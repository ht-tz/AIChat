// 工具调用调度器
// M3 升级：
//   1. 多轮工具调用（maxToolRounds=5）
//   2. Plan-and-Execute（plan 事件透传）
//   3. Reflexion 自反思（reflection 事件触发重试）
//   4. agent_runs / agent_steps / tool_calls 落库
// M11 升级：
//   5. 记忆注入（自动检索相关记忆并注入上下文）

import { nanoid } from "nanoid";
import type { AgentStep, PlanItem, ToolDefinition, Attachment } from "@/lib/types";
import { toolRegistry } from "@/server/tools";
import { persistStep, startRun, finishRun } from "@/server/agent/persistence";
import { injectMemories, extractAndSaveMemory } from "@/server/memory";
import { logger } from "@/server/logger";

export interface RunAgentOptions {
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    name?: string;
    toolCallId?: string;
    attachments?: Attachment[];
  }>;
  tools?: ToolDefinition[];
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
  maxToolRounds?: number;
  enablePlan?: boolean;
  enableReflection?: boolean;
  reflectionThreshold?: number;
  dbSessionId?: string;
  getProvider: () => import("@/server/providers").LLMProvider;
  enableMemoryInjection?: boolean;
}

export async function* runAgent(opts: RunAgentOptions): AsyncIterable<AgentStep> {
  const maxRounds = opts.maxToolRounds ?? 5;
  const threshold = opts.reflectionThreshold ?? 0.6;
  const provider = opts.getProvider();

  let runId: string | null = null;
  if (opts.dbSessionId && process.env.DATABASE_URL) {
    try {
      runId = await startRun({
        sessionId: opts.dbSessionId,
        userMessage: opts.messages[opts.messages.length - 1]?.content ?? "",
        model: opts.model ?? "mock-default",
      });
    } catch (err) {
      logger.warn({ err }, "[runAgent] failed to start DB run");
    }
  }
  const runIdProp = runId ?? `mock-${nanoid(8)}`;

  let currentMessages = [...opts.messages];
  let stepIndex = 0;
  let totalRounds = 0;
  let finalScore = 1.0;
  let finalCritique = "";
  let promptTokens = 0;
  let completionTokens = 0;
  const plan: PlanItem[] = [];

  const persistAndYield = async (step: AgentStep) => {
    stepIndex++;
    totalRounds++;
    if (runId) {
      try {
        await persistStep({ runId, stepIndex, step });
      } catch (err) {
        logger.warn({ err }, "[runAgent] persistStep failed");
      }
    }
    return step;
  };

  if (opts.enableMemoryInjection !== false) {
    const lastUserMsg = [...currentMessages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      try {
        const injectionResult = await injectMemories(lastUserMsg.content);
        if (injectionResult.injectionCount > 0) {
          currentMessages = [
            { role: "system" as const, content: injectionResult.contextText },
            ...currentMessages,
          ];
          yield await persistAndYield({
            kind: "memory_injection",
            memories: injectionResult.injected.map((m) => ({
              id: m.id,
              summary: m.summary,
              kind: m.kind,
              similarity: 0,
            })),
          });
        }
      } catch (err) {
        logger.warn({ err }, "[runAgent] memory injection failed");
      }
    }
  }

  for (let round = 0; round <= maxRounds; round++) {
    if (opts.signal?.aborted) break;

    const toolCallsThisRound: Array<{ id: string; name: string; args: Record<string, unknown> }> =
      [];
    let roundScore = 1.0;
    let roundCritique = "";
    let shouldRevise = false;

    for await (const step of provider.stream({
      messages: currentMessages,
      tools: opts.tools,
      model: opts.model,
      temperature: opts.temperature,
      signal: opts.signal,
    })) {
      if (step.kind === "plan") {
        plan.push(...step.todos);
      }
      if (step.kind === "tool_call") {
        toolCallsThisRound.push({
          id: `call_${nanoid(8)}`,
          name: step.name,
          args: step.args,
        });
      }
      if (step.kind === "done") {
        promptTokens += step.usage.prompt;
        completionTokens += step.usage.completion;
      }
      if (step.kind === "reflection") {
        roundScore = step.score;
        roundCritique = step.critique;
        shouldRevise = step.revise;
      }
      yield await persistAndYield(step);
    }

    if (opts.enableReflection && roundScore < threshold && shouldRevise && round < maxRounds) {
      currentMessages = [
        ...currentMessages,
        {
          role: "system" as const,
          content: `[Reflection] 你的上一轮答案评分仅 ${roundScore.toFixed(2)}。Critique: ${roundCritique}\n请基于反思结果改进答案。`,
        },
      ];
      finalScore = roundScore;
      finalCritique = roundCritique;
      continue;
    }

    if (toolCallsThisRound.length === 0) {
      break;
    }

    // P1 优化：工具调用并行执行（无依赖关系时）
    const toolResults = await Promise.all(
      toolCallsThisRound.map(async (tc) => {
        let result: unknown;
        let error: string | undefined;
        try {
          const out = await toolRegistry.execute(tc.name, tc.args, {
            signal: opts.signal,
            sessionId: opts.dbSessionId,
            runId: runId ?? undefined,
          });
          result = out.result;
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
        }
        return { tc, result, error };
      }),
    );

    for (const { tc, result, error } of toolResults) {
      if (opts.signal?.aborted) break;
      yield await persistAndYield({
        kind: "tool_result",
        name: tc.name,
        result,
        error,
      });

      currentMessages = [
        ...currentMessages,
        {
          role: "tool" as const,
          name: tc.name,
          toolCallId: tc.id,
          content: error ? JSON.stringify({ error }) : JSON.stringify(result ?? null),
        },
      ];
    }
  }

  if (runId) {
    try {
      await finishRun({
        runId,
        status: opts.signal?.aborted ? "aborted" : "success",
        totalRounds,
        plan,
        reflectionScore: finalScore < 1 ? Math.round(finalScore * 100) : null,
        reflectionCritique: finalCritique || null,
        promptTokens,
        completionTokens,
      });
    } catch (err) {
      logger.warn({ err }, "[runAgent] finishRun failed");
    }
  }

  if (opts.enableMemoryInjection !== false && opts.dbSessionId) {
    try {
      await extractAndSaveMemory(opts.dbSessionId, opts.messages);
    } catch (err) {
      logger.warn({ err }, "[runAgent] extractAndSaveMemory failed");
    }
  }

  yield {
    kind: "done",
    usage: {
      prompt: promptTokens,
      completion: completionTokens,
      total: promptTokens + completionTokens,
    },
    runId: runIdProp,
  };
}
