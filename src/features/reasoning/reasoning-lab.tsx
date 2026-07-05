"use client";

import { useState } from "react";
import {
  ArrowLeft,
  GitBranch,
  RefreshCw,
  Wrench,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskNode {
  id: string;
  title: string;
  description: string;
  toolName?: string;
  dependencies: string[];
  status: string;
  maxRetries: number;
}

interface DecomposeResult {
  planId: string;
  goal: string;
  tasks: TaskNode[];
  executionOrder: string[][];
}

interface ReflectionOutput {
  success: boolean;
  errorCategory: string;
  errorAnalysis: string;
  recoveryStrategy: string;
  suggestion: string;
  confidence: number;
}

interface ToolSelectionOutput {
  selectedTools: string[];
  rejectedTools: string[];
  reasoning: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-cyber-muted/30 text-cyber-muted",
  running: "bg-cyber-cyan/20 text-cyber-cyan",
  done: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
  skipped: "bg-yellow-500/20 text-yellow-400",
};

const CATEGORY_COLORS: Record<string, string> = {
  tool_not_found: "text-red-400",
  tool_execution: "text-orange-400",
  invalid_input: "text-yellow-400",
  timeout: "text-cyber-amber",
  context_overflow: "text-purple-400",
  model_error: "text-cyber-cyan",
  unknown: "text-cyber-muted",
};

const STRATEGY_COLORS: Record<string, string> = {
  retry: "text-cyber-cyan",
  retry_modified: "text-cyber-amber",
  skip: "text-yellow-400",
  degrade: "text-purple-400",
  abort: "text-red-400",
};

export default function ReasoningLab() {
  const [tab, setTab] = useState<"decompose" | "reflect" | "tools">("decompose");

  // Decompose state
  const [goal, setGoal] = useState("");
  const [decomposeResult, setDecomposeResult] = useState<DecomposeResult | null>(null);
  const [decomposeLoading, setDecomposeLoading] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Reflect state
  const [errorText, setErrorText] = useState("");
  const [reflectResult, setReflectResult] = useState<ReflectionOutput | null>(null);
  const [reflectLoading, setReflectLoading] = useState(false);

  // Tool selection state
  const [userMsg, setUserMsg] = useState("");
  const [toolResult, setToolResult] = useState<ToolSelectionOutput | null>(null);
  const [toolLoading, setToolLoading] = useState(false);

  const handleDecompose = async () => {
    if (!goal.trim()) return;
    setDecomposeLoading(true);
    try {
      const res = await fetch("/api/reasoning/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal,
          availableTools: [
            "calculator",
            "web_search",
            "code_runner",
            "get_current_time",
            "word_count",
            "read_file",
            "generate_image",
          ],
        }),
      });
      const data = await res.json();
      setDecomposeResult(data);
    } catch {
      setDecomposeResult(null);
    } finally {
      setDecomposeLoading(false);
    }
  };

  const handleReflect = async () => {
    if (!errorText.trim()) return;
    setReflectLoading(true);
    try {
      const res = await fetch("/api/reasoning/reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ error: errorText, retryCount: 0, maxRetries: 3 }),
      });
      const data = await res.json();
      setReflectResult(data);
    } catch {
      setReflectResult(null);
    } finally {
      setReflectLoading(false);
    }
  };

  const handleToolSelect = async () => {
    if (!userMsg.trim()) return;
    setToolLoading(true);
    try {
      const res = await fetch("/api/reasoning/reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          availableTools: [
            "calculator",
            "web_search",
            "code_runner",
            "get_current_time",
            "word_count",
            "read_file",
            "generate_image",
            "summarize_report",
          ],
          userMessage: userMsg,
        }),
      });
      const data = await res.json();
      setToolResult(data);
    } catch {
      setToolResult(null);
    } finally {
      setToolLoading(false);
    }
  };

  const toggleTask = (id: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-cyber-bg p-4 md:p-6">
      {/* Top bar */}
      <div className="mb-6 flex items-center gap-3">
        <a href="/" className="text-cyber-muted transition-colors hover:text-cyber-cyan">
          <ArrowLeft className="size-5" />
        </a>
        <GitBranch className="size-5 text-cyber-cyan" />
        <h1 className="text-lg font-bold text-cyber-text">推理实验室</h1>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        {(["decompose", "reflect", "tools"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-all",
              tab === t
                ? "bg-cyber-cyan/10 text-cyber-cyan shadow-neon"
                : "text-cyber-muted hover:bg-cyber-surface/40 hover:text-cyber-text",
            )}
          >
            {t === "decompose" ? "任务分解" : t === "reflect" ? "结构化反思" : "工具选择策略"}
          </button>
        ))}
      </div>

      {/* Decompose Tab */}
      {tab === "decompose" && (
        <div className="glass rounded-xl border border-cyber-border p-5">
          <h2 className="mb-3 text-sm font-semibold text-cyber-text">输入目标，自动分解为子任务</h2>
          <div className="flex gap-3">
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="例如：搜索 AI 最新进展并总结"
              className="flex-1 rounded-lg border border-cyber-border bg-cyber-surface/50 px-3 py-2 text-sm text-cyber-text outline-none placeholder:text-cyber-muted/50 focus:border-cyber-cyan"
              onKeyDown={(e) => e.key === "Enter" && handleDecompose()}
            />
            <button
              onClick={handleDecompose}
              disabled={decomposeLoading || !goal.trim()}
              className="flex items-center gap-2 rounded-lg bg-cyber-cyan/20 px-4 py-2 text-sm font-medium text-cyber-cyan hover:bg-cyber-cyan/30 disabled:opacity-50"
            >
              {decomposeLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <GitBranch className="size-4" />
              )}
              分解
            </button>
          </div>

          {decomposeResult && (
            <div className="mt-5 space-y-4">
              {/* Execution layers */}
              <div>
                <h3 className="mb-2 text-xs font-semibold text-cyber-muted">
                  执行层级（每层可并行）
                </h3>
                <div className="space-y-2">
                  {decomposeResult.executionOrder.map((layer, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-20 text-xs text-cyber-muted">层级 {i + 1}</span>
                      <div className="flex gap-2">
                        {layer.map((taskId) => {
                          const task = decomposeResult.tasks.find((t) => t.id === taskId);
                          if (!task) return null;
                          return (
                            <button
                              key={taskId}
                              onClick={() => toggleTask(taskId)}
                              className={cn(
                                "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-all",
                                "border-cyber-border hover:border-cyber-cyan/50",
                                STATUS_COLORS[task.status] || STATUS_COLORS.pending,
                              )}
                            >
                              {expandedTasks.has(taskId) ? (
                                <ChevronDown className="size-3" />
                              ) : (
                                <ChevronRight className="size-3" />
                              )}
                              {task.title}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Task details */}
              {decomposeResult.tasks.map(
                (task) =>
                  expandedTasks.has(task.id) && (
                    <div key={task.id} className="glass rounded-lg border border-cyber-border p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[10px] font-medium",
                            STATUS_COLORS[task.status],
                          )}
                        >
                          {task.status}
                        </span>
                        <span className="text-sm font-medium text-cyber-text">{task.title}</span>
                      </div>
                      <p className="text-xs text-cyber-muted">{task.description}</p>
                      {task.toolName && (
                        <p className="mt-1 text-xs text-cyber-cyan">工具: {task.toolName}</p>
                      )}
                      {task.dependencies.length > 0 && (
                        <p className="mt-1 text-xs text-cyber-amber">
                          依赖: {task.dependencies.join(", ")}
                        </p>
                      )}
                    </div>
                  ),
              )}

              {/* Dependency graph visualization */}
              <div>
                <h3 className="mb-2 text-xs font-semibold text-cyber-muted">依赖图</h3>
                <svg
                  width="100%"
                  height={Math.max(80, decomposeResult.tasks.length * 40)}
                  className="rounded-lg border border-cyber-border bg-cyber-surface/30"
                >
                  {decomposeResult.tasks.map((task, i) => {
                    const x = 40;
                    const y = 20 + i * 40;
                    return (
                      <g key={task.id}>
                        {/* Draw dependency arrows */}
                        {task.dependencies.map((depId, j) => {
                          const depIdx = decomposeResult.tasks.findIndex((t) => t.id === depId);
                          if (depIdx < 0) return null;
                          const depY = 20 + depIdx * 40;
                          return (
                            <line
                              key={j}
                              x1={x + 100}
                              y1={depY + 10}
                              x2={x}
                              y2={y + 10}
                              stroke="#00F0FF"
                              strokeWidth={1}
                              strokeDasharray="4 2"
                              markerEnd="url(#arrow)"
                            />
                          );
                        })}
                        {/* Task node */}
                        <rect
                          x={x}
                          y={y}
                          width={180}
                          height={20}
                          rx={4}
                          fill="rgba(0,240,255,0.1)"
                          stroke="#00F0FF"
                          strokeWidth={1}
                        />
                        <text x={x + 8} y={y + 14} fill="#E6E8F2" fontSize={10}>
                          {task.title}
                        </text>
                      </g>
                    );
                  })}
                  <defs>
                    <marker
                      id="arrow"
                      markerWidth="8"
                      markerHeight="6"
                      refX="8"
                      refY="3"
                      orient="auto"
                    >
                      <path d="M0,0 L8,3 L0,6" fill="#00F0FF" />
                    </marker>
                  </defs>
                </svg>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reflect Tab */}
      {tab === "reflect" && (
        <div className="glass rounded-xl border border-cyber-border p-5">
          <h2 className="mb-3 text-sm font-semibold text-cyber-text">
            输入错误信息，分析原因和恢复策略
          </h2>
          <div className="flex gap-3">
            <input
              value={errorText}
              onChange={(e) => setErrorText(e.target.value)}
              placeholder="例如：Tool execution failed: timeout"
              className="flex-1 rounded-lg border border-cyber-border bg-cyber-surface/50 px-3 py-2 text-sm text-cyber-text outline-none placeholder:text-cyber-muted/50 focus:border-cyber-cyan"
              onKeyDown={(e) => e.key === "Enter" && handleReflect()}
            />
            <button
              onClick={handleReflect}
              disabled={reflectLoading || !errorText.trim()}
              className="flex items-center gap-2 rounded-lg bg-cyber-cyan/20 px-4 py-2 text-sm font-medium text-cyber-cyan hover:bg-cyber-cyan/30 disabled:opacity-50"
            >
              {reflectLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              反思
            </button>
          </div>

          {reflectResult && (
            <div className="mt-5 space-y-3">
              <div className="glass space-y-2 rounded-lg border border-cyber-border p-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-cyber-muted">错误类型:</span>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      CATEGORY_COLORS[reflectResult.errorCategory] || "text-cyber-muted",
                    )}
                  >
                    {reflectResult.errorCategory}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-cyber-muted">恢复策略:</span>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      STRATEGY_COLORS[reflectResult.recoveryStrategy] || "text-cyber-muted",
                    )}
                  >
                    {reflectResult.recoveryStrategy}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-cyber-muted">信心度:</span>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-cyber-surface/50">
                      <div
                        className="h-full rounded-full bg-cyber-cyan transition-all"
                        style={{ width: `${reflectResult.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-cyber-muted">
                    {Math.round(reflectResult.confidence * 100)}%
                  </span>
                </div>
                <div>
                  <span className="text-xs text-cyber-muted">分析:</span>
                  <p className="mt-1 text-sm text-cyber-text">{reflectResult.errorAnalysis}</p>
                </div>
                <div>
                  <span className="text-xs text-cyber-muted">建议:</span>
                  <p className="mt-1 text-sm text-cyber-amber">{reflectResult.suggestion}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tool Selection Tab */}
      {tab === "tools" && (
        <div className="glass rounded-xl border border-cyber-border p-5">
          <h2 className="mb-3 text-sm font-semibold text-cyber-text">
            输入用户消息，查看工具选择策略
          </h2>
          <div className="flex gap-3">
            <input
              value={userMsg}
              onChange={(e) => setUserMsg(e.target.value)}
              placeholder="例如：计算 123 * 456 并搜索结果"
              className="flex-1 rounded-lg border border-cyber-border bg-cyber-surface/50 px-3 py-2 text-sm text-cyber-text outline-none placeholder:text-cyber-muted/50 focus:border-cyber-cyan"
              onKeyDown={(e) => e.key === "Enter" && handleToolSelect()}
            />
            <button
              onClick={handleToolSelect}
              disabled={toolLoading || !userMsg.trim()}
              className="flex items-center gap-2 rounded-lg bg-cyber-cyan/20 px-4 py-2 text-sm font-medium text-cyber-cyan hover:bg-cyber-cyan/30 disabled:opacity-50"
            >
              {toolLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wrench className="size-4" />
              )}
              分析
            </button>
          </div>

          {toolResult && (
            <div className="mt-5 space-y-3">
              <div className="glass rounded-lg border border-cyber-border p-4">
                <h3 className="mb-2 text-xs font-semibold text-cyber-muted">选择的工具</h3>
                <div className="flex flex-wrap gap-2">
                  {toolResult.selectedTools.length > 0 ? (
                    toolResult.selectedTools.map((tool) => (
                      <span
                        key={tool}
                        className="rounded-md border border-cyber-cyan/30 bg-cyber-cyan/10 px-3 py-1 text-sm text-cyber-cyan"
                      >
                        {tool}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-cyber-muted">无匹配工具</span>
                  )}
                </div>

                {toolResult.rejectedTools.length > 0 && (
                  <>
                    <h3 className="mb-2 mt-3 text-xs font-semibold text-cyber-muted">拒绝的工具</h3>
                    <div className="flex flex-wrap gap-2">
                      {toolResult.rejectedTools.map((tool) => (
                        <span
                          key={tool}
                          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1 text-sm text-red-400 line-through"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  </>
                )}

                <h3 className="mb-2 mt-3 text-xs font-semibold text-cyber-muted">选择理由</h3>
                <p className="text-sm text-cyber-text">{toolResult.reasoning}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
