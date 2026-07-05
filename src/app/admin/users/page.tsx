"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import {
  Users as UsersIcon,
  Shield,
  User,
  Mail,
  Trash2,
  UserCheck,
  UserX,
  ArrowLeft,
  AlertCircle,
  Check,
  Clock,
} from "lucide-react";

interface UserItem {
  id: string;
  email: string;
  name?: string;
  role: "admin" | "user";
  emailVerified: boolean;
  provider?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, fetchMe } = useAuthStore();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/");
      return;
    }
    if (user) {
      loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "加载失败");
      } else {
        setUsers(data.users || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (userId: string, role: "admin" | "user") => {
    setActionMsg(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg({ type: "error", text: data.error || "操作失败" });
      } else {
        setActionMsg({ type: "success", text: "角色已更新" });
        loadUsers();
      }
    } catch (err) {
      setActionMsg({ type: "error", text: err instanceof Error ? err.message : "操作失败" });
    }
    setTimeout(() => setActionMsg(null), 2000);
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("确定要删除该用户吗？此操作不可恢复。")) return;
    setActionMsg(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg({ type: "error", text: data.error || "删除失败" });
      } else {
        setActionMsg({ type: "success", text: "用户已删除" });
        loadUsers();
      }
    } catch (err) {
      setActionMsg({ type: "error", text: err instanceof Error ? err.message : "删除失败" });
    }
    setTimeout(() => setActionMsg(null), 2000);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-cyber-muted">加载中...</div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => router.push("/settings")}
          className="mb-6 inline-flex items-center gap-1 text-xs text-cyber-muted transition-colors hover:text-cyber-cyan"
        >
          <ArrowLeft className="size-3" /> 返回设置
        </button>

        <header className="mb-8 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border border-cyber-purple/30 bg-cyber-purple/10">
            <UsersIcon className="size-5 text-cyber-purple" />
          </div>
          <div>
            <h1 className="text-gradient font-display text-2xl font-semibold">用户管理</h1>
            <p className="text-xs text-cyber-muted">管理系统用户和权限。</p>
          </div>
        </header>

        {actionMsg && (
          <div
            className={`mb-4 flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${
              actionMsg.type === "success"
                ? "border border-cyber-lime/30 bg-cyber-lime/10 text-cyber-lime"
                : "border border-red-500/30 bg-red-500/10 text-red-400"
            }`}
          >
            {actionMsg.type === "success" ? (
              <Check className="size-4" />
            ) : (
              <AlertCircle className="size-4" />
            )}
            {actionMsg.text}
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            <AlertCircle className="size-4" />
            {error}
          </div>
        )}

        <div className="glass overflow-hidden rounded-xl border-cyber-border">
          <div className="flex items-center justify-between border-b border-cyber-border/60 px-5 py-3">
            <span className="text-sm font-medium text-cyber-text">用户列表</span>
            <span className="text-xs text-cyber-muted">{users.length} 个用户</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-cyber-muted">加载中...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center">
              <UsersIcon className="mx-auto mb-2 size-10 text-cyber-muted/50" />
              <p className="text-sm text-cyber-muted">暂无用户</p>
            </div>
          ) : (
            <div className="divide-y divide-cyber-border/60">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-4 px-5 py-4">
                  <div
                    className={`flex size-10 items-center justify-center rounded-full ${
                      u.role === "admin" ? "bg-cyber-purple/20" : "bg-cyber-cyan/20"
                    }`}
                  >
                    {u.role === "admin" ? (
                      <Shield className="size-5 text-cyber-purple" />
                    ) : (
                      <User className="size-5 text-cyber-cyan" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-cyber-text">
                        {u.name || u.email}
                      </span>
                      {u.role === "admin" && (
                        <span className="shrink-0 rounded bg-cyber-purple/20 px-1.5 py-0.5 text-[9px] text-cyber-purple">
                          管理员
                        </span>
                      )}
                      {u.emailVerified ? (
                        <span className="shrink-0 rounded bg-cyber-lime/20 px-1.5 py-0.5 text-[9px] text-cyber-lime">
                          已验证
                        </span>
                      ) : (
                        <span className="shrink-0 rounded bg-cyber-amber/20 px-1.5 py-0.5 text-[9px] text-cyber-amber">
                          未验证
                        </span>
                      )}
                      {u.provider && (
                        <span className="shrink-0 rounded bg-cyber-cyan/20 px-1.5 py-0.5 text-[9px] text-cyber-cyan">
                          {u.provider}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-[11px] text-cyber-muted">
                      <span className="flex items-center gap-1">
                        <Mail className="size-3" />
                        {u.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        注册: {formatDate(u.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {u.id !== user.userId && (
                      <>
                        {u.role === "user" ? (
                          <button
                            onClick={() => updateRole(u.id, "admin")}
                            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-cyber-purple transition-colors hover:bg-cyber-purple/10"
                            title="设为管理员"
                          >
                            <UserCheck className="size-3" />
                            设为管理员
                          </button>
                        ) : (
                          <button
                            onClick={() => updateRole(u.id, "user")}
                            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-cyber-muted transition-colors hover:bg-cyber-surface/60"
                            title="取消管理员"
                          >
                            <UserX className="size-3" />
                            取消管理员
                          </button>
                        )}
                        <button
                          onClick={() => deleteUser(u.id)}
                          className="rounded p-1.5 text-cyber-muted transition-colors hover:bg-cyber-danger/10 hover:text-cyber-danger"
                          title="删除用户"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                    {u.id === user.userId && (
                      <span className="px-2 text-[10px] text-cyber-muted">（当前用户）</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
