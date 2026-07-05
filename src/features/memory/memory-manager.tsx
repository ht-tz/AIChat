"use client";

import { useState } from "react";
import {
  Brain,
  BookOpen,
  Sparkles,
  Clock,
  Star,
  Trash2,
  Plus,
  Search,
  Filter,
  ChevronDown,
  ArrowLeft,
  X,
  Tag,
  Zap,
  AlertCircle,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemoryStore } from "@/stores/memory";
import type {
  MemoryKind,
  MemoryStatus,
  ExperienceType,
  MemoryEntry,
  ExperienceEntry,
} from "@/server/memory";

type TabType = "memories" | "experiences";

function MemoryKindTag({ kind }: { kind: MemoryKind }) {
  const config = {
    short: { label: "短期记忆", color: "bg-cyber-cyan/20 text-cyber-cyan border-cyber-cyan/30" },
    long: {
      label: "长期记忆",
      color: "bg-cyber-purple/20 text-cyber-purple border-cyber-purple/30",
    },
    episodic: {
      label: "情景记忆",
      color: "bg-cyber-magenta/20 text-cyber-magenta border-cyber-magenta/30",
    },
  };
  const { label, color } = config[kind];
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", color)}>
      {label}
    </span>
  );
}

function MemoryStatusTag({ status }: { status: MemoryStatus }) {
  const config = {
    active: { label: "活跃", color: "bg-cyber-lime/20 text-cyber-lime border-cyber-lime/30" },
    archived: {
      label: "已归档",
      color: "bg-cyber-amber/20 text-cyber-amber border-cyber-amber/30",
    },
    forgotten: {
      label: "已遗忘",
      color: "bg-cyber-muted/20 text-cyber-muted border-cyber-muted/30",
    },
  };
  const { label, color } = config[status];
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", color)}>
      {label}
    </span>
  );
}

function ExperienceTypeTag({ type }: { type: ExperienceType }) {
  const config = {
    success: {
      label: "成功",
      color: "bg-cyber-lime/20 text-cyber-lime border-cyber-lime/30",
      icon: Zap,
    },
    failure: {
      label: "失败",
      color: "bg-cyber-danger/20 text-cyber-danger border-cyber-danger/30",
      icon: AlertCircle,
    },
    insight: {
      label: "洞察",
      color: "bg-cyber-amber/20 text-cyber-amber border-cyber-amber/30",
      icon: Lightbulb,
    },
  };
  const { label, color, icon: Icon } = config[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        color,
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function StarRating({
  rating,
  onRatingChange,
}: {
  rating: number;
  onRatingChange?: (r: number) => void;
}) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center gap-1">
      {stars.map((star) => (
        <button
          key={star}
          onClick={() => onRatingChange?.(star)}
          className={cn(
            "rounded p-1 transition-all",
            star <= rating ? "text-cyber-amber" : "text-cyber-muted hover:text-cyber-amber/70",
          )}
        >
          <Star className={cn("h-4 w-4", star <= rating ? "fill-current" : "")} />
        </button>
      ))}
      <span className="ml-2 text-xs text-cyber-muted">{rating}/5</span>
    </div>
  );
}

function MemoryList({
  memories,
  activeId,
  onSelect,
  searchQuery,
  onSearchChange,
  kindFilter,
  onKindFilterChange,
  statusFilter,
  onStatusFilterChange,
}: {
  memories: MemoryEntry[];
  activeId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  kindFilter: MemoryKind | "all";
  onKindFilterChange: (k: MemoryKind | "all") => void;
  statusFilter: MemoryStatus | "all";
  onStatusFilterChange: (s: MemoryStatus | "all") => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyber-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索记忆..."
          className="w-full rounded-lg border border-cyber-border bg-cyber-surface py-2 pl-10 pr-4 text-sm text-cyber-text placeholder-cyber-muted transition-colors focus:border-cyber-cyan/50 focus:outline-none"
        />
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyber-muted" />
          <select
            value={kindFilter}
            onChange={(e) => onKindFilterChange(e.target.value as MemoryKind | "all")}
            className="w-full cursor-pointer appearance-none rounded-lg border border-cyber-border bg-cyber-surface py-2 pl-10 pr-8 text-sm text-cyber-text focus:border-cyber-cyan/50 focus:outline-none"
          >
            <option value="all">所有类型</option>
            <option value="short">短期记忆</option>
            <option value="long">长期记忆</option>
            <option value="episodic">情景记忆</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyber-muted" />
        </div>
        <div className="relative flex-1">
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as MemoryStatus | "all")}
            className="w-full cursor-pointer appearance-none rounded-lg border border-cyber-border bg-cyber-surface py-2 pl-3 pr-8 text-sm text-cyber-text focus:border-cyber-cyan/50 focus:outline-none"
          >
            <option value="all">所有状态</option>
            <option value="active">活跃</option>
            <option value="archived">已归档</option>
            <option value="forgotten">已遗忘</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyber-muted" />
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pr-2">
        {memories.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-cyber-muted">
            <Brain className="mb-3 h-12 w-12 opacity-30" />
            <p className="text-sm">暂无记忆</p>
          </div>
        ) : (
          memories.map((memory) => (
            <div
              key={memory.id}
              onClick={() => onSelect(memory.id)}
              className={cn(
                "cursor-pointer rounded-lg border p-3 transition-all",
                activeId === memory.id
                  ? "border-cyber-cyan/40 bg-cyber-cyan/10 shadow-neon"
                  : "border-cyber-border bg-cyber-surface hover:border-cyber-cyan/30 hover:bg-cyber-surface/80",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-cyber-text">{memory.summary}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <MemoryKindTag kind={memory.kind} />
                    <MemoryStatusTag status={memory.status} />
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-cyber-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(memory.updatedAt).toLocaleDateString()}
                    </span>
                    <span>重要度: {memory.importance}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MemoryDetail({
  memory,
  onUpdate,
  onDelete,
}: {
  memory: MemoryEntry;
  onUpdate: (
    updates: Partial<Pick<MemoryEntry, "content" | "summary" | "topics" | "importance" | "status">>,
  ) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(memory.content);
  const [editSummary, setEditSummary] = useState(memory.summary);
  const [editTopics, setEditTopics] = useState(memory.topics.join(", "));

  const handleSave = () => {
    onUpdate({
      content: editContent,
      summary: editSummary,
      topics: editTopics
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setIsEditing(false);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MemoryKindTag kind={memory.kind} />
          <MemoryStatusTag status={memory.status} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
              isEditing
                ? "border-cyber-lime/30 bg-cyber-lime/20 text-cyber-lime"
                : "border-cyber-border bg-cyber-surface text-cyber-muted hover:border-cyber-cyan/30",
            )}
          >
            {isEditing ? "保存" : "编辑"}
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-2 text-cyber-danger transition-colors hover:bg-cyber-danger/10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-2">
        <div>
          <label className="mb-2 block text-xs text-cyber-muted">内容</label>
          {isEditing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="h-32 w-full resize-none rounded-lg border border-cyber-border bg-cyber-surface p-3 text-sm text-cyber-text focus:border-cyber-cyan/50 focus:outline-none"
            />
          ) : (
            <div className="whitespace-pre-wrap rounded-lg border border-cyber-border bg-cyber-surface p-3 text-sm text-cyber-text">
              {memory.content}
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-xs text-cyber-muted">摘要</label>
          {isEditing ? (
            <input
              type="text"
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              className="w-full rounded-lg border border-cyber-border bg-cyber-surface p-3 text-sm text-cyber-text focus:border-cyber-cyan/50 focus:outline-none"
            />
          ) : (
            <p className="text-sm text-cyber-text">{memory.summary}</p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-xs text-cyber-muted">主题</label>
          {isEditing ? (
            <input
              type="text"
              value={editTopics}
              onChange={(e) => setEditTopics(e.target.value)}
              placeholder="用逗号分隔"
              className="w-full rounded-lg border border-cyber-border bg-cyber-surface p-3 text-sm text-cyber-text focus:border-cyber-cyan/50 focus:outline-none"
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {memory.topics.map((topic) => (
                <span
                  key={topic}
                  className="inline-flex items-center gap-1 rounded-full border border-cyber-purple/20 bg-cyber-purple/10 px-2 py-1 text-xs text-cyber-purple"
                >
                  <Tag className="h-3 w-3" />
                  {topic}
                </span>
              ))}
              {memory.topics.length === 0 && (
                <span className="text-xs text-cyber-muted">暂无主题</span>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-xs text-cyber-muted">重要度: {memory.importance}</label>
          <input
            type="range"
            min="0"
            max="100"
            value={memory.importance}
            onChange={(e) => onUpdate({ importance: parseInt(e.target.value) })}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-cyber-surface accent-cyber-cyan"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs text-cyber-muted">状态</label>
          <div className="flex gap-2">
            {(["active", "archived", "forgotten"] as MemoryStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => onUpdate({ status })}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                  memory.status === status
                    ? status === "active"
                      ? "border-cyber-lime/30 bg-cyber-lime/20 text-cyber-lime"
                      : status === "archived"
                        ? "border-cyber-amber/30 bg-cyber-amber/20 text-cyber-amber"
                        : "border-cyber-muted/30 bg-cyber-muted/20 text-cyber-muted"
                    : "border-cyber-border bg-cyber-surface text-cyber-muted hover:border-cyber-cyan/30",
                )}
              >
                {status === "active" ? "活跃" : status === "archived" ? "已归档" : "已遗忘"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-cyber-border pt-4">
          <div>
            <label className="mb-1 block text-xs text-cyber-muted">创建时间</label>
            <p className="text-sm text-cyber-text">{new Date(memory.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-cyber-muted">更新时间</label>
            <p className="text-sm text-cyber-text">{new Date(memory.updatedAt).toLocaleString()}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-cyber-muted">访问次数</label>
            <p className="text-sm text-cyber-text">{memory.referencedCount}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-cyber-muted">来源</label>
            <p className="text-sm text-cyber-text">{memory.source}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExperienceList({
  experiences,
  activeId,
  onSelect,
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
}: {
  experiences: ExperienceEntry[];
  activeId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  typeFilter: ExperienceType | "all";
  onTypeFilterChange: (t: ExperienceType | "all") => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyber-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索经验..."
          className="w-full rounded-lg border border-cyber-border bg-cyber-surface py-2 pl-10 pr-4 text-sm text-cyber-text placeholder-cyber-muted transition-colors focus:border-cyber-cyan/50 focus:outline-none"
        />
      </div>

      <div className="mb-4 flex gap-2">
        {(["all", "success", "failure", "insight"] as (ExperienceType | "all")[]).map((type) => (
          <button
            key={type}
            onClick={() => onTypeFilterChange(type)}
            className={cn(
              "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
              typeFilter === type
                ? "border-cyber-cyan/40 bg-cyber-cyan/10 text-cyber-cyan"
                : "border-cyber-border bg-cyber-surface text-cyber-muted hover:border-cyber-cyan/30",
            )}
          >
            {type === "all"
              ? "全部"
              : type === "success"
                ? "成功"
                : type === "failure"
                  ? "失败"
                  : "洞察"}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pr-2">
        {experiences.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-cyber-muted">
            <BookOpen className="mb-3 h-12 w-12 opacity-30" />
            <p className="text-sm">暂无经验</p>
          </div>
        ) : (
          experiences.map((exp) => (
            <div
              key={exp.id}
              onClick={() => onSelect(exp.id)}
              className={cn(
                "cursor-pointer rounded-lg border p-3 transition-all",
                activeId === exp.id
                  ? "border-cyber-cyan/40 bg-cyber-cyan/10 shadow-neon"
                  : "border-cyber-border bg-cyber-surface hover:border-cyber-cyan/30 hover:bg-cyber-surface/80",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-cyber-text">{exp.title}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <ExperienceTypeTag type={exp.type} />
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-cyber-muted">
                    <StarRating rating={exp.rating} />
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(exp.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ExperienceDetail({
  experience,
  onUpdate,
  onDelete,
}: {
  experience: ExperienceEntry;
  onUpdate: (
    updates: Partial<Pick<ExperienceEntry, "title" | "description" | "lesson" | "tags" | "rating">>,
  ) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(experience.title);
  const [editDescription, setEditDescription] = useState(experience.description);
  const [editLesson, setEditLesson] = useState(experience.lesson);
  const [editTags, setEditTags] = useState(experience.tags.join(", "));

  const handleSave = () => {
    onUpdate({
      title: editTitle,
      description: editDescription,
      lesson: editLesson,
      tags: editTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setIsEditing(false);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <ExperienceTypeTag type={experience.type} />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
              isEditing
                ? "border-cyber-lime/30 bg-cyber-lime/20 text-cyber-lime"
                : "border-cyber-border bg-cyber-surface text-cyber-muted hover:border-cyber-cyan/30",
            )}
          >
            {isEditing ? "保存" : "编辑"}
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-2 text-cyber-danger transition-colors hover:bg-cyber-danger/10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-2">
        <div>
          <label className="mb-2 block text-xs text-cyber-muted">标题</label>
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-lg border border-cyber-border bg-cyber-surface p-3 text-sm text-cyber-text focus:border-cyber-cyan/50 focus:outline-none"
            />
          ) : (
            <h3 className="text-lg font-semibold text-cyber-text">{experience.title}</h3>
          )}
        </div>

        <div>
          <label className="mb-2 block text-xs text-cyber-muted">描述</label>
          {isEditing ? (
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="h-24 w-full resize-none rounded-lg border border-cyber-border bg-cyber-surface p-3 text-sm text-cyber-text focus:border-cyber-cyan/50 focus:outline-none"
            />
          ) : (
            <p className="text-sm text-cyber-text">{experience.description || "无描述"}</p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-xs text-cyber-muted">经验教训</label>
          {isEditing ? (
            <textarea
              value={editLesson}
              onChange={(e) => setEditLesson(e.target.value)}
              className="h-32 w-full resize-none rounded-lg border border-cyber-border bg-cyber-surface p-3 text-sm text-cyber-text focus:border-cyber-cyan/50 focus:outline-none"
            />
          ) : (
            <div className="rounded-lg border border-cyber-amber/20 bg-cyber-amber/10 p-4">
              <p className="text-sm text-cyber-text">{experience.lesson}</p>
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-xs text-cyber-muted">标签</label>
          {isEditing ? (
            <input
              type="text"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              placeholder="用逗号分隔"
              className="w-full rounded-lg border border-cyber-border bg-cyber-surface p-3 text-sm text-cyber-text focus:border-cyber-cyan/50 focus:outline-none"
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {experience.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full border border-cyber-purple/20 bg-cyber-purple/10 px-2 py-1 text-xs text-cyber-purple"
                >
                  <Tag className="h-3 w-3" />
                  {tag}
                </span>
              ))}
              {experience.tags.length === 0 && (
                <span className="text-xs text-cyber-muted">暂无标签</span>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-xs text-cyber-muted">评分</label>
          <StarRating rating={experience.rating} onRatingChange={(r) => onUpdate({ rating: r })} />
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-cyber-border pt-4">
          <div>
            <label className="mb-1 block text-xs text-cyber-muted">创建时间</label>
            <p className="text-sm text-cyber-text">
              {new Date(experience.createdAt).toLocaleString()}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-cyber-muted">更新时间</label>
            <p className="text-sm text-cyber-text">
              {new Date(experience.updatedAt).toLocaleString()}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-cyber-muted">访问次数</label>
            <p className="text-sm text-cyber-text">{experience.referencedCount}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-cyber-muted">会话ID</label>
            <p className="font-mono text-sm text-cyber-text">{experience.sessionId || "-"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MemoryGraph({ memories }: { memories: MemoryEntry[] }) {
  const recentMemories = memories.slice(0, 8);

  const getPosition = (index: number, total: number) => {
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    const radius = 80 + (index % 2) * 20;
    return {
      x: 150 + radius * Math.cos(angle),
      y: 120 + radius * Math.sin(angle),
    };
  };

  const getNodeColor = (kind: MemoryKind) => {
    switch (kind) {
      case "short":
        return "#00F0FF";
      case "long":
        return "#B14EFF";
      case "episodic":
        return "#FF2E97";
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-medium text-cyber-text">
          <Sparkles className="h-4 w-4 text-cyber-cyan" />
          记忆图谱
        </h4>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-cyber-cyan" />
            短期
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-cyber-purple" />
            长期
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-cyber-magenta" />
            情景
          </span>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-lg border border-cyber-border bg-cyber-surface/50">
        <div className="absolute inset-0 bg-grid-neon bg-grid-32 opacity-50" />
        {recentMemories.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-cyber-muted">
            暂无记忆数据
          </div>
        ) : (
          <svg viewBox="0 0 300 240" className="h-full w-full">
            <circle
              cx="150"
              cy="120"
              r="15"
              fill="rgba(0, 240, 255, 0.2)"
              stroke="#00F0FF"
              strokeWidth="1"
            />
            <text x="150" y="125" textAnchor="middle" fill="#00F0FF" fontSize="10">
              中心
            </text>

            {recentMemories.map((memory, index) => {
              const pos = getPosition(index, recentMemories.length);
              const color = getNodeColor(memory.kind);
              return (
                <g key={memory.id}>
                  <line
                    x1="150"
                    y1="120"
                    x2={pos.x}
                    y2={pos.y}
                    stroke="rgba(0, 240, 255, 0.2)"
                    strokeWidth="1"
                    strokeDasharray="4"
                  />
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={8 + memory.importance / 20}
                    fill={`${color}20`}
                    stroke={color}
                    strokeWidth="1.5"
                    className="cursor-pointer transition-all duration-300 hover:opacity-80"
                  />
                  <text x={pos.x} y={pos.y + 20} textAnchor="middle" fill="#8A8FA3" fontSize="8">
                    {memory.summary.slice(0, 8)}...
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}

function NewMemoryModal({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: {
    kind: MemoryKind;
    content: string;
    summary: string;
    topics: string[];
    importance: number;
  }) => void;
}) {
  const [kind, setKind] = useState<MemoryKind>("short");
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [topics, setTopics] = useState("");
  const [importance, setImportance] = useState(50);

  const handleSubmit = () => {
    if (!content.trim()) return;
    onAdd({
      kind,
      content: content.trim(),
      summary: summary.trim() || content.trim().slice(0, 100),
      topics: topics
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      importance,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-strong relative mx-4 w-full max-w-lg overflow-hidden rounded-xl shadow-neon">
        <div className="flex items-center justify-between border-b border-cyber-border p-4">
          <h3 className="text-lg font-semibold text-cyber-text">新建记忆</h3>
          <button onClick={onClose} className="p-1 text-cyber-muted hover:text-cyber-text">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <label className="mb-2 block text-xs text-cyber-muted">记忆类型</label>
            <div className="flex gap-2">
              {(["short", "long", "episodic"] as MemoryKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                    kind === k
                      ? k === "short"
                        ? "border-cyber-cyan/40 bg-cyber-cyan/20 text-cyber-cyan"
                        : k === "long"
                          ? "border-cyber-purple/40 bg-cyber-purple/20 text-cyber-purple"
                          : "border-cyber-magenta/40 bg-cyber-magenta/20 text-cyber-magenta"
                      : "border-cyber-border bg-cyber-surface text-cyber-muted hover:border-cyber-cyan/30",
                  )}
                >
                  {k === "short" ? "短期" : k === "long" ? "长期" : "情景"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs text-cyber-muted">内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="输入记忆内容..."
              className="h-32 w-full resize-none rounded-lg border border-cyber-border bg-cyber-surface p-3 text-sm text-cyber-text placeholder-cyber-muted focus:border-cyber-cyan/50 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs text-cyber-muted">摘要</label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="输入摘要（可选）"
              className="w-full rounded-lg border border-cyber-border bg-cyber-surface p-3 text-sm text-cyber-text placeholder-cyber-muted focus:border-cyber-cyan/50 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs text-cyber-muted">主题（逗号分隔）</label>
            <input
              type="text"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="主题1, 主题2, 主题3"
              className="w-full rounded-lg border border-cyber-border bg-cyber-surface p-3 text-sm text-cyber-text placeholder-cyber-muted focus:border-cyber-cyan/50 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs text-cyber-muted">重要度: {importance}</label>
            <input
              type="range"
              min="0"
              max="100"
              value={importance}
              onChange={(e) => setImportance(parseInt(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-cyber-surface accent-cyber-cyan"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-cyber-border p-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-cyber-muted transition-colors hover:text-cyber-text"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!content.trim()}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-all",
              content.trim()
                ? "bg-cyber-cyan text-cyber-bg hover:bg-cyber-cyan/90"
                : "cursor-not-allowed bg-cyber-surface text-cyber-muted",
            )}
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}

function NewExperienceModal({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: {
    type: ExperienceType;
    title: string;
    description: string;
    lesson: string;
    tags: string[];
    rating: number;
  }) => void;
}) {
  const [type, setType] = useState<ExperienceType>("success");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lesson, setLesson] = useState("");
  const [tags, setTags] = useState("");
  const [rating, setRating] = useState(0);

  const handleSubmit = () => {
    if (!title.trim() || !lesson.trim()) return;
    onAdd({
      type,
      title: title.trim(),
      description: description.trim(),
      lesson: lesson.trim(),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      rating,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-strong relative mx-4 w-full max-w-lg overflow-hidden rounded-xl shadow-neon">
        <div className="flex items-center justify-between border-b border-cyber-border p-4">
          <h3 className="text-lg font-semibold text-cyber-text">新建经验</h3>
          <button onClick={onClose} className="p-1 text-cyber-muted hover:text-cyber-text">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <label className="mb-2 block text-xs text-cyber-muted">经验类型</label>
            <div className="flex gap-2">
              {(["success", "failure", "insight"] as ExperienceType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                    type === t
                      ? t === "success"
                        ? "border-cyber-lime/40 bg-cyber-lime/20 text-cyber-lime"
                        : t === "failure"
                          ? "border-cyber-danger/40 bg-cyber-danger/20 text-cyber-danger"
                          : "border-cyber-amber/40 bg-cyber-amber/20 text-cyber-amber"
                      : "border-cyber-border bg-cyber-surface text-cyber-muted hover:border-cyber-cyan/30",
                  )}
                >
                  {t === "success" ? "成功" : t === "failure" ? "失败" : "洞察"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs text-cyber-muted">标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入经验标题..."
              className="w-full rounded-lg border border-cyber-border bg-cyber-surface p-3 text-sm text-cyber-text placeholder-cyber-muted focus:border-cyber-cyan/50 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs text-cyber-muted">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入详细描述（可选）"
              className="h-24 w-full resize-none rounded-lg border border-cyber-border bg-cyber-surface p-3 text-sm text-cyber-text placeholder-cyber-muted focus:border-cyber-cyan/50 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs text-cyber-muted">经验教训</label>
            <textarea
              value={lesson}
              onChange={(e) => setLesson(e.target.value)}
              placeholder="从这次经验中学到了什么？"
              className="h-24 w-full resize-none rounded-lg border border-cyber-border bg-cyber-surface p-3 text-sm text-cyber-text placeholder-cyber-muted focus:border-cyber-cyan/50 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs text-cyber-muted">标签（逗号分隔）</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="标签1, 标签2, 标签3"
              className="w-full rounded-lg border border-cyber-border bg-cyber-surface p-3 text-sm text-cyber-text placeholder-cyber-muted focus:border-cyber-cyan/50 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs text-cyber-muted">评分</label>
            <StarRating rating={rating} onRatingChange={(r) => setRating(r)} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-cyber-border p-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-cyber-muted transition-colors hover:text-cyber-text"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !lesson.trim()}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-all",
              title.trim() && lesson.trim()
                ? "bg-cyber-cyan text-cyber-bg hover:bg-cyber-cyan/90"
                : "cursor-not-allowed bg-cyber-surface text-cyber-muted",
            )}
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MemoryManager() {
  const [activeTab, setActiveTab] = useState<TabType>("memories");
  const [searchQuery, setSearchQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<MemoryKind | "all">("all");
  const [statusFilter, setStatusFilter] = useState<MemoryStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ExperienceType | "all">("all");
  const [showNewMemoryModal, setShowNewMemoryModal] = useState(false);
  const [showNewExperienceModal, setShowNewExperienceModal] = useState(false);

  const {
    memories,
    experiences,
    activeMemoryId,
    activeExperienceId,
    listMemories,
    getMemory,
    addMemory,
    updateMemory,
    deleteMemory,
    listExperiences,
    getExperience,
    addExperience,
    updateExperience,
    deleteExperience,
    searchMemories,
    searchExperiences,
    setActiveMemory,
    setActiveExperience,
  } = useMemoryStore();

  const filteredMemories = listMemories({
    kind: kindFilter !== "all" ? kindFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const filteredExperiences = listExperiences({
    type: typeFilter !== "all" ? typeFilter : undefined,
  });

  const handleAddMemory = (data: {
    kind: MemoryKind;
    content: string;
    summary: string;
    topics: string[];
    importance: number;
  }) => {
    addMemory({
      kind: data.kind,
      content: data.content,
      summary: data.summary,
      topics: data.topics,
      importance: data.importance,
    });
  };

  const handleAddExperience = (data: {
    type: ExperienceType;
    title: string;
    description: string;
    lesson: string;
    tags: string[];
    rating: number;
  }) => {
    addExperience({
      type: data.type,
      title: data.title,
      description: data.description,
      lesson: data.lesson,
      tags: data.tags,
      rating: data.rating,
    });
  };

  return (
    <div className="min-h-screen bg-cyber-bg p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 text-cyber-muted transition-colors hover:text-cyber-cyan">
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm">返回对话</span>
            </button>
            <h1 className="text-gradient flex items-center gap-3 text-2xl font-bold">
              <Brain className="h-8 w-8 text-cyber-cyan" />
              记忆管理
            </h1>
          </div>
          <button
            onClick={() =>
              activeTab === "memories"
                ? setShowNewMemoryModal(true)
                : setShowNewExperienceModal(true)
            }
            className="btn-glow inline-flex items-center gap-2 rounded-lg bg-cyber-cyan px-4 py-2 font-medium text-cyber-bg transition-colors hover:bg-cyber-cyan/90"
          >
            <Plus className="h-4 w-4" />
            {activeTab === "memories" ? "新建记忆" : "新建经验"}
          </button>
        </div>

        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setActiveTab("memories")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
              activeTab === "memories"
                ? "border border-cyber-cyan/40 bg-cyber-cyan/10 text-cyber-cyan"
                : "border border-cyber-border bg-cyber-surface text-cyber-muted hover:border-cyber-cyan/30",
            )}
          >
            <Brain className="h-4 w-4" />
            记忆库
          </button>
          <button
            onClick={() => setActiveTab("experiences")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
              activeTab === "experiences"
                ? "border border-cyber-cyan/40 bg-cyber-cyan/10 text-cyber-cyan"
                : "border border-cyber-border bg-cyber-surface text-cyber-muted hover:border-cyber-cyan/30",
            )}
          >
            <BookOpen className="h-4 w-4" />
            经验案例
          </button>
        </div>

        {activeTab === "memories" ? (
          <div className="grid grid-cols-12 gap-4">
            <div className="glass col-span-4 rounded-xl p-4">
              <MemoryList
                memories={filteredMemories}
                activeId={activeMemoryId}
                onSelect={setActiveMemory}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                kindFilter={kindFilter}
                onKindFilterChange={setKindFilter}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
              />
            </div>
            <div className="glass col-span-8 rounded-xl p-4">
              {activeMemoryId && getMemory(activeMemoryId) ? (
                <MemoryDetail
                  memory={getMemory(activeMemoryId)!}
                  onUpdate={(updates) => updateMemory(activeMemoryId!, updates)}
                  onDelete={() => deleteMemory(activeMemoryId!)}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-cyber-muted">
                  <Brain className="mb-4 h-16 w-16 opacity-30" />
                  <p className="text-lg">选择一条记忆查看详情</p>
                  <p className="mt-2 text-sm">从左侧列表中选择或创建新记忆</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            <div className="glass col-span-4 rounded-xl p-4">
              <ExperienceList
                experiences={filteredExperiences}
                activeId={activeExperienceId}
                onSelect={setActiveExperience}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                typeFilter={typeFilter}
                onTypeFilterChange={setTypeFilter}
              />
            </div>
            <div className="glass col-span-8 rounded-xl p-4">
              {activeExperienceId && getExperience(activeExperienceId) ? (
                <ExperienceDetail
                  experience={getExperience(activeExperienceId)!}
                  onUpdate={(updates) => updateExperience(activeExperienceId!, updates)}
                  onDelete={() => deleteExperience(activeExperienceId!)}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-cyber-muted">
                  <BookOpen className="mb-4 h-16 w-16 opacity-30" />
                  <p className="text-lg">选择一条经验查看详情</p>
                  <p className="mt-2 text-sm">从左侧列表中选择或创建新经验</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "memories" && (
          <div className="glass mt-4 rounded-xl p-4">
            <MemoryGraph memories={filteredMemories} />
          </div>
        )}
      </div>

      <NewMemoryModal
        isOpen={showNewMemoryModal}
        onClose={() => setShowNewMemoryModal(false)}
        onAdd={handleAddMemory}
      />

      <NewExperienceModal
        isOpen={showNewExperienceModal}
        onClose={() => setShowNewExperienceModal(false)}
        onAdd={handleAddExperience}
      />
    </div>
  );
}
