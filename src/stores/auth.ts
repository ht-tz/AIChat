import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  userId: string;
  email: string;
  name?: string;
  role: "admin" | "user";
  emailVerified?: boolean;
  provider?: string | null;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  status: "active" | "revoked";
  createdAt: string;
  expiresAt?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  verificationSent: boolean;
  apiKeys: ApiKeyItem[];
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  sendVerification: () => Promise<boolean>;
  updateProfile: (data: { name?: string }) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  fetchApiKeys: () => Promise<void>;
  createApiKey: (name: string, expiresInDays?: number) => Promise<{ key?: string; error?: string }>;
  revokeApiKey: (keyId: string) => Promise<boolean>;
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
  isEmailVerified: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      error: null,
      verificationSent: false,
      apiKeys: [],

      setUser: (user) => set({ user }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, password }),
          });
          const data = await res.json();
          if (!res.ok) {
            set({ error: data.error || "登录失败", isLoading: false });
            return false;
          }
          set({ user: data.user, isLoading: false });
          return true;
        } catch (err) {
          set({ error: err instanceof Error ? err.message : "登录失败", isLoading: false });
          return false;
        }
      },

      register: async (email, password, name) => {
        set({ isLoading: true, error: null, verificationSent: false });
        try {
          const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, password, name }),
          });
          const data = await res.json();
          if (!res.ok) {
            set({ error: data.error || "注册失败", isLoading: false });
            return false;
          }
          set({ user: data.user, isLoading: false });
          get().sendVerification();
          return true;
        } catch (err) {
          set({ error: err instanceof Error ? err.message : "注册失败", isLoading: false });
          return false;
        }
      },

      logout: async () => {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        set({ user: null, error: null, verificationSent: false, apiKeys: [] });
      },

      fetchMe: async () => {
        try {
          const res = await fetch("/api/auth/me", { credentials: "include" });
          if (res.ok) {
            const data = await res.json();
            set({ user: data.user });
          } else {
            set({ user: null });
          }
        } catch {
          set({ user: null });
        }
      },

      sendVerification: async () => {
        try {
          const res = await fetch("/api/auth/send-verification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({}),
          });
          const data = await res.json();
          if (res.ok) {
            set({ verificationSent: true });
            return true;
          }
          set({ error: data.error || "发送失败" });
          return false;
        } catch (err) {
          set({ error: err instanceof Error ? err.message : "发送失败" });
          return false;
        }
      },

      updateProfile: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch("/api/auth/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(data),
          });
          const result = await res.json();
          if (!res.ok) {
            set({ error: result.error || "更新失败", isLoading: false });
            return false;
          }
          set({ user: result.user, isLoading: false });
          return true;
        } catch (err) {
          set({ error: err instanceof Error ? err.message : "更新失败", isLoading: false });
          return false;
        }
      },

      changePassword: async (currentPassword, newPassword) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch("/api/auth/password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ currentPassword, newPassword }),
          });
          const result = await res.json();
          if (!res.ok) {
            set({ error: result.error || "密码修改失败", isLoading: false });
            return false;
          }
          set({ isLoading: false });
          return true;
        } catch (err) {
          set({ error: err instanceof Error ? err.message : "密码修改失败", isLoading: false });
          return false;
        }
      },

      fetchApiKeys: async () => {
        try {
          const res = await fetch("/api/auth/api-keys", { credentials: "include" });
          if (res.ok) {
            const data = await res.json();
            set({ apiKeys: data.keys || [] });
          }
        } catch {}
      },

      createApiKey: async (name, expiresInDays) => {
        try {
          const res = await fetch("/api/auth/api-keys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ name, expiresInDays }),
          });
          const data = await res.json();
          if (!res.ok) {
            return { error: data.error || "创建失败" };
          }
          set((s) => ({
            apiKeys: [
              ...s.apiKeys,
              {
                id: data.key.id,
                name: data.key.name,
                prefix: data.key.prefix,
                status: data.key.status,
                createdAt: data.key.createdAt,
                expiresAt: data.key.expiresAt,
              },
            ],
          }));
          return { key: data.key.key };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "创建失败" };
        }
      },

      revokeApiKey: async (keyId) => {
        try {
          const res = await fetch("/api/auth/api-keys", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ keyId }),
          });
          if (res.ok) {
            set((s) => ({
              apiKeys: s.apiKeys.map((k) => (k.id === keyId ? { ...k, status: "revoked" } : k)),
            }));
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },

      isAuthenticated: () => !!get().user,
      isAdmin: () => get().user?.role === "admin",
      isEmailVerified: () => !!get().user?.emailVerified,
    }),
    {
      name: "nexus-auth",
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
