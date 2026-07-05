"use client";

import { useState } from "react";
import {
  Wrench,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCallRecord } from "@/lib/types";

interface ToolCallCardProps {
  toolCall: ToolCallRecord;
}

/** 工具名 → 友好描述 + 图标颜色 */
const TOOL_META: Record<string, { label: string; color: string }> = {
  calculator: { label: "数学计算", color: "text-cyber-cyan" },
  get_current_time: { label: "当前时间", color: "text-cyber-lime" },
  web_search: { label: "联网搜索", color: "text-cyber-purple" },
  code_runner: { label: "JS 沙箱", color: "text-cyber-magenta" },
  word_count: { label: "字数统计", color: "text-cyber-cyan" },
};

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = TOOL_META[toolCall.name] ?? { label: toolCall.name, color: "text-cyber-cyan" };

  const status = toolCall.status;
  const isPending = status === "pending" || status === "running";
  const isError = status === "error";
  const isSuccess = status === "success";

  return (
    <div
      className={cn(
        "my-2 overflow-hidden rounded-lg border bg-cyber-bg/40 font-mono text-xs backdrop-blur-sm transition-all",
        isError
          ? "border-red-500/40 shadow-[0_0_12px_-6px_rgba(239,68,68,0.4)]"
          : isSuccess
            ? "border-cyber-lime/30"
            : "border-cyber-cyan/30",
      )}
    >
      {/* 头部 */}
      <div
        className="flex cursor-pointer select-none items-center gap-2 px-3 py-2"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="size-3.5 text-cyber-muted" />
        ) : (
          <ChevronRight className="size-3.5 text-cyber-muted" />
        )}
        <Wrench className={cn("size-3.5", meta.color)} />
        <span className={cn("font-semibold tracking-wide", meta.color)}>{meta.label}</span>
        <span className="text-cyber-muted/70">·</span>
        <span className="text-cyber-muted">{toolCall.name}</span>

        <div className="ml-auto flex items-center gap-2">
          {isPending && (
            <span className="inline-flex items-center gap-1 rounded-full border border-cyber-cyan/40 bg-cyber-cyan/10 px-2 py-0.5 text-[10px] text-cyber-cyan">
              <Loader2 className="size-3 animate-spin" />
              {status === "pending" ? "等待" : "执行中"}
            </span>
          )}
          {isSuccess && (
            <span className="inline-flex items-center gap-1 rounded-full border border-cyber-lime/40 bg-cyber-lime/10 px-2 py-0.5 text-[10px] text-cyber-lime">
              <CheckCircle2 className="size-3" />
              完成
            </span>
          )}
          {isError && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-400">
              <XCircle className="size-3" />
              失败
            </span>
          )}
          {toolCall.durationMs !== undefined && (
            <span className="inline-flex items-center gap-1 text-[10px] text-cyber-muted/80">
              <Clock className="size-3" />
              {toolCall.durationMs}ms
            </span>
          )}
        </div>
      </div>

      {/* 折叠详情 */}
      {expanded && (
        <div className="border-t border-cyber-border/60 bg-cyber-bg/60 px-3 py-2 text-[11px]">
          <div className="mb-1.5 flex items-baseline gap-2">
            <span className="text-cyber-muted/80">参数：</span>
            <code className="break-all text-cyber-text">
              {JSON.stringify(toolCall.args, null, 0)}
            </code>
          </div>
          {isError ? (
            <div className="flex items-baseline gap-2">
              <span className="text-red-400/80">错误：</span>
              <code className="break-all text-red-300">{toolCall.error}</code>
            </div>
          ) : toolCall.result !== undefined ? (
            <div className="flex items-baseline gap-2">
              <span className="text-cyber-lime/80">结果：</span>
              <pre className="whitespace-pre-wrap break-all text-cyber-text">
                {typeof toolCall.result === "string"
                  ? toolCall.result
                  : JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="text-cyber-muted/60">等待结果…</div>
          )}
        </div>
      )}
    </div>
  );
}
