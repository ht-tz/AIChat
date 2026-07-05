"use client";

import { useSessionStore } from "@/stores/session";
import { useSettingsStore, getAllModels, getModelById, type ModelOption } from "@/stores/settings";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Settings,
  Bot,
  Sparkles,
  PanelLeft,
  Trash2,
  FileText,
  Key,
  LogOut,
  User,
  UserCog,
  ChevronDown,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";

interface TopBarProps {
  onToggleSidebar: () => void;
}

function groupByVendor(models: ModelOption[]): Array<{ vendor: string; models: ModelOption[] }> {
  const map = new Map<string, ModelOption[]>();
  for (const m of models) {
    const v = m.custom ? "自定义" : (m.vendor ?? "其他");
    if (!map.has(v)) map.set(v, []);
    map.get(v)!.push(m);
  }
  return Array.from(map.entries()).map(([vendor, models]) => ({ vendor, models }));
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const router = useRouter();
  const newSession = useSessionStore((s) => s.newSession);
  const clearAll = useSessionStore((s) => s.clearAll);
  const activeId = useSessionStore((s) => s.activeId);
  const sessions = useSessionStore((s) => s.sessions);
  const modelId = useSettingsStore((s) => s.modelId);
  const customModels = useSettingsStore((s) => s.customModels);
  const setModel = useSettingsStore((s) => s.setModel);
  const modelKeysMap = useSettingsStore((s) => s.modelApiKeys);
  const serverConfigs = useSettingsStore((s) => s.serverConfigs);
  const isLoggedIn = useSettingsStore((s) => s.isLoggedIn);
  const [modelOpen, setModelOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const user = useAuthStore((s) => s.user);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const logout = useAuthStore((s) => s.logout);
  const setLoggedIn = useSettingsStore((s) => s.setLoggedIn);
  const setServerConfigs = useSettingsStore((s) => s.setServerConfigs);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    const loggedIn = !!user;
    setLoggedIn(loggedIn);
    if (loggedIn) {
      fetch("/api/model-configs", { credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          setServerConfigs(data.configs || [], data.activeModelId || null);
        })
        .catch(() => {});
    } else {
      setServerConfigs([], null);
    }
  }, [user, setLoggedIn, setServerConfigs]);

  const allModels = getAllModels(customModels);
  const activeModel = useMemo(() => getModelById(modelId, customModels), [modelId, customModels]);
  const modelGroups = useMemo(() => groupByVendor(allModels), [allModels]);
  const modelHasKey = useMemo(() => {
    if (modelId === "mock-default") return true;
    if (isLoggedIn) return !!serverConfigs[modelId]?.hasKey;
    return !!(modelKeysMap[modelId] || (activeModel?.custom && activeModel.apiKey));
  }, [modelId, isLoggedIn, serverConfigs, modelKeysMap, activeModel]);

  const activeSession = Object.values(sessions).find((s) => s.id === activeId);

  const handleExport = async () => {
    if (!activeId) return;
    setExporting(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId: activeId, format: "markdown" }),
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeSession?.title?.replace(/\s+/g, "_") || "report"}.md`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/auth");
  };

  return (
    <header className="glass-strong sticky top-0 z-30 flex h-14 items-center justify-between border-b border-cyber-border px-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label="切换侧边栏"
          className="lg:hidden"
        >
          <PanelLeft className="size-5" />
        </Button>
        <button onClick={() => newSession()} className="flex items-center gap-2">
          <div className="relative flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyber-cyan via-cyber-purple to-cyber-magenta">
            <Sparkles className="size-4 animate-pulse-neon text-white" />
          </div>
          <div>
            <h1 className="text-gradient font-display text-base font-semibold tracking-wide">
              NEXUS
            </h1>
            <p className="-mt-0.5 text-[10px] uppercase tracking-[0.2em] text-cyber-muted">
              AI · Agent
            </p>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setModelOpen((v) => !v)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all ${
              !modelHasKey
                ? "border-cyber-amber/60 bg-cyber-amber/10 hover:border-cyber-amber hover:shadow-[0_0_12px_rgba(251,191,36,0.3)]"
                : "btn-glow border-cyber-border bg-cyber-surface/60 hover:border-cyber-cyan hover:shadow-neon"
            }`}
          >
            {!modelHasKey ? (
              <Key className="size-3.5 text-cyber-amber" />
            ) : (
              <Bot className="size-3.5 text-cyber-cyan" />
            )}
            <span className={!modelHasKey ? "text-cyber-amber" : "text-cyber-text"}>
              {activeModel?.label ?? modelId}
            </span>
            {activeModel?.custom && <span className="text-[10px] text-cyber-lime">✦</span>}
            {!modelHasKey && activeModel?.provider !== "mock" && (
              <span className="rounded bg-cyber-amber/20 px-1.5 py-0.5 text-[10px] text-cyber-amber">
                需填 Key
              </span>
            )}
            <span className="text-cyber-muted">▾</span>
          </button>
          {modelOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setModelOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-64 overflow-y-auto rounded-lg border border-cyber-border bg-cyber-surface/95 p-1 shadow-neon backdrop-blur-xl">
                <a
                  href="/settings"
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-cyber-muted transition-colors hover:bg-cyber-card hover:text-cyber-text"
                >
                  <Settings className="size-3.5" />
                  <span>管理模型</span>
                </a>
                <div className="my-1 h-px bg-cyber-border" />
                {modelGroups.map((group) => (
                  <div key={group.vendor}>
                    <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-cyber-muted">
                      {group.vendor}
                    </div>
                    {group.models.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setModel(m.id);
                          setModelOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-xs transition-colors hover:bg-cyber-card ${
                          m.id === modelId ? "bg-cyber-cyan/10 text-cyber-cyan" : "text-cyber-text"
                        }`}
                      >
                        <span className="flex items-center gap-1 truncate">
                          {m.label}
                          {m.custom && <span className="text-[9px] text-cyber-lime">✦</span>}
                        </span>
                        {m.provider === "mock" ? (
                          <span className="text-[10px] text-cyber-muted">Mock</span>
                        ) : m.id === modelId ? (
                          <span className="text-[10px] text-cyber-cyan">● 在用</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleExport}
          disabled={!activeId || exporting}
          title="导出报告"
          className="text-cyber-amber hover:text-cyber-amber/80"
        >
          {exporting ? (
            <div className="size-4 animate-spin rounded-full border-2 border-cyber-amber border-t-transparent" />
          ) : (
            <FileText className="size-5" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (confirm("确定清空所有会话？此操作不可恢复。")) clearAll();
          }}
          title="清空所有会话"
        >
          <Trash2 className="size-4" />
        </Button>

        <a href="/settings" aria-label="设置">
          <Button variant="ghost" size="icon">
            <Settings className="size-5" />
          </Button>
        </a>

        <div className="relative ml-1">
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-cyber-border bg-cyber-surface/60 px-2 py-1.5 text-xs transition-all hover:border-cyber-cyan hover:shadow-neon"
          >
            <div className="flex size-6 items-center justify-center rounded-full bg-cyber-cyan/20 text-cyber-cyan">
              <User className="size-3.5" />
            </div>
            {user ? (
              <span className="max-w-[80px] truncate text-cyber-text">
                {user.name || user.email}
              </span>
            ) : (
              <span className="text-cyber-muted">未登录</span>
            )}
            <ChevronDown
              className={`size-3 text-cyber-muted transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
            />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-cyber-border bg-cyber-surface/95 p-1 shadow-neon backdrop-blur-xl">
                {user ? (
                  <>
                    <div className="border-b border-cyber-border/60 px-3 py-2">
                      <div className="text-xs font-medium text-cyber-text">
                        {user.name || user.email}
                      </div>
                      <div className="text-[10px] text-cyber-muted">{user.email}</div>
                      <div className="mt-1 flex items-center gap-1">
                        {user.role === "admin" && (
                          <span className="rounded bg-cyber-purple/20 px-1.5 py-0.5 text-[9px] text-cyber-purple">
                            管理员
                          </span>
                        )}
                        {user.emailVerified ? (
                          <span className="rounded bg-cyber-lime/20 px-1.5 py-0.5 text-[9px] text-cyber-lime">
                            已验证
                          </span>
                        ) : (
                          <span className="rounded bg-cyber-amber/20 px-1.5 py-0.5 text-[9px] text-cyber-amber">
                            未验证
                          </span>
                        )}
                      </div>
                    </div>
                    <a
                      href="/settings"
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-cyber-text transition-colors hover:bg-cyber-card"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Settings className="size-3.5" />
                      设置
                    </a>
                    {user.role === "admin" && (
                      <a
                        href="/admin/users"
                        className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-cyber-text transition-colors hover:bg-cyber-card"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <UserCog className="size-3.5" />
                        用户管理
                      </a>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-cyber-danger transition-colors hover:bg-cyber-danger/10"
                    >
                      <LogOut className="size-3.5" />
                      退出登录
                    </button>
                  </>
                ) : (
                  <>
                    <a
                      href="/auth"
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-cyber-cyan transition-colors hover:bg-cyber-card"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <User className="size-3.5" />
                      登录 / 注册
                    </a>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
