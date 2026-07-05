"use client";

import { useSessionStore } from "@/stores/session";
import { Button } from "@/components/ui/button";
import {
  Plus,
  MessageSquare,
  Pin,
  Trash2,
  Edit2,
  FileText,
  FlaskConical,
  Settings,
  Brain,
  GitBranch,
  BookOpen,
  Users,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  open: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ open, onCloseMobile }: SidebarProps) {
  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeId);
  const newSession = useSessionStore((s) => s.newSession);
  const selectSession = useSessionStore((s) => s.selectSession);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const renameSession = useSessionStore((s) => s.renameSession);
  const togglePin = useSessionStore((s) => s.togglePin);

  const list = Object.values(sessions).sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.updatedAt - a.updatedAt;
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  return (
    <>
      {/* 移动端遮罩 */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={cn(
          "glass fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-cyber-border transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-cyber-border px-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyber-muted">
            会话
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              newSession();
              onCloseMobile();
            }}
            className="gap-1.5"
          >
            <Plus className="size-3.5" />
            新建
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {list.length === 0 && (
            <div className="flex h-32 flex-col items-center justify-center text-center text-xs text-cyber-muted">
              <MessageSquare className="mb-2 size-6 opacity-40" />
              <p>暂无会话</p>
            </div>
          )}
          {list.map((s) => (
            <div
              key={s.id}
              className={cn(
                "group relative flex items-center gap-2 rounded-md px-2 py-2 text-xs transition-colors",
                s.id === activeId
                  ? "bg-cyber-card/80 text-cyber-text shadow-neon"
                  : "text-cyber-muted hover:bg-cyber-surface/40 hover:text-cyber-text",
              )}
            >
              <button
                onClick={() => {
                  selectSession(s.id);
                  onCloseMobile();
                }}
                className="flex flex-1 items-center gap-2 truncate text-left"
              >
                {s.pinned && <Pin className="size-3 text-cyber-amber" />}
                {editingId === s.id ? (
                  <input
                    ref={inputRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => {
                      if (editValue.trim()) renameSession(s.id, editValue.trim());
                      setEditingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (editValue.trim()) renameSession(s.id, editValue.trim());
                        setEditingId(null);
                      } else if (e.key === "Escape") {
                        setEditingId(null);
                      }
                    }}
                    className="w-full bg-transparent text-xs outline-none"
                  />
                ) : (
                  <span className="truncate">{s.title}</span>
                )}
              </button>

              <div className="hidden items-center gap-0.5 group-hover:flex">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePin(s.id);
                  }}
                  className="rounded p-1 hover:bg-cyber-surface"
                  title="置顶"
                >
                  <Pin
                    className={cn("size-3", s.pinned ? "text-cyber-amber" : "text-cyber-muted")}
                  />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(s.id);
                    setEditValue(s.title);
                  }}
                  className="rounded p-1 hover:bg-cyber-surface"
                  title="重命名"
                >
                  <Edit2 className="size-3 text-cyber-muted" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`删除会话 "${s.title}"？`)) deleteSession(s.id);
                  }}
                  className="rounded p-1 hover:bg-cyber-danger/20"
                  title="删除"
                >
                  <Trash2 className="size-3 text-cyber-danger" />
                </button>
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-0.5 border-t border-cyber-border p-3">
          <a
            href="/prompts"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-cyber-muted transition-colors hover:bg-cyber-surface/40 hover:text-cyber-cyan"
          >
            <FileText className="size-3.5" />
            <span>提示词模板</span>
          </a>
          <a
            href="/playground"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-cyber-muted transition-colors hover:bg-cyber-surface/40 hover:text-cyber-cyan"
          >
            <FlaskConical className="size-3.5" />
            <span>Playground</span>
          </a>
          <a
            href="/memory"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-cyber-muted transition-colors hover:bg-cyber-surface/40 hover:text-cyber-cyan"
          >
            <Brain className="size-3.5" />
            <span>记忆管理</span>
          </a>
          <a
            href="/reasoning"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-cyber-muted transition-colors hover:bg-cyber-surface/40 hover:text-cyber-cyan"
          >
            <GitBranch className="size-3.5" />
            <span>推理实验室</span>
          </a>
          <a
            href="/docs"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-cyber-muted transition-colors hover:bg-cyber-surface/40 hover:text-cyber-cyan"
          >
            <BookOpen className="size-3.5" />
            <span>学习中心</span>
          </a>
          <a
            href="/settings"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-cyber-muted transition-colors hover:bg-cyber-surface/40 hover:text-cyber-cyan"
          >
            <Settings className="size-3.5" />
            <span>设置 / API 配置</span>
          </a>
          <p className="mt-2 text-[10px] text-cyber-muted/60">NEXUS · M8 · 高级推理</p>
        </div>
      </aside>
    </>
  );
}
