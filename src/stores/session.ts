"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { Message } from "@/lib/types";

export interface ChatSession {
  id: string;
  title: string;
  agentId?: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
}

interface SessionState {
  sessions: Record<string, ChatSession>;
  activeId: string | null;
  hydrated: boolean;

  // 会话操作
  newSession: (title?: string) => string;
  selectSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  deleteSession: (id: string) => void;
  togglePin: (id: string) => void;
  clearAll: () => void;

  // 消息操作
  appendMessage: (sessionId: string, msg: Message) => void;
  updateMessage: (sessionId: string, msgId: string, patch: Partial<Message>) => void;
  appendToLastMessage: (sessionId: string, delta: string) => void;
  removeLastAssistant: (sessionId: string) => void;
  setActiveStreaming: (streaming: boolean) => void;

  // 状态
  isStreaming: boolean;
  setHydrated: () => void;
}

const sample: ChatSession = {
  id: "welcome",
  title: "👋 欢迎使用 NEXUS",
  messages: [
    {
      id: nanoid(),
      role: "assistant",
      content: `你好！我是 **NEXUS** —— 一个面向开发者的 AI Agent 学习项目。\n\n当前运行在 \`Mock Provider\` 模式（无需 API Key）。你可以：\n\n- 直接在下方输入框开始对话\n- 打开 \`/settings\` 切换到任意 OpenAI 兼容模型\n- 点击左上 ⌘ 切换侧边栏\n\n试试这些关键词看效果：\n- **你好** —— 自我介绍\n- **LRU 缓存** —— TypeScript 代码示例\n- **Next.js App Router** —— 与 Pages Router 对比\n- **帮我规划** —— 计划式回复\n\n> M1 阶段只做基础对话。M2 起会逐步加入工具调用、ReAct 推理、多智能体协作等能力。`,
      createdAt: Date.now(),
    },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: { [sample.id]: sample },
      activeId: sample.id,
      hydrated: false,
      isStreaming: false,

      setHydrated: () => set({ hydrated: true }),
      setActiveStreaming: (streaming) => set({ isStreaming: streaming }),

      newSession: (title) => {
        const id = nanoid(10);
        const now = Date.now();
        const session: ChatSession = {
          id,
          title: title ?? "新会话",
          messages: [],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({
          sessions: { ...s.sessions, [id]: session },
          activeId: id,
        }));
        return id;
      },

      selectSession: (id) => set({ activeId: id }),

      renameSession: (id, title) =>
        set((s) => {
          const session = s.sessions[id];
          if (!session) return s;
          return {
            sessions: {
              ...s.sessions,
              [id]: { ...session, title, updatedAt: Date.now() },
            },
          };
        }),

      deleteSession: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.sessions;
          const next = Object.keys(rest)[0] ?? null;
          return { sessions: rest, activeId: next };
        }),

      togglePin: (id) =>
        set((s) => {
          const session = s.sessions[id];
          if (!session) return s;
          return {
            sessions: {
              ...s.sessions,
              [id]: { ...session, pinned: !session.pinned },
            },
          };
        }),

      clearAll: () => set({ sessions: {}, activeId: null }),

      appendMessage: (sessionId, msg) =>
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                messages: [...session.messages, msg],
                updatedAt: Date.now(),
              },
            },
          };
        }),

      updateMessage: (sessionId, msgId, patch) =>
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                messages: session.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
                updatedAt: Date.now(),
              },
            },
          };
        }),

      appendToLastMessage: (sessionId, delta) =>
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session || session.messages.length === 0) return s;
          const messages = [...session.messages];
          const last = messages[messages.length - 1];
          messages[messages.length - 1] = { ...last, content: last.content + delta };
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: { ...session, messages, updatedAt: Date.now() },
            },
          };
        }),

      removeLastAssistant: (sessionId: string) =>
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session || session.messages.length === 0) return s;
          const messages = [...session.messages];
          // 删掉最后一条 assistant（用于"重新生成"）
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === "assistant") {
              messages.splice(i, 1);
              break;
            }
          }
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: { ...session, messages, updatedAt: Date.now() },
            },
          };
        }),
    }),
    {
      name: "nexus-sessions",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
