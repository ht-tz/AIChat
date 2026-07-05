"use client";

import { useEffect, useState } from "react";
import { useMaStore } from "@/stores/ma";
import { Clock, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

export function ProgressPanel() {
  const {
    status,
    currentStageIndex,
    totalStages,
    totalSteps,
    completedSteps,
    durationMs,
    startedAt,
    stages,
    error,
  } = useMaStore();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status !== "running") {
      setElapsed(durationMs);
      return;
    }
    setElapsed(0);
    const interval = setInterval(() => {
      if (startedAt) {
        setElapsed(Date.now() - startedAt);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [status, startedAt, durationMs]);

  const stageProgress =
    totalStages > 0
      ? ((currentStageIndex + (status === "completed" ? 1 : 0)) / totalStages) * 100
      : 0;
  const stepProgress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const remaining = s % 60;
    return `${m.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
  };

  if (status === "idle") {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-cyber-muted">
        点击「开始运行」启动多智能体协作
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 状态指示 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status === "running" && <Loader2 className="size-4 animate-spin text-cyber-cyan" />}
          {status === "completed" && <CheckCircle2 className="size-4 text-green-400" />}
          {status === "failed" && <AlertCircle className="size-4 text-red-400" />}
          <span
            className={`text-sm font-medium ${
              status === "running"
                ? "text-cyber-cyan"
                : status === "completed"
                  ? "text-green-400"
                  : "text-red-400"
            }`}
          >
            {status === "running"
              ? "运行中..."
              : status === "completed"
                ? "已完成"
                : status === "failed"
                  ? "运行失败"
                  : status}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-cyber-muted">
          <Clock className="size-3.5" />
          <span>{formatDuration(elapsed)}</span>
        </div>
      </div>

      {/* 总进度条 */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-cyber-muted">
          <span>总进度</span>
          <span>
            {completedSteps} / {totalSteps} 步
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-cyber-border/50">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyber-cyan to-cyber-purple transition-all duration-500"
            style={{ width: `${stepProgress}%` }}
          />
        </div>
      </div>

      {/* 阶段进度条 */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-cyber-muted">
          <span>阶段进度</span>
          <span>
            {Math.min(currentStageIndex + 1, totalStages)} / {totalStages} 阶段
          </span>
        </div>
        <div className="flex gap-1">
          {stages.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                idx < currentStageIndex
                  ? "bg-green-500"
                  : idx === currentStageIndex && status === "running"
                    ? "animate-pulse bg-cyber-cyan"
                    : "bg-cyber-border/50"
              }`}
            />
          ))}
        </div>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <p className="font-medium">错误</p>
          <p className="mt-1 text-xs opacity-80">{error}</p>
        </div>
      )}
    </div>
  );
}
