"use client";

import { useState, useEffect } from "react";
import {
  Check,
  Loader2,
  ListChecks,
  ChevronDown,
  ChevronRight,
  RotateCw,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanItem, AgentStep } from "@/lib/types";

interface PlanTodoListProps {
  todos: PlanItem[];
  streaming?: boolean;
}

/** 计划清单 UI —— M3 Plan-and-Execute 可视化 */
export function PlanTodoList({ todos, streaming }: PlanTodoListProps) {
  const [expanded, setExpanded] = useState(true);

  if (!todos || todos.length === 0) return null;

  const doneCount = todos.filter((t) => t.status === "done").length;

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-cyber-purple/30 bg-cyber-bg/40 backdrop-blur-sm">
      <div
        className="flex cursor-pointer select-none items-center gap-2 px-3 py-2"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="size-3.5 text-cyber-muted" />
        ) : (
          <ChevronRight className="size-3.5 text-cyber-muted" />
        )}
        <ListChecks className="size-3.5 text-cyber-purple" />
        <span className="font-mono text-xs font-semibold text-cyber-purple">执行计划</span>
        <span className="text-[10px] text-cyber-muted">
          {doneCount}/{todos.length} 完成
        </span>
        {streaming && doneCount < todos.length && (
          <Loader2 className="ml-auto size-3 animate-spin text-cyber-cyan" />
        )}
      </div>

      {expanded && (
        <ol className="border-t border-cyber-border/60 px-2 py-2 font-mono text-xs">
          {todos.map((t) => (
            <li
              key={t.id}
              className={cn(
                "flex items-center gap-2 rounded px-2 py-1",
                t.status === "running" && "bg-cyber-cyan/5",
              )}
            >
              {t.status === "done" ? (
                <Check className="size-3 shrink-0 text-cyber-lime" />
              ) : t.status === "running" ? (
                <Loader2 className="size-3 shrink-0 animate-spin text-cyber-cyan" />
              ) : (
                <span className="size-3 shrink-0 rounded-full border border-cyber-muted/40" />
              )}
              <span
                className={cn(
                  t.status === "done" ? "text-cyber-muted line-through" : "text-cyber-text",
                  t.status === "running" && "text-cyber-cyan",
                )}
              >
                {t.title}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

interface ReflectionCardProps {
  reflection: { score: number; critique: string; revise: boolean };
  streaming?: boolean;
}

/** 反思评分卡片 */
export function ReflectionCard({ reflection, streaming }: ReflectionCardProps) {
  const score = Math.round(reflection.score * 100);
  const color =
    score >= 80 ? "text-cyber-lime" : score >= 60 ? "text-cyber-cyan" : "text-cyber-magenta";
  const bgColor =
    score >= 80
      ? "border-cyber-lime/40"
      : score >= 60
        ? "border-cyber-cyan/40"
        : "border-cyber-magenta/40";

  return (
    <div
      className={cn("my-2 rounded-lg border bg-cyber-bg/40 px-3 py-2 backdrop-blur-sm", bgColor)}
    >
      <div className="flex items-center gap-2 font-mono text-xs">
        <Lightbulb className={cn("size-3.5", color)} />
        <span className="font-semibold text-cyber-text">自反思</span>
        <span className={cn("font-mono font-bold", color)}>{score}/100</span>
        {reflection.revise && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-cyber-magenta">
            <RotateCw className="size-3" />
            已触发重试
          </span>
        )}
        {streaming && <Loader2 className="ml-auto size-3 animate-spin text-cyber-muted" />}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-cyber-muted">{reflection.critique}</p>
    </div>
  );
}

/**
 * 累积器：把多个 step 累积成 plan / reflection 单条数据
 * 用于 ChatContainer 一次性更新到 Message
 */
export function makeStepAccumulator() {
  const plans: PlanItem[] = [];
  const reflections: Array<{ score: number; critique: string; revise: boolean }> = [];
  const thoughts: string[] = [];
  const toolCallsList: import("@/lib/types").ToolCallRecord[] = [];

  return {
    /** 处理一个 step，返回是否有 UI 变化 */
    consume(
      step: AgentStep,
      currentToolCallId?: string,
    ): {
      hasPlanChange: boolean;
      hasReflectionChange: boolean;
      hasThoughtChange: boolean;
      hasToolCallChange: boolean;
    } {
      if (step.kind === "plan") {
        // 累加新的 todos
        for (const t of step.todos) {
          if (!plans.find((p) => p.id === t.id)) {
            plans.push({ ...t });
          }
        }
        return {
          hasPlanChange: true,
          hasReflectionChange: false,
          hasThoughtChange: false,
          hasToolCallChange: false,
        };
      }
      if (step.kind === "thought") {
        thoughts.push(step.content);
        return {
          hasPlanChange: false,
          hasReflectionChange: false,
          hasThoughtChange: true,
          hasToolCallChange: false,
        };
      }
      if (step.kind === "reflection") {
        reflections.push({ score: step.score, critique: step.critique, revise: step.revise });
        return {
          hasPlanChange: false,
          hasReflectionChange: true,
          hasThoughtChange: false,
          hasToolCallChange: false,
        };
      }
      if (step.kind === "tool_call") {
        toolCallsList.push({
          id: currentToolCallId ?? `tc_${Math.random().toString(36).slice(2, 10)}`,
          name: step.name,
          args: step.args,
          status: "running",
          startedAt: Date.now(),
        });
        return {
          hasPlanChange: false,
          hasReflectionChange: false,
          hasThoughtChange: false,
          hasToolCallChange: true,
        };
      }
      return {
        hasPlanChange: false,
        hasReflectionChange: false,
        hasThoughtChange: false,
        hasToolCallChange: false,
      };
    },
    snapshot() {
      return {
        plans: [...plans],
        reflections: [...reflections],
        thoughts: [...thoughts],
        toolCalls: [...toolCallsList],
      };
    },
  };
}
