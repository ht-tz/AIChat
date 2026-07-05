"use client";

import { useEffect, useMemo, useState } from "react";
import { usePromptsStore } from "@/stores/prompts";
import type { PromptTemplateData, PromptVersionData } from "@/stores/prompts";
import type { PromptVariable } from "@/server/db/schema";
import { extractVariables } from "@/server/prompts/variable-parser";
import { Plus, Search, Trash2, Copy, History, RotateCcw, Play, FileText, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

const INPUT_CLS =
  "w-full rounded-md border border-cyber-border bg-cyber-bg/60 px-3 py-2 text-sm text-cyber-text placeholder:text-cyber-muted/50 focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan/40";

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return new Date(ts).toLocaleString();
  }
}

export function PromptManager() {
  const templates = usePromptsStore((s) => s.templates);
  const list = usePromptsStore((s) => s.list);
  const get = usePromptsStore((s) => s.get);
  const create = usePromptsStore((s) => s.create);
  const update = usePromptsStore((s) => s.update);
  const remove = usePromptsStore((s) => s.remove);
  const duplicate = usePromptsStore((s) => s.duplicate);
  const rollback = usePromptsStore((s) => s.rollback);
  const setActive = usePromptsStore((s) => s.setActive);
  const activeId = usePromptsStore((s) => s.activeId);

  // list() 读取 store 内部状态；将 templates 列入依赖以在模板变更时重新计算
  const all = useMemo(
    () => list(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, templates],
  );

  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [all, query]);

  const active: PromptTemplateData | undefined = activeId ? get(activeId) : undefined;

  const [draft, setDraft] = useState({
    name: "",
    description: "",
    category: "",
    systemPrompt: "",
    tags: [] as string[],
  });
  const [variables, setVariables] = useState<PromptVariable[]>([]);
  const [changelog, setChangelog] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  // 切换模板 / 保存 / 回滚后，用 store 中的最新值重置草稿
  useEffect(() => {
    if (active) {
      setDraft({
        name: active.name,
        description: active.description,
        category: active.category,
        systemPrompt: active.systemPrompt,
        tags: [...active.tags],
      });
      setVariables(active.variables.map((v) => ({ ...v })));
      setChangelog("");
      setTagInput("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.updatedAt]);

  const handleSystemPromptChange = (value: string) => {
    setDraft((d) => ({ ...d, systemPrompt: value }));
    const names = extractVariables(value);
    setVariables((prev) => {
      const map = new Map(prev.map((v) => [v.name, v]));
      return names.map((name) => map.get(name) ?? { name });
    });
  };

  const handleVariableChange = (
    name: string,
    field: "description" | "defaultValue",
    value: string,
  ) => {
    setVariables((prev) => prev.map((v) => (v.name === name ? { ...v, [field]: value } : v)));
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !draft.tags.includes(t)) {
      setDraft((d) => ({ ...d, tags: [...d.tags, t] }));
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setDraft((d) => ({ ...d, tags: d.tags.filter((t) => t !== tag) }));
  };

  const handleCreate = () => {
    const id = create({
      name: "未命名模板",
      description: "",
      category: "custom",
      systemPrompt: "你是一位 {{role}}，请根据用户的问题进行专业解答。\n\n用户问题：{{question}}",
    });
    setActive(id);
  };

  const handleDuplicate = () => {
    if (!active) return;
    const newId = duplicate(active.id);
    if (newId) setActive(newId);
  };

  const handleDelete = () => {
    if (!active) return;
    if (confirm(`确定删除模板 "${active.name}"？此操作不可撤销。`)) {
      remove(active.id);
    }
  };

  const handleSave = () => {
    if (!active) return;
    const log = changelog.trim() || `版本 ${active.currentVersion + 1}`;
    update(active.id, {
      name: draft.name.trim() || "未命名模板",
      description: draft.description,
      category: draft.category.trim() || "custom",
      systemPrompt: draft.systemPrompt,
      variables,
      tags: draft.tags,
      changelog: log,
    });
    setChangelog("");
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const handleRollback = (version: number) => {
    if (!active) return;
    if (confirm(`确定回滚到版本 ${version}？这将基于该版本创建一个新版本。`)) {
      rollback(active.id, version);
    }
  };

  const tagsChanged =
    !!active &&
    (active.tags.length !== draft.tags.length || active.tags.some((t, i) => t !== draft.tags[i]));
  const varsChanged = !!active && JSON.stringify(active.variables) !== JSON.stringify(variables);
  const dirty: boolean =
    !!active &&
    (active.name !== draft.name ||
      active.description !== draft.description ||
      active.category !== draft.category ||
      active.systemPrompt !== draft.systemPrompt ||
      tagsChanged ||
      varsChanged);

  return (
    <div className="flex h-screen flex-col">
      {/* 顶栏 */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-cyber-border px-4">
        <a
          href="/"
          className="inline-flex items-center gap-1 text-xs text-cyber-muted transition-colors hover:text-cyber-cyan"
        >
          ← 返回对话
        </a>
        <span className="text-cyber-border">/</span>
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-cyber-cyan" />
          <h1 className="font-display text-sm font-semibold text-cyber-text">提示词模板管理</h1>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 左侧模板列表 */}
        <aside className="glass flex w-72 shrink-0 flex-col border-r border-cyber-border">
          <div className="border-b border-cyber-border p-3">
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-cyber-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索模板..."
                className={cn(INPUT_CLS, "pl-8")}
              />
            </div>
            <button
              onClick={handleCreate}
              className="btn-glow flex w-full items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-cyber-cyan via-cyber-purple to-cyber-magenta px-3 py-2 text-xs font-medium text-white shadow-neon transition-all hover:scale-[1.02]"
            >
              <Plus className="size-3.5" />
              新建模板
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-2">
            {filtered.length === 0 && (
              <div className="flex h-32 flex-col items-center justify-center text-center text-xs text-cyber-muted">
                <FileText className="mb-2 size-6 opacity-40" />
                <p>{query ? "未找到匹配的模板" : "暂无模板"}</p>
              </div>
            )}
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={cn(
                  "group flex w-full flex-col gap-1 rounded-md px-2.5 py-2 text-left text-xs transition-colors",
                  t.id === activeId
                    ? "bg-cyber-card/80 text-cyber-text shadow-neon"
                    : "text-cyber-muted hover:bg-cyber-surface/40 hover:text-cyber-text",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium text-cyber-text">{t.name}</span>
                  {t.isBuiltin && (
                    <span className="shrink-0 rounded border border-cyber-amber/30 bg-cyber-amber/10 px-1 text-[9px] uppercase text-cyber-amber">
                      内置
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-cyber-muted">
                  <span className="rounded bg-cyber-surface/60 px-1.5 py-0.5">{t.category}</span>
                  <span>v{t.currentVersion}</span>
                  <span>·</span>
                  <span>{t.versions.length} 版本</span>
                </div>
              </button>
            ))}
          </nav>

          <div className="border-t border-cyber-border p-3">
            <p className="text-[10px] text-cyber-muted/60">
              共 {all.length} 个模板 · 数据保存在 localStorage
            </p>
          </div>
        </aside>

        {/* 右侧编辑器 */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          {!active ? (
            <EmptyState />
          ) : (
            <div className="mx-auto max-w-4xl px-6 py-6">
              {/* 编辑器头部 */}
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="模板名称"
                    className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 font-display text-xl font-semibold text-cyber-text placeholder:text-cyber-muted/40 hover:border-cyber-border focus:border-cyber-cyan/40 focus:outline-none focus:ring-1 focus:ring-cyber-cyan/40"
                  />
                  <div className="mt-1 flex flex-wrap items-center gap-2 px-2">
                    {active.isBuiltin ? (
                      <span className="rounded border border-cyber-amber/30 bg-cyber-amber/10 px-1.5 py-0.5 text-[10px] uppercase text-cyber-amber">
                        内置模板
                      </span>
                    ) : (
                      <span className="rounded border border-cyber-cyan/30 bg-cyber-cyan/10 px-1.5 py-0.5 text-[10px] uppercase text-cyber-cyan">
                        自定义
                      </span>
                    )}
                    <span className="text-[10px] text-cyber-muted">
                      当前版本 v{active.currentVersion} · 更新于 {formatTime(active.updatedAt)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  <a
                    href={`/playground?templateId=${active.id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-cyber-cyan/30 bg-cyber-cyan/10 px-2.5 py-1.5 text-xs text-cyber-cyan transition-colors hover:bg-cyber-cyan/20"
                    title="在 Playground 中测试"
                  >
                    <Play className="size-3.5" />
                    测试
                  </a>
                  <button
                    onClick={handleDuplicate}
                    title="复制模板"
                    className="inline-flex items-center gap-1 rounded-md border border-cyber-border bg-cyber-surface/40 px-2.5 py-1.5 text-xs text-cyber-text transition-colors hover:border-cyber-cyan hover:text-cyber-cyan"
                  >
                    <Copy className="size-3.5" />
                    复制
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={active.isBuiltin}
                    title={active.isBuiltin ? "内置模板不可删除" : "删除模板"}
                    className="inline-flex items-center gap-1 rounded-md border border-cyber-danger/30 bg-cyber-danger/10 px-2.5 py-1.5 text-xs text-cyber-danger transition-colors hover:bg-cyber-danger/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="size-3.5" />
                    删除
                  </button>
                </div>
              </div>

              {/* 描述 + 分类 */}
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[10px] uppercase tracking-wider text-cyber-muted">
                    描述
                  </span>
                  <input
                    value={draft.description}
                    onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                    placeholder="一句话描述这个模板的用途"
                    className={INPUT_CLS}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] uppercase tracking-wider text-cyber-muted">
                    分类
                  </span>
                  <input
                    value={draft.category}
                    onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                    placeholder="custom"
                    className={INPUT_CLS}
                  />
                </label>
              </div>

              {/* System Prompt */}
              <section className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-cyber-muted">
                    <FileText className="size-3.5" />
                    System Prompt
                  </h2>
                  <span className="text-[10px] text-cyber-muted">
                    使用 {`{{variable}}`} 插入变量
                  </span>
                </div>
                <textarea
                  value={draft.systemPrompt}
                  onChange={(e) => handleSystemPromptChange(e.target.value)}
                  spellCheck={false}
                  placeholder="在此编写系统提示词..."
                  className={cn(
                    INPUT_CLS,
                    "min-h-[320px] resize-y font-mono text-sm leading-relaxed",
                  )}
                />
              </section>

              {/* 变量管理 */}
              <section className="mb-4">
                <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-cyber-muted">
                  <Tag className="size-3.5" />
                  变量
                  {variables.length > 0 && (
                    <span className="rounded bg-cyber-surface/60 px-1.5 py-0.5 text-[10px] normal-case text-cyber-cyan">
                      {variables.length}
                    </span>
                  )}
                </h2>
                {variables.length === 0 ? (
                  <p className="rounded-md border border-dashed border-cyber-border bg-cyber-surface/20 px-3 py-4 text-center text-xs text-cyber-muted">
                    暂无变量。在 System Prompt 中使用 {`{{variable}}`} 语法会自动检测变量。
                  </p>
                ) : (
                  <div className="space-y-2">
                    {variables.map((v) => (
                      <div
                        key={v.name}
                        className="grid grid-cols-1 gap-2 rounded-md border border-cyber-border bg-cyber-surface/40 p-3 sm:grid-cols-[auto_1fr_1fr]"
                      >
                        <code className="flex items-center rounded bg-cyber-bg/60 px-2 py-1.5 font-mono text-xs text-cyber-cyan">
                          {`{{${v.name}}}`}
                        </code>
                        <input
                          value={v.description ?? ""}
                          onChange={(e) =>
                            handleVariableChange(v.name, "description", e.target.value)
                          }
                          placeholder="变量描述"
                          className={INPUT_CLS}
                        />
                        <input
                          value={v.defaultValue ?? ""}
                          onChange={(e) =>
                            handleVariableChange(v.name, "defaultValue", e.target.value)
                          }
                          placeholder="默认值（可选）"
                          className={INPUT_CLS}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 标签 */}
              <section className="mb-4">
                <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-cyber-muted">
                  <Tag className="size-3.5" />
                  标签
                </h2>
                <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-cyber-border bg-cyber-bg/60 px-2 py-2">
                  {draft.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded border border-cyber-cyan/30 bg-cyber-cyan/10 px-1.5 py-0.5 text-[11px] text-cyber-cyan"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-cyber-muted hover:text-cyber-danger"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      } else if (e.key === "Backspace" && !tagInput) {
                        setDraft((d) => ({
                          ...d,
                          tags: d.tags.slice(0, -1),
                        }));
                      }
                    }}
                    onBlur={addTag}
                    placeholder={draft.tags.length ? "" : "输入标签后回车添加"}
                    className="min-w-[120px] flex-1 bg-transparent px-1 py-0.5 text-xs text-cyber-text placeholder:text-cyber-muted/50 focus:outline-none"
                  />
                </div>
              </section>

              {/* 保存栏 */}
              <section className="mb-6 flex flex-col gap-2 border-t border-cyber-border pt-4 sm:flex-row sm:items-center">
                <input
                  value={changelog}
                  onChange={(e) => setChangelog(e.target.value)}
                  placeholder="变更说明（保存将创建新版本）"
                  className={cn(INPUT_CLS, "flex-1")}
                />
                <button
                  onClick={handleSave}
                  disabled={!dirty}
                  className="btn-glow inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-gradient-to-r from-cyber-cyan via-cyber-purple to-cyber-magenta px-5 py-2 text-sm font-medium text-white shadow-neon transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                >
                  {savedFlash ? "已保存" : "保存新版本"}
                </button>
              </section>

              {/* 版本历史 */}
              <VersionHistory
                versions={active.versions}
                currentVersion={active.currentVersion}
                onRollback={handleRollback}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full border border-cyber-cyan/30 bg-cyber-surface/40 shadow-neon">
        <FileText className="size-7 text-cyber-cyan" />
      </div>
      <h2 className="mb-1 font-display text-lg font-semibold text-cyber-text">
        选择一个模板开始编辑
      </h2>
      <p className="max-w-sm text-xs leading-relaxed text-cyber-muted">
        从左侧列表选择一个提示词模板，或点击「新建模板」创建你自己的模板。
        支持变量自动检测、版本管理与一键 Playground 测试。
      </p>
    </div>
  );
}

function VersionHistory({
  versions,
  currentVersion,
  onRollback,
}: {
  versions: PromptVersionData[];
  currentVersion: number;
  onRollback: (version: number) => void;
}) {
  const sorted = [...versions].sort((a, b) => b.version - a.version);
  return (
    <section className="glass rounded-xl border border-cyber-border p-4">
      <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-cyber-muted">
        <History className="size-3.5" />
        版本历史
        <span className="rounded bg-cyber-surface/60 px-1.5 py-0.5 text-[10px] normal-case text-cyber-muted">
          {versions.length}
        </span>
      </h2>
      <ul className="space-y-1.5">
        {sorted.map((v) => {
          const isCurrent = v.version === currentVersion;
          return (
            <li
              key={v.version}
              className={cn(
                "flex items-center gap-3 rounded-md border px-3 py-2 text-xs",
                isCurrent
                  ? "border-cyber-cyan/40 bg-cyber-cyan/5"
                  : "border-cyber-border bg-cyber-surface/30",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px]",
                  isCurrent
                    ? "bg-cyber-cyan/20 text-cyber-cyan"
                    : "bg-cyber-surface/60 text-cyber-muted",
                )}
              >
                v{v.version}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-cyber-text">{v.changelog}</p>
                <p className="text-[10px] text-cyber-muted">
                  {formatTime(v.createdAt)} · {v.variables.length} 变量
                </p>
              </div>
              {isCurrent ? (
                <span className="shrink-0 rounded border border-cyber-cyan/30 bg-cyber-cyan/10 px-1.5 py-0.5 text-[10px] text-cyber-cyan">
                  当前
                </span>
              ) : (
                <button
                  onClick={() => onRollback(v.version)}
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-cyber-border bg-cyber-surface/40 px-2 py-1 text-[10px] text-cyber-muted transition-colors hover:border-cyber-amber/50 hover:text-cyber-amber"
                  title="回滚到此版本"
                >
                  <RotateCcw className="size-3" />
                  回滚
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
