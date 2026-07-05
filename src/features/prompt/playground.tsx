"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePromptsStore } from "@/stores/prompts";
import type { PromptTemplateData } from "@/stores/prompts";
import type { PromptVariable } from "@/server/db/schema";
import { cn, formatTokens, formatDuration } from "@/lib/utils";
import { Play, Loader2, ChevronDown, ArrowLeft, FlaskConical, GitCompare } from "lucide-react";

/** Playground 单次执行结果 */
interface PlaygroundResult {
  output: string;
  usage: { prompt: number; completion: number; total: number };
  durationMs: number;
  resolvedPrompt: string;
}

/** A/B 测试结果 */
interface ABTestResult {
  resultA: PlaygroundResult;
  resultB: PlaygroundResult;
}

type Tab = "single" | "ab";

const MODELS = ["mock-default", "gpt-4o-mini", "gpt-4o"] as const;
type ModelOption = (typeof MODELS)[number];

const INPUT_CLS =
  "w-full rounded-md border border-cyber-border bg-cyber-bg/60 px-3 py-2 text-sm text-cyber-text placeholder:text-cyber-muted/50 focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan/40";

const SELECT_CLS =
  "w-full appearance-none rounded-md border border-cyber-border bg-cyber-bg/60 px-3 py-2 text-sm text-cyber-text focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan/40";

const PRIMARY_BTN =
  "btn-glow inline-flex items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-cyber-cyan via-cyber-purple to-cyber-magenta px-5 py-2 text-sm font-medium text-white shadow-neon transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100";

const CANCEL_BTN =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-cyber-danger/30 bg-cyber-danger/10 px-4 py-2 text-sm text-cyber-danger transition-colors hover:bg-cyber-danger/20";

export function Playground() {
  const searchParams = useSearchParams();
  const templates = usePromptsStore((s) => s.templates);
  const list = usePromptsStore((s) => s.list);
  const get = usePromptsStore((s) => s.get);

  // list() 读取 store 内部状态；将 templates 列入依赖以在模板变更时重新计算
  const all = useMemo(
    () => list(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, templates],
  );

  const [tab, setTab] = useState<Tab>("single");

  // 共享运行配置
  const [model, setModel] = useState<ModelOption>("mock-default");
  const [temperature, setTemperature] = useState(0.7);

  // ---- 单模板测试状态 ----
  const [selectedId, setSelectedId] = useState<string>("");
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [userMessage, setUserMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // ---- A/B 测试状态 ----
  const [selectedIdA, setSelectedIdA] = useState<string>("");
  const [selectedIdB, setSelectedIdB] = useState<string>("");
  const [abVariableValues, setAbVariableValues] = useState<Record<string, string>>({});
  const [abUserMessage, setAbUserMessage] = useState("");
  const [abLoading, setAbLoading] = useState(false);
  const [abError, setAbError] = useState<string | null>(null);
  const [abResult, setAbResult] = useState<ABTestResult | null>(null);
  const abAbortRef = useRef<AbortController | null>(null);

  // 读取 ?templateId= 并自动选中（从 /prompts 页面跳转）
  useEffect(() => {
    const tid = searchParams.get("templateId");
    if (tid && get(tid)) {
      setSelectedId(tid);
      setTab("single");
    }
  }, [searchParams, get]);

  const selected = selectedId ? get(selectedId) : undefined;

  // 选中模板后用 defaultValue 填充变量输入
  useEffect(() => {
    if (!selected) return;
    setVariableValues((prev) => {
      const next: Record<string, string> = {};
      for (const v of selected.variables) {
        next[v.name] = prev[v.name] ?? v.defaultValue ?? "";
      }
      return next;
    });
  }, [selectedId, selected]);

  const selectedA = selectedIdA ? get(selectedIdA) : undefined;
  const selectedB = selectedIdB ? get(selectedIdB) : undefined;

  // A/B 测试共享变量：取两个模板变量的并集
  const abVariables = useMemo(() => {
    const map = new Map<string, PromptVariable>();
    for (const v of selectedA?.variables ?? []) map.set(v.name, v);
    for (const v of selectedB?.variables ?? []) {
      if (!map.has(v.name)) map.set(v.name, v);
    }
    return Array.from(map.values());
  }, [selectedA, selectedB]);

  // A/B 变量默认值填充
  useEffect(() => {
    setAbVariableValues((prev) => {
      const next: Record<string, string> = {};
      for (const v of abVariables) {
        next[v.name] = prev[v.name] ?? v.defaultValue ?? "";
      }
      return next;
    });
  }, [abVariables]);

  const handleRun = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          systemPrompt: selected.systemPrompt,
          variables: selected.variables,
          variableValues,
          userMessage: userMessage.trim() || undefined,
          model,
          temperature,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "执行失败");
      }
      setResult(data as PlaygroundResult);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [selected, variableValues, userMessage, model, temperature]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleRunAB = useCallback(async () => {
    if (!selectedA || !selectedB) return;
    setAbLoading(true);
    setAbError(null);
    setAbResult(null);
    const controller = new AbortController();
    abAbortRef.current = controller;
    try {
      const res = await fetch("/api/ab-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateA: {
            systemPrompt: selectedA.systemPrompt,
            variables: selectedA.variables,
            name: selectedA.name,
          },
          templateB: {
            systemPrompt: selectedB.systemPrompt,
            variables: selectedB.variables,
            name: selectedB.name,
          },
          variableValues: abVariableValues,
          userMessage: abUserMessage.trim() || undefined,
          model,
          temperature,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "执行失败");
      }
      setAbResult(data as ABTestResult);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setAbError((err as Error).message);
      }
    } finally {
      setAbLoading(false);
      abAbortRef.current = null;
    }
  }, [selectedA, selectedB, abVariableValues, abUserMessage, model, temperature]);

  const handleCancelAB = useCallback(() => {
    abAbortRef.current?.abort();
  }, []);

  return (
    <div className="flex h-screen flex-col">
      {/* 顶栏 */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-cyber-border px-4">
        <a
          href="/"
          className="inline-flex items-center gap-1 text-xs text-cyber-muted transition-colors hover:text-cyber-cyan"
        >
          <ArrowLeft className="size-3.5" />
          返回对话
        </a>
        <span className="text-cyber-border">/</span>
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-cyber-cyan" />
          <h1 className="font-display text-sm font-semibold text-cyber-text">Playground</h1>
        </div>
      </header>

      {/* Tab 切换 + 共享运行配置 */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-cyber-border px-4 py-3">
        <div className="flex items-center gap-1">
          <TabButton
            active={tab === "single"}
            onClick={() => setTab("single")}
            icon={<Play className="size-3.5" />}
          >
            单模板测试
          </TabButton>
          <TabButton
            active={tab === "ab"}
            onClick={() => setTab("ab")}
            icon={<GitCompare className="size-3.5" />}
          >
            A/B 测试
          </TabButton>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-cyber-muted">
            <span className="uppercase tracking-wider">模型</span>
            <div className="relative">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as ModelOption)}
                className={cn(SELECT_CLS, "pr-8")}
              >
                {MODELS.map((m) => (
                  <option key={m} value={m} className="bg-cyber-surface text-cyber-text">
                    {m}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-cyber-muted" />
            </div>
          </label>
          <label className="flex items-center gap-2 text-xs text-cyber-muted">
            <span className="uppercase tracking-wider">Temperature</span>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="h-1 w-40 cursor-pointer appearance-none rounded-full bg-cyber-surface accent-cyber-cyan"
            />
            <span className="w-8 font-mono text-cyber-cyan">{temperature.toFixed(1)}</span>
          </label>
        </div>
      </div>

      {/* 内容区 */}
      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "single" ? (
          <SingleMode
            all={all}
            selectedId={selectedId}
            onSelect={setSelectedId}
            selected={selected}
            variableValues={variableValues}
            onVariableChange={(name, val) => setVariableValues((p) => ({ ...p, [name]: val }))}
            userMessage={userMessage}
            setUserMessage={setUserMessage}
            loading={loading}
            error={error}
            result={result}
            showResolved={showResolved}
            setShowResolved={setShowResolved}
            onRun={handleRun}
            onCancel={handleCancel}
          />
        ) : (
          <ABMode
            all={all}
            selectedIdA={selectedIdA}
            selectedIdB={selectedIdB}
            onSelectA={setSelectedIdA}
            onSelectB={setSelectedIdB}
            selectedA={selectedA}
            selectedB={selectedB}
            abVariables={abVariables}
            abVariableValues={abVariableValues}
            onVariableChange={(name, val) => setAbVariableValues((p) => ({ ...p, [name]: val }))}
            userMessage={abUserMessage}
            setUserMessage={setAbUserMessage}
            loading={abLoading}
            error={abError}
            result={abResult}
            onRun={handleRunAB}
            onCancel={handleCancelAB}
          />
        )}
      </main>
    </div>
  );
}

/* ----------------------------- 子组件 ----------------------------- */

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-cyber-cyan/40 bg-cyber-cyan/10 text-cyber-cyan shadow-neon"
          : "border-transparent text-cyber-muted hover:bg-cyber-surface/40 hover:text-cyber-text",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function TemplateSelect({
  all,
  value,
  onChange,
  label,
}: {
  all: PromptTemplateData[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-cyber-muted">
        {label}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(SELECT_CLS, "pr-8")}
        >
          <option value="" className="bg-cyber-surface text-cyber-muted">
            选择模板...
          </option>
          {all.map((t) => (
            <option key={t.id} value={t.id} className="bg-cyber-surface text-cyber-text">
              {t.name}
              {t.isBuiltin ? "（内置）" : ""}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-cyber-muted" />
      </div>
    </label>
  );
}

function VariableInputs({
  variables,
  values,
  onChange,
}: {
  variables: PromptVariable[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
}) {
  if (variables.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-cyber-border bg-cyber-surface/20 px-3 py-3 text-center text-xs text-cyber-muted">
        该模板暂无变量
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {variables.map((v) => (
        <label key={v.name} className="block">
          <span className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-cyber-muted">
            <code className="font-mono text-cyber-cyan">{`{{${v.name}}}`}</code>
            {v.description ? (
              <span className="normal-case text-cyber-muted/70">· {v.description}</span>
            ) : null}
          </span>
          <input
            value={values[v.name] ?? ""}
            onChange={(e) => onChange(v.name, e.target.value)}
            placeholder={v.defaultValue ?? `输入 ${v.name}`}
            className={INPUT_CLS}
          />
        </label>
      ))}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-cyber-danger/30 bg-cyber-danger/10 px-3 py-2 text-xs text-cyber-danger">
      {message}
    </div>
  );
}

function ResultPanel({
  title,
  result,
  loading,
}: {
  title?: string;
  result: PlaygroundResult | null;
  loading?: boolean;
}) {
  return (
    <div className="glass rounded-xl border border-cyber-border p-4">
      {title ? (
        <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-cyber-muted">
          <span className="truncate">{title}</span>
        </div>
      ) : null}
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-cyber-muted">
          <Loader2 className="size-4 animate-spin text-cyber-cyan" />
          执行中…
        </div>
      ) : result ? (
        <div className="space-y-3">
          <div className="whitespace-pre-wrap break-words rounded-md border border-cyber-border bg-cyber-bg/60 p-3 font-mono text-sm text-cyber-text">
            {result.output}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-cyber-muted">
            <span className="rounded border border-cyber-border bg-cyber-surface/60 px-1.5 py-0.5">
              Prompt: <span className="text-cyber-cyan">{formatTokens(result.usage.prompt)}</span>
            </span>
            <span className="rounded border border-cyber-border bg-cyber-surface/60 px-1.5 py-0.5">
              Completion:{" "}
              <span className="text-cyber-cyan">{formatTokens(result.usage.completion)}</span>
            </span>
            <span className="rounded border border-cyber-border bg-cyber-surface/60 px-1.5 py-0.5">
              Total: <span className="text-cyber-cyan">{formatTokens(result.usage.total)}</span>
            </span>
            <span className="rounded border border-cyber-border bg-cyber-surface/60 px-1.5 py-0.5">
              耗时: <span className="text-cyber-amber">{formatDuration(result.durationMs)}</span>
            </span>
          </div>
        </div>
      ) : (
        <p className="py-6 text-center text-xs text-cyber-muted">暂无输出</p>
      )}
    </div>
  );
}

function SingleMode({
  all,
  selectedId,
  onSelect,
  selected,
  variableValues,
  onVariableChange,
  userMessage,
  setUserMessage,
  loading,
  error,
  result,
  showResolved,
  setShowResolved,
  onRun,
  onCancel,
}: {
  all: PromptTemplateData[];
  selectedId: string;
  onSelect: (id: string) => void;
  selected: PromptTemplateData | undefined;
  variableValues: Record<string, string>;
  onVariableChange: (name: string, value: string) => void;
  userMessage: string;
  setUserMessage: (v: string) => void;
  loading: boolean;
  error: string | null;
  result: PlaygroundResult | null;
  showResolved: boolean;
  setShowResolved: (v: boolean) => void;
  onRun: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <section className="glass space-y-3 rounded-xl border border-cyber-border p-4">
        <TemplateSelect all={all} value={selectedId} onChange={onSelect} label="模板" />

        {selected ? (
          <>
            <div>
              <h3 className="mb-2 text-[10px] uppercase tracking-wider text-cyber-muted">变量</h3>
              <VariableInputs
                variables={selected.variables}
                values={variableValues}
                onChange={onVariableChange}
              />
            </div>
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-wider text-cyber-muted">
                用户消息（可选）
              </span>
              <textarea
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                spellCheck={false}
                placeholder="输入测试用户消息，留空将使用默认指令..."
                className={cn(INPUT_CLS, "min-h-[80px] resize-y")}
              />
            </label>
          </>
        ) : (
          <p className="rounded-md border border-dashed border-cyber-border bg-cyber-surface/20 px-3 py-4 text-center text-xs text-cyber-muted">
            请选择一个模板开始测试
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRun}
            disabled={loading || !selected}
            className={PRIMARY_BTN}
          >
            {loading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                执行中
              </>
            ) : (
              <>
                <Play className="size-3.5" />
                执行
              </>
            )}
          </button>
          {loading ? (
            <button type="button" onClick={onCancel} className={CANCEL_BTN}>
              取消
            </button>
          ) : null}
        </div>
      </section>

      {error ? <ErrorBanner message={error} /> : null}

      <ResultPanel result={result} loading={loading} />

      {result ? (
        <section className="glass overflow-hidden rounded-xl border border-cyber-border">
          <button
            type="button"
            onClick={() => setShowResolved(!showResolved)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-cyber-muted transition-colors hover:text-cyber-text"
          >
            <span>解析后的完整 Prompt</span>
            <ChevronDown
              className={cn("size-3.5 transition-transform", showResolved && "rotate-180")}
            />
          </button>
          {showResolved ? (
            <pre className="whitespace-pre-wrap break-words border-t border-cyber-border bg-cyber-bg/40 p-3 font-mono text-xs leading-relaxed text-cyber-text">
              {result.resolvedPrompt}
            </pre>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function ABMode({
  all,
  selectedIdA,
  selectedIdB,
  onSelectA,
  onSelectB,
  selectedA,
  selectedB,
  abVariables,
  abVariableValues,
  onVariableChange,
  userMessage,
  setUserMessage,
  loading,
  error,
  result,
  onRun,
  onCancel,
}: {
  all: PromptTemplateData[];
  selectedIdA: string;
  selectedIdB: string;
  onSelectA: (id: string) => void;
  onSelectB: (id: string) => void;
  selectedA: PromptTemplateData | undefined;
  selectedB: PromptTemplateData | undefined;
  abVariables: PromptVariable[];
  abVariableValues: Record<string, string>;
  onVariableChange: (name: string, value: string) => void;
  userMessage: string;
  setUserMessage: (v: string) => void;
  loading: boolean;
  error: string | null;
  result: ABTestResult | null;
  onRun: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="glass space-y-3 rounded-xl border border-cyber-border p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TemplateSelect all={all} value={selectedIdA} onChange={onSelectA} label="模板 A" />
          <TemplateSelect all={all} value={selectedIdB} onChange={onSelectB} label="模板 B" />
        </div>

        {abVariables.length > 0 ? (
          <div>
            <h3 className="mb-2 text-[10px] uppercase tracking-wider text-cyber-muted">
              共享变量（并集）
            </h3>
            <VariableInputs
              variables={abVariables}
              values={abVariableValues}
              onChange={onVariableChange}
            />
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-cyber-border bg-cyber-surface/20 px-3 py-4 text-center text-xs text-cyber-muted">
            请选择至少一个模板以配置变量
          </p>
        )}

        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-cyber-muted">
            用户消息（可选）
          </span>
          <textarea
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            spellCheck={false}
            placeholder="输入测试用户消息，留空将使用默认指令..."
            className={cn(INPUT_CLS, "min-h-[80px] resize-y")}
          />
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRun}
            disabled={loading || !selectedA || !selectedB}
            className={PRIMARY_BTN}
          >
            {loading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                执行中
              </>
            ) : (
              <>
                <GitCompare className="size-3.5" />
                对比测试
              </>
            )}
          </button>
          {loading ? (
            <button type="button" onClick={onCancel} className={CANCEL_BTN}>
              取消
            </button>
          ) : null}
        </div>
      </section>

      {error ? <ErrorBanner message={error} /> : null}

      {result ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ResultPanel title={`A: ${selectedA?.name ?? "模板 A"}`} result={result.resultA} />
          <ResultPanel title={`B: ${selectedB?.name ?? "模板 B"}`} result={result.resultB} />
        </div>
      ) : null}
    </div>
  );
}
