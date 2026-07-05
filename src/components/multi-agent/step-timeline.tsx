"use client";

import { useState } from "react";
import { useMaStore } from "@/stores/ma";
import { getAgentByRole } from "@/lib/agent-utils";
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

export function StepTimeline() {
  const { steps, currentStageIndex, status } = useMaStore();
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const activeSteps = steps.filter((s) => s.status !== "pending");

  const toggleExpand = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  if (activeSteps.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-cyber-muted">
        运行开始后，Agent 输出将在此显示
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activeSteps.map((step, idx) => {
        const agent = getAgentByRole(step.agentRole);
        const color = agent?.color || "#888";
        const icon = agent?.icon || "🤖";
        const name = agent?.name || step.agentName;
        const isExpanded = expandedSteps.has(step.id);
        const isLast = idx === activeSteps.length - 1;
        const isRunning = step.status === "running";

        return (
          <div key={step.id} className="relative">
            {/* 时间线竖线 */}
            {!isLast && (
              <div
                className="absolute left-[15px] top-8 h-[calc(100%+0.5rem)] w-px opacity-50"
                style={{ backgroundColor: color }}
              />
            )}

            <div className="flex gap-3">
              {/* 节点图标 */}
              <div
                className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg border text-sm"
                style={{
                  borderColor: color,
                  backgroundColor: step.status === "completed" ? `${color}20` : "rgba(0,0,0,0.3)",
                }}
              >
                {step.status === "completed" ? (
                  <CheckCircle2 style={{ color }} className="size-4" />
                ) : step.status === "failed" ? (
                  <XCircle className="size-4 text-red-400" />
                ) : step.status === "running" ? (
                  <Loader2 style={{ color }} className="size-4 animate-spin" />
                ) : (
                  <span>{icon}</span>
                )}
              </div>

              {/* 内容 */}
              <div className="min-w-0 flex-1">
                <button
                  onClick={() => toggleExpand(step.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-cyber-surface/60"
                >
                  <span className="text-sm font-medium" style={{ color }}>
                    {name}
                  </span>
                  <span className="text-xs text-cyber-muted">阶段 {step.stageIndex + 1}</span>
                  {step.durationMs !== undefined && (
                    <span className="flex items-center gap-1 text-xs text-cyber-muted">
                      <Clock className="size-3" />
                      {(step.durationMs / 1000).toFixed(1)}s
                    </span>
                  )}
                  <div className="ml-auto">
                    {isExpanded ? (
                      <ChevronDown className="size-4 text-cyber-muted" />
                    ) : (
                      <ChevronRight className="size-4 text-cyber-muted" />
                    )}
                  </div>
                </button>

                {/* 展开的输出内容 */}
                {isExpanded && (
                  <div className="ml-2 mt-1 rounded-lg border border-cyber-border/50 bg-cyber-bg/50 p-3">
                    <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-cyber-text/90">
                      {step.output || (isRunning ? "正在生成..." : "")}
                      {isRunning && (
                        <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-cyber-cyan align-text-bottom" />
                      )}
                    </pre>
                  </div>
                )}

                {/* 错误信息 */}
                {step.error && (
                  <div className="ml-2 mt-1 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-400">
                    {step.error}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
