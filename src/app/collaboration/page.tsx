"use client";

import { useEffect, useRef, useState } from "react";
import { useMaStore } from "@/stores/ma";
import { useSettingsStore, getModelById } from "@/stores/settings";
import { WorkflowGraph } from "@/components/multi-agent/workflow-graph";
import { ProgressPanel } from "@/components/multi-agent/progress-panel";
import { StepTimeline } from "@/components/multi-agent/step-timeline";
import {
  Play,
  RotateCcw,
  Sparkles,
  Bot,
  Settings,
  GitBranch,
  Hand,
  History as HistoryIcon,
  Check,
  X,
  Clock,
} from "lucide-react";

export default function CollaborationPage() {
  const {
    goal,
    status,
    teams,
    selectedTeamId,
    setGoal,
    setSelectedTeamId,
    setTeams,
    initRun,
    setStageStarted,
    setAgentStarted,
    setAgentDelta,
    setAgentCompleted,
    setStageCompleted,
    setRunCompleted,
    setRunFailed,
    reset,
  } = useMaStore();

  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  /** M18: 引擎切换 —— "builtin" 自研 | "langgraph" LangGraph */
  const [engine, setEngine] = useState<"builtin" | "langgraph">("builtin");
  /** M19: HITL 模式 —— false=关闭 | "final"=终稿审批 | "tool"=工具调用审批 */
  const [hitlMode, setHitlMode] = useState<false | "final" | "tool">(false);
  /** M19: 当前 threadId（HITL 续跑用） */
  const modelId = useSettingsStore((s) => s.modelId);
  const customModels = useSettingsStore((s) => s.customModels);
  const modelApiKeys = useSettingsStore((s) => s.modelApiKeys);
  const serverConfigs = useSettingsStore((s) => s.serverConfigs);
  const isLoggedIn = useSettingsStore((s) => s.isLoggedIn);

  const currentModel = getModelById(modelId, customModels);
  const localKey = modelApiKeys[modelId] || (currentModel?.custom ? currentModel.apiKey : null);
  const usesServerKey = isLoggedIn && !!serverConfigs[modelId]?.hasKey && !localKey;
  const effectiveApiKey = usesServerKey ? "" : localKey || "";
  const effectiveBaseUrl = usesServerKey
    ? ""
    : currentModel?.baseUrl || serverConfigs[modelId]?.baseUrl || "";
  const effectiveModel = currentModel?.model || modelId;
  const [threadId, setThreadId] = useState<string | null>(null);
  /** M19: 是否处于暂停等待审批状态 */
  const [paused, setPaused] = useState(false);
  /** M19: 暂停原因 —— "tool_call" 工具审批 | "final_review" 终稿审批 */
  const [pausedReason, setPausedReason] = useState<"tool_call" | "final_review" | null>(null);
  /** M19: 待审批的工具调用信息 */
  const [pendingToolCall, setPendingToolCall] = useState<{
    toolName: string;
    toolInput: string;
    agentRole: string;
  } | null>(null);
  /** M19: 右侧 Tab —— "timeline" 步骤时间线 | "checkpoints" Checkpoint 时间线 */
  const [rightTab, setRightTab] = useState<"timeline" | "checkpoints">("timeline");
  /** M19: Checkpoint 列表 */
  const [checkpoints, setCheckpoints] = useState<
    Array<{
      checkpointId: string;
      createdAt: number;
      nextStep: string[];
      stepCount: number;
    }>
  >([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const stepIdMapRef = useRef<Map<string, string>>(new Map());

  // 加载团队列表
  useEffect(() => {
    fetch("/api/multi-agent/teams")
      .then((r) => r.json())
      .then((data) => {
        setTeams(data.teams || []);
        setIsLoadingTeams(false);
      })
      .catch(() => setIsLoadingTeams(false));
  }, [setTeams]);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  const handleStart = async () => {
    if (!goal.trim() || status === "running") return;

    // 重置之前的连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    stepIdMapRef.current.clear();
    reset();
    setPaused(false);
    setPausedReason(null);
    setPendingToolCall(null);
    setThreadId(null);
    setCheckpoints([]);

    // HITL 模式使用 LangGraph HITL 引擎
    const isHitl = hitlMode !== false && engine === "langgraph";
    const apiUrl = isHitl ? "/api/langchain/graph/start" : "/api/multi-agent/run";

    // 使用 fetch + ReadableStream 处理 SSE（支持 POST body）
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: goal.trim(),
          workflowTemplateId: selectedTeamId,
          engine,
          ...(isHitl ? { hitlMode: hitlMode as "final" | "tool" } : {}),
          apiKey: effectiveApiKey || undefined,
          baseUrl: effectiveBaseUrl || undefined,
          model: effectiveModel || undefined,
        }),
      });

      if (!response.ok || !response.body) {
        const err = await response.json().catch(() => ({ error: "启动失败" }));
        setRunFailed(err.error || "启动失败");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const processEvent = (eventLine: string, dataLine: string) => {
        if (!dataLine) return;
        try {
          const data = JSON.parse(dataLine);
          const eventType = eventLine.replace("event: ", "").trim();

          // M19: HITL 暂停检测（新的专用事件类型）
          if (eventType === "hitl_paused") {
            const d = data.data || {};
            setThreadId(d.threadId || threadId);
            setPaused(true);
            setPausedReason(d.pausedReason === "tool_call" ? "tool_call" : "final_review");
            setPendingToolCall(d.pendingToolCall || null);
            // 加载 Checkpoint 历史
            const tid = d.threadId || threadId;
            if (tid) {
              fetch(`/api/langchain/graph/states/${tid}`)
                .then((r) => r.json())
                .then((hist) => {
                  if (hist.history?.checkpoints) setCheckpoints(hist.history.checkpoints);
                })
                .catch(() => {});
            }
            return;
          }

          switch (eventType) {
            case "run_started": {
              const stages = data.data?.stages || [];
              const totalStages = data.data?.totalStages || stages.length;
              const totalSteps = data.data?.totalSteps || 0;
              initRun(data.runId, stages, totalStages, totalSteps);
              // 建立 stepId 映射（后端 stepId → 前端 stepId）
              const allSteps = useMaStore.getState().steps;
              allSteps.forEach((s) => {
                // 使用 stageIndex + stepIndex 作为匹配键
                const key = `${s.stageIndex}-${s.stepIndex}`;
                stepIdMapRef.current.set(key, s.id);
              });
              break;
            }
            case "stage_started": {
              setStageStarted(data.data?.stageIndex || 0);
              break;
            }
            case "agent_started": {
              const stageIdx = data.data?.stageIndex ?? 0;
              const stepIdx = data.data?.stepIndex ?? 0;
              const key = `${stageIdx}-${stepIdx}`;
              const frontendStepId = stepIdMapRef.current.get(key) || data.data?.stepId;
              if (frontendStepId) {
                setAgentStarted(frontendStepId);
              }
              break;
            }
            case "agent_delta": {
              const stepId = data.data?.stepId;
              // 通过 data stepId 在当前 steps 中匹配
              const state = useMaStore.getState();
              const step = state.steps.find((s) => s.status === "running");
              if (step && data.data?.delta) {
                setAgentDelta(step.id, data.data.delta);
              }
              break;
            }
            case "agent_completed": {
              const state = useMaStore.getState();
              const step = state.steps.find((s) => s.status === "running");
              if (step) {
                setAgentCompleted(
                  step.id,
                  data.data?.status === "failed" ? "failed" : "completed",
                  data.data?.output,
                  data.data?.error,
                  data.data?.durationMs,
                );
              }
              break;
            }
            case "stage_completed": {
              setStageCompleted();
              break;
            }
            case "run_completed": {
              setRunCompleted(data.data?.finalAnswer || "", data.data?.durationMs || 0);
              break;
            }
            case "run_failed": {
              setRunFailed(data.error || data.data?.error || "运行失败");
              break;
            }
          }
        } catch {
          // 忽略解析错误
        }
      };

      const read = async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            // 按 SSE 事件分割
            const events = buffer.split("\n\n");
            buffer = events.pop() || "";

            for (const eventStr of events) {
              const lines = eventStr.split("\n");
              let eventType = "";
              let dataStr = "";
              for (const line of lines) {
                if (line.startsWith("event: ")) {
                  eventType = line;
                } else if (line.startsWith("data: ")) {
                  dataStr = line.replace("data: ", "");
                }
              }
              if (eventType || dataStr) {
                processEvent(eventType || "event: message", dataStr);
              }
            }
          }
        } catch (err) {
          console.error("SSE error:", err);
        }
      };

      read();
    } catch (err) {
      setRunFailed(err instanceof Error ? err.message : String(err));
    }
  };

  const handleReset = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    reset();
    setPaused(false);
    setPausedReason(null);
    setPendingToolCall(null);
    setThreadId(null);
    setCheckpoints([]);
  };

  // ===== M19: HITL 审批功能 =====
  const handleApprove = async () => {
    if (!threadId) return;
    await handleResume("approved");
  };

  const handleReject = async () => {
    if (!threadId) return;
    await handleResume("rejected");
  };

  const handleResume = async (decision: "approved" | "rejected") => {
    if (!threadId) return;
    setPaused(false);

    try {
      const response = await fetch("/api/langchain/graph/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          decision,
          apiKey: effectiveApiKey || undefined,
          baseUrl: effectiveBaseUrl || undefined,
          model: effectiveModel || undefined,
        }),
      });

      if (!response.ok || !response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const processEvent = (eventLine: string, dataLine: string) => {
        if (!dataLine) return;
        try {
          const data = JSON.parse(dataLine);
          const eventType = eventLine.replace("event: ", "").trim();

          // 再次暂停（工具模式下通过工具审批门后，可能停在终稿审批门）
          if (eventType === "hitl_paused") {
            const d = data.data || {};
            setPaused(true);
            setPausedReason(d.pausedReason === "tool_call" ? "tool_call" : "final_review");
            setPendingToolCall(d.pendingToolCall || null);
            if (d.threadId) {
              fetch(`/api/langchain/graph/states/${d.threadId}`)
                .then((r) => r.json())
                .then((hist) => {
                  if (hist.history?.checkpoints) setCheckpoints(hist.history.checkpoints);
                })
                .catch(() => {});
            }
            return;
          }

          switch (eventType) {
            // resume 期间 agent 继续执行的事件 —— 复用主 SSE 处理器的逻辑
            case "agent_started": {
              const stageIdx = data.data?.stageIndex ?? 0;
              const stepIdx = data.data?.stepIndex ?? 0;
              const key = `${stageIdx}-${stepIdx}`;
              const frontendStepId = stepIdMapRef.current.get(key);
              if (frontendStepId) {
                setAgentStarted(frontendStepId);
              } else {
                // fallback: 找 running 的 step
                const state = useMaStore.getState();
                const step = state.steps.find(
                  (s) => s.status === "pending" || s.status === "running",
                );
                if (step) setAgentStarted(step.id);
              }
              break;
            }
            case "agent_delta": {
              const state = useMaStore.getState();
              const step = state.steps.find((s) => s.status === "running");
              if (step && data.data?.delta) setAgentDelta(step.id, data.data.delta);
              break;
            }
            case "agent_completed": {
              const state = useMaStore.getState();
              const step = state.steps.find((s) => s.status === "running");
              if (step) {
                setAgentCompleted(
                  step.id,
                  data.data?.status === "failed" ? "failed" : "completed",
                  data.data?.output,
                  data.data?.error,
                  data.data?.durationMs,
                );
              }
              break;
            }
            case "run_completed": {
              setPaused(false);
              setPausedReason(null);
              setPendingToolCall(null);
              setRunCompleted(data.data?.finalAnswer || "", data.data?.durationMs || 0);
              if (threadId) {
                fetch(`/api/langchain/graph/states/${threadId}`)
                  .then((r) => r.json())
                  .then((d) => {
                    if (d.history?.checkpoints) setCheckpoints(d.history.checkpoints);
                  })
                  .catch(() => {});
              }
              break;
            }
            case "run_failed": {
              setPaused(false);
              setPausedReason(null);
              setRunFailed(data.error || data.data?.error || "审批失败");
              break;
            }
          }
        } catch {
          // ignore parse errors
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const eventStr of events) {
          const lines = eventStr.split("\n");
          let eventType = "";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line;
            else if (line.startsWith("data: ")) dataStr = line.replace("data: ", "");
          }
          if (eventType || dataStr) processEvent(eventType || "event: message", dataStr);
        }
      }
    } catch (err) {
      setRunFailed(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRollback = async (checkpointId: string) => {
    if (!threadId) return;
    if (!confirm(`确定要回滚到该 Checkpoint 吗？`)) return;

    try {
      const res = await fetch("/api/langchain/graph/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, checkpointId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      alert(`回滚成功：${data.message}`);
      // 刷新 Checkpoint 列表
      const histRes = await fetch(`/api/langchain/graph/states/${threadId}`);
      const histData = await histRes.json();
      if (histData.history?.checkpoints) {
        setCheckpoints(histData.history.checkpoints);
      }
    } catch (err) {
      alert(`回滚失败：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* 顶部工具栏 */}
      <div className="border-b border-cyber-border bg-cyber-surface/50 px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-cyber-cyan" />
            <h1 className="text-gradient font-display text-lg font-semibold">多智能体协作</h1>
          </div>

          <div className="flex-1" />

          {/* M18: 引擎切换 */}
          <div className="flex items-center gap-2 rounded-lg border border-cyber-border bg-cyber-bg/60 p-1">
            <GitBranch className="ml-1.5 size-3.5 text-cyber-muted" />
            <button
              onClick={() => setEngine("builtin")}
              disabled={status === "running"}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                engine === "builtin"
                  ? "bg-cyber-cyan/20 text-cyber-cyan"
                  : "text-cyber-muted hover:text-cyber-text"
              } disabled:opacity-50`}
              title="使用自研 WorkflowEngine"
            >
              自研
            </button>
            <button
              onClick={() => setEngine("langgraph")}
              disabled={status === "running"}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                engine === "langgraph"
                  ? "bg-cyber-purple/20 text-cyber-purple"
                  : "text-cyber-muted hover:text-cyber-text"
              } disabled:opacity-50`}
              title="使用 LangGraph StateGraph"
            >
              LangGraph
            </button>
          </div>

          {/* M19: HITL 模式选择（仅 LangGraph 模式显示） */}
          {engine === "langgraph" && (
            <div className="flex items-center gap-1 rounded-lg border border-cyber-border bg-cyber-bg/60 p-1">
              <Hand className="ml-1 size-3.5 text-cyber-muted" />
              <button
                onClick={() => setHitlMode(false)}
                disabled={status === "running"}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  hitlMode === false
                    ? "bg-cyber-muted/20 text-cyber-text"
                    : "text-cyber-muted hover:text-cyber-text"
                } disabled:opacity-50`}
                title="关闭人工审批"
              >
                无
              </button>
              <button
                onClick={() => setHitlMode("final")}
                disabled={status === "running"}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  hitlMode === "final"
                    ? "bg-cyber-amber/20 text-cyber-amber"
                    : "text-cyber-muted hover:text-cyber-text"
                } disabled:opacity-50`}
                title="终稿审批：所有Agent完成后审批最终结果"
              >
                终稿审批
              </button>
              <button
                onClick={() => setHitlMode("tool")}
                disabled={status === "running"}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  hitlMode === "tool"
                    ? "bg-cyber-danger/20 text-cyber-danger"
                    : "text-cyber-muted hover:text-cyber-text"
                } disabled:opacity-50`}
                title="工具审批：每次工具调用前审批（对比requireConfirm）"
              >
                工具审批
              </button>
            </div>
          )}

          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            disabled={status === "running" || isLoadingTeams}
            className="rounded-lg border border-cyber-border bg-cyber-bg/60 px-3 py-1.5 text-sm text-cyber-text outline-none focus:border-cyber-cyan/50 disabled:opacity-50"
          >
            {isLoadingTeams && <option>加载中...</option>}
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* 目标输入 */}
        <div className="mt-3 flex gap-3">
          <div className="relative flex-1">
            <Sparkles className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cyber-cyan" />
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              placeholder="输入你的目标，让多智能体团队为你协作完成..."
              disabled={status === "running"}
              className="w-full rounded-lg border border-cyber-border bg-cyber-bg/60 py-2.5 pl-10 pr-4 text-sm text-cyber-text outline-none transition-colors focus:border-cyber-cyan/50 disabled:opacity-50"
            />
          </div>
          <button
            onClick={
              status === "idle" || status === "completed" || status === "failed"
                ? handleStart
                : handleReset
            }
            disabled={status === "running" ? false : !goal.trim()}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyber-cyan to-cyber-purple px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {status === "running" ? (
              <>
                <RotateCcw className="size-4" />
                停止
              </>
            ) : (
              <>
                <Play className="size-4" />
                开始运行
              </>
            )}
          </button>
        </div>
      </div>

      {/* 主体三栏布局 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左栏：工作流图 + 进度 */}
        <div className="w-80 shrink-0 overflow-y-auto border-r border-cyber-border p-4">
          <div className="mb-6">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-cyber-text">
              <Settings className="size-4 text-cyber-cyan" />
              执行进度
            </h2>
            <ProgressPanel />
          </div>

          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-cyber-text">
              <Bot className="size-4 text-cyber-cyan" />
              工作流
            </h2>
            <WorkflowGraph />
          </div>
        </div>

        {/* 中栏：Agent 消息气泡 */}
        <div className="flex-1 overflow-y-auto p-6">
          <AgentMessages />
        </div>

        {/* 右栏：步骤时间线 / Checkpoint 时间线 */}
        <div className="w-96 shrink-0 overflow-y-auto border-l border-cyber-border p-4">
          {/* M19: Tab 切换（LangGraph 模式显示） */}
          {engine === "langgraph" && (
            <div className="mb-3 flex gap-1 rounded-lg border border-cyber-border bg-cyber-bg/60 p-1">
              <button
                onClick={() => setRightTab("timeline")}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  rightTab === "timeline"
                    ? "bg-cyber-cyan/20 text-cyber-cyan"
                    : "text-cyber-muted hover:text-cyber-text"
                }`}
              >
                执行时间线
              </button>
              <button
                onClick={() => setRightTab("checkpoints")}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  rightTab === "checkpoints"
                    ? "bg-cyber-purple/20 text-cyber-purple"
                    : "text-cyber-muted hover:text-cyber-text"
                }`}
              >
                Checkpoint
              </button>
            </div>
          )}

          {rightTab === "timeline" ? (
            <>
              <h2 className="mb-3 text-sm font-medium text-cyber-text">执行时间线</h2>
              <StepTimeline />
            </>
          ) : (
            <>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-cyber-text">
                <HistoryIcon className="size-4 text-cyber-purple" />
                Checkpoint 时间线
              </h2>
              <CheckpointTimeline
                checkpoints={checkpoints}
                paused={paused}
                onRollback={handleRollback}
              />
            </>
          )}

          {/* M19: HITL 审批面板（暂停时显示） */}
          {paused && (
            <div className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border border-cyber-amber/50 bg-cyber-bg/95 p-4 shadow-2xl shadow-cyber-amber/10 backdrop-blur">
              <div className="mb-3 flex items-center gap-2">
                <Hand className="size-5 text-cyber-amber" />
                <h3 className="text-sm font-semibold text-cyber-amber">
                  {pausedReason === "tool_call" ? "工具调用审批" : "终稿审批"}
                </h3>
              </div>
              {pausedReason === "tool_call" && pendingToolCall && (
                <div className="mb-3 rounded-lg border border-cyber-border bg-cyber-surface/30 p-2.5 text-xs">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="rounded bg-cyber-purple/20 px-1.5 py-0.5 text-cyber-purple">
                      {getAgentByRole(pendingToolCall.agentRole)?.name || pendingToolCall.agentRole}
                    </span>
                    <span className="text-cyber-muted">请求调用</span>
                  </div>
                  <div className="font-mono text-cyber-cyan">{pendingToolCall.toolName}</div>
                  <div className="mt-1 line-clamp-2 text-[11px] text-cyber-muted">
                    {pendingToolCall.toolInput}
                  </div>
                </div>
              )}
              <p className="mb-4 text-xs text-cyber-muted">
                {pausedReason === "tool_call"
                  ? "Agent 请求调用工具，请审核后决定是否允许执行。"
                  : "工作流已执行到终稿审批节点，请审核最终结果后决定是否放行。"}
              </p>
              <div className="mb-3 rounded-lg border border-cyber-border bg-cyber-surface/30 p-2 text-xs text-cyber-muted">
                <div className="flex items-center gap-2">
                  <Clock className="size-3" />
                  <span>Thread: {threadId?.slice(0, 12)}...</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleApprove}
                  className="bg-cyber-emerald/20 text-cyber-emerald hover:bg-cyber-emerald/30 flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors"
                >
                  <Check className="size-3.5" />
                  {pausedReason === "tool_call" ? "允许调用" : "通过终稿"}
                </button>
                <button
                  onClick={handleReject}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-cyber-danger/20 py-2 text-xs font-medium text-cyber-danger transition-colors hover:bg-cyber-danger/30"
                >
                  <X className="size-3.5" />
                  拒绝
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== M19: Checkpoint 时间线组件 =====
function CheckpointTimeline({
  checkpoints,
  paused,
  onRollback,
}: {
  checkpoints: Array<{
    checkpointId: string;
    createdAt: number;
    nextStep: string[];
    stepCount: number;
  }>;
  paused: boolean;
  onRollback: (checkpointId: string) => void;
}) {
  if (checkpoints.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="text-center text-xs text-cyber-muted">
          <HistoryIcon className="mx-auto mb-2 size-8 opacity-40" />
          <p>暂无 Checkpoint</p>
          <p className="mt-1 opacity-60">启动 HITL 模式工作流后可查看</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {checkpoints.map((cp, idx) => (
        <div
          key={cp.checkpointId}
          className="group rounded-lg border border-cyber-border bg-cyber-surface/20 p-3 transition-colors hover:bg-cyber-surface/40"
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-cyber-text">
              #{checkpoints.length - idx} Checkpoint
            </span>
            {paused && idx === 0 && (
              <span className="rounded-full bg-cyber-amber/20 px-2 py-0.5 text-[10px] text-cyber-amber">
                当前
              </span>
            )}
          </div>
          <div className="mb-2 flex items-center gap-3 text-[10px] text-cyber-muted">
            <span>
              {new Date(cp.createdAt).toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
            <span>{cp.stepCount} 步骤</span>
          </div>
          {cp.nextStep.length > 0 && (
            <div className="mb-2 text-[10px] text-cyber-muted/70">
              下一步: {cp.nextStep.join(", ")}
            </div>
          )}
          <button
            onClick={() => onRollback(cp.checkpointId)}
            disabled={idx === 0}
            className="w-full rounded border border-cyber-border/50 py-1 text-[10px] text-cyber-muted transition-colors hover:border-cyber-purple/50 hover:text-cyber-purple disabled:cursor-not-allowed disabled:opacity-30"
          >
            回滚到此点
          </button>
        </div>
      ))}
    </div>
  );
}

function AgentMessages() {
  const { steps, status, finalAnswer } = useMaStore();
  const completedSteps = steps.filter((s) => s.status === "completed" || s.status === "running");

  if (completedSteps.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl border border-cyber-cyan/30 bg-cyber-cyan/10">
            <Bot className="size-8 text-cyber-cyan" />
          </div>
          <p className="text-sm text-cyber-muted">输入目标并启动，Agent 输出将在此展示</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {completedSteps.map((step) => {
        const agent = getAgentByRole(step.agentRole);
        const color = agent?.color || "#888";
        const name = agent?.name || step.agentName;
        const icon = agent?.icon || "🤖";
        const isRunning = step.status === "running";

        return (
          <div key={step.id} className="flex gap-3">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border text-lg"
              style={{ borderColor: color, backgroundColor: `${color}15` }}
            >
              {isRunning ? (
                <div
                  className="size-4 animate-pulse rounded-full"
                  style={{ backgroundColor: color }}
                />
              ) : (
                <span>{icon}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color }}>
                  {name}
                </span>
                <span className="text-xs text-cyber-muted">阶段 {step.stageIndex + 1}</span>
              </div>
              <div
                className="rounded-xl border px-4 py-3"
                style={{
                  borderColor: `${color}40`,
                  backgroundColor: `${color}08`,
                }}
              >
                <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-cyber-text/90">
                  {step.output}
                  {isRunning && (
                    <span
                      className="ml-0.5 inline-block h-4 w-1.5 animate-pulse align-text-bottom"
                      style={{ backgroundColor: color }}
                    />
                  )}
                </pre>
              </div>
            </div>
          </div>
        );
      })}

      {/* 最终答案 */}
      {status === "completed" && finalAnswer && (
        <div className="mt-8 rounded-2xl border border-green-500/30 bg-green-500/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-green-500/20">
              <svg
                className="size-4 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <span className="font-medium text-green-400">协作完成</span>
          </div>
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-cyber-text/90">
            {finalAnswer}
          </pre>
        </div>
      )}
    </div>
  );
}

function getAgentByRole(role: string) {
  const AGENTS: Record<string, { name: string; color: string; icon: string }> = {
    planner: { name: "规划专家", color: "#00F0FF", icon: "📋" },
    researcher: { name: "研究专家", color: "#A855F7", icon: "🔍" },
    analyst: { name: "分析专家", color: "#22D3EE", icon: "📊" },
    creative: { name: "创意专家", color: "#F472B6", icon: "💡" },
    coder: { name: "编码专家", color: "#34D399", icon: "💻" },
    tester: { name: "测试专家", color: "#FBBF24", icon: "🧪" },
    writer: { name: "写作专家", color: "#60A5FA", icon: "✍️" },
    reviewer: { name: "评审专家", color: "#F87171", icon: "🔍" },
  };
  return AGENTS[role];
}
