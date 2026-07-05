"use client";

import { useMaStore } from "@/stores/ma";
import { getAgentByRole } from "@/lib/agent-utils";

export function WorkflowGraph() {
  const { stages, currentStageIndex, steps, status } = useMaStore();

  if (stages.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-cyber-muted">
        选择团队并开始运行后，工作流将在此展示
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stages.map((stage, sIdx) => {
        const stageSteps = steps.filter((s) => s.stageIndex === sIdx);
        const isActive = sIdx === currentStageIndex && status === "running";
        const isDone = sIdx < currentStageIndex || status === "completed";

        return (
          <div key={sIdx} className="relative">
            {/* 阶段标题 */}
            <div className="mb-2 flex items-center gap-2">
              <div
                className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                  isDone
                    ? "border border-green-500/50 bg-green-500/20 text-green-400"
                    : isActive
                      ? "animate-pulse border border-cyber-cyan/50 bg-cyber-cyan/20 text-cyber-cyan"
                      : "border border-cyber-border bg-cyber-border/50 text-cyber-muted"
                }`}
              >
                {isDone ? "✓" : sIdx + 1}
              </div>
              <span
                className={`text-sm font-medium ${
                  isActive ? "text-cyber-cyan" : isDone ? "text-green-400" : "text-cyber-muted"
                }`}
              >
                {stage.name}
              </span>
            </div>

            {/* Agent 节点（SVG 横向排列） */}
            <div className="relative ml-8 overflow-x-auto pb-2">
              <div className="flex min-w-max items-center gap-4">
                {stageSteps.map((step, tIdx) => {
                  const agent = getAgentByRole(step.agentRole);
                  const color = agent?.color || "#888";
                  const icon = agent?.icon || "🤖";
                  const name = agent?.name || step.agentName;

                  return (
                    <div key={step.id} className="flex items-center">
                      {/* 节点 */}
                      <div
                        className="relative flex flex-col items-center"
                        title={`${name} — ${step.status}`}
                      >
                        <div
                          className={`flex size-14 items-center justify-center rounded-xl border text-2xl transition-all duration-300 ${
                            step.status === "running"
                              ? "scale-110 border-cyber-cyan bg-cyber-cyan/20 shadow-lg shadow-cyber-cyan/30"
                              : step.status === "completed"
                                ? "border-green-500/50 bg-green-500/10"
                                : step.status === "failed"
                                  ? "border-red-500/50 bg-red-500/10"
                                  : "border-cyber-border bg-cyber-bg/50"
                          }`}
                          style={
                            step.status === "running"
                              ? { boxShadow: `0 0 20px ${color}60`, animation: "pulse 2s infinite" }
                              : undefined
                          }
                        >
                          {step.status === "completed" ? (
                            <span className="text-lg text-green-400">✓</span>
                          ) : step.status === "failed" ? (
                            <span className="text-lg text-red-400">✕</span>
                          ) : (
                            <span>{icon}</span>
                          )}
                        </div>
                        <span
                          className={`mt-1.5 text-xs font-medium ${
                            step.status === "running"
                              ? "text-cyber-cyan"
                              : step.status === "completed"
                                ? "text-green-400"
                                : "text-cyber-muted"
                          }`}
                          style={{ maxWidth: "72px" }}
                        >
                          {name}
                        </span>
                      </div>

                      {/* 连接线 */}
                      {tIdx < stageSteps.length - 1 && (
                        <div className="mx-2 h-px w-8 bg-cyber-border" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 阶段间垂直线 */}
            {sIdx < stages.length - 1 && (
              <div className="ml-[11px] mt-2 h-4 w-px bg-cyber-border" />
            )}
          </div>
        );
      })}
    </div>
  );
}
