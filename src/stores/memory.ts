"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  MemoryEntry,
  MemoryKind,
  MemoryStatus,
  ExperienceEntry,
  ExperienceType,
} from "@/server/memory";

interface MemoryState {
  memories: Record<string, MemoryEntry>;
  experiences: Record<string, ExperienceEntry>;
  activeMemoryId: string | null;
  activeExperienceId: string | null;

  listMemories: (options?: { kind?: MemoryKind; status?: MemoryStatus }) => MemoryEntry[];
  getMemory: (id: string) => MemoryEntry | undefined;
  addMemory: (data: {
    sessionId?: string;
    kind: MemoryKind;
    content: string;
    summary?: string;
    topics?: string[];
    importance?: number;
    source?: string;
    metadata?: Record<string, unknown>;
  }) => MemoryEntry;
  updateMemory: (
    id: string,
    updates: Partial<
      Pick<MemoryEntry, "content" | "summary" | "topics" | "importance" | "status" | "metadata">
    >,
  ) => void;
  deleteMemory: (id: string) => void;
  searchMemories: (query: string) => Promise<Array<{ memory: MemoryEntry; similarity: number }>>;

  listExperiences: (options?: { type?: ExperienceType }) => ExperienceEntry[];
  getExperience: (id: string) => ExperienceEntry | undefined;
  addExperience: (data: {
    sessionId?: string;
    runId?: string;
    type: ExperienceType;
    title: string;
    description?: string;
    lesson: string;
    context?: Record<string, unknown>;
    tags?: string[];
    rating?: number;
  }) => ExperienceEntry;
  updateExperience: (
    id: string,
    updates: Partial<
      Pick<ExperienceEntry, "title" | "description" | "lesson" | "tags" | "rating" | "context">
    >,
  ) => void;
  deleteExperience: (id: string) => void;
  searchExperiences: (query: string) => ExperienceEntry[];

  setActiveMemory: (id: string | null) => void;
  setActiveExperience: (id: string | null) => void;
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useMemoryStore = create<MemoryState>()(
  persist(
    (set, get) => ({
      memories: {},
      experiences: {},
      activeMemoryId: null,
      activeExperienceId: null,

      listMemories: (options) => {
        return Object.values(get().memories)
          .filter((m) => {
            if (options?.kind && m.kind !== options.kind) return false;
            if (options?.status && m.status !== options.status) return false;
            return true;
          })
          .sort((a, b) => b.updatedAt - a.updatedAt);
      },

      getMemory: (id) => get().memories[id],

      addMemory: (data) => {
        const now = Date.now();
        const entry: MemoryEntry = {
          id: `mem-${genId()}`,
          sessionId: data.sessionId,
          kind: data.kind,
          content: data.content,
          summary: data.summary || data.content.slice(0, 100),
          topics: data.topics || [],
          importance: data.importance ?? 50,
          embedding: [],
          source: data.source || "manual",
          metadata: data.metadata || {},
          status: "active",
          referencedCount: 0,
          createdAt: now,
          updatedAt: now,
          lastAccessedAt: now,
        };
        set((s) => ({ memories: { ...s.memories, [entry.id]: entry }, activeMemoryId: entry.id }));
        return entry;
      },

      updateMemory: (id, updates) => {
        set((s) => {
          const existing = s.memories[id];
          if (!existing) return s;
          return {
            memories: {
              ...s.memories,
              [id]: {
                ...existing,
                ...updates,
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      deleteMemory: (id) => {
        set((s) => {
          const next = { ...s.memories };
          delete next[id];
          return {
            memories: next,
            activeMemoryId: s.activeMemoryId === id ? null : s.activeMemoryId,
          };
        });
      },

      searchMemories: async (query) => {
        const res = await fetch("/api/memories/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ query }),
        });
        const data = await res.json();
        return data.results || [];
      },

      listExperiences: (options) => {
        return Object.values(get().experiences)
          .filter((e) => {
            if (options?.type && e.type !== options.type) return false;
            return true;
          })
          .sort((a, b) => b.updatedAt - a.updatedAt);
      },

      getExperience: (id) => get().experiences[id],

      addExperience: (data) => {
        const now = Date.now();
        const entry: ExperienceEntry = {
          id: `exp-${genId()}`,
          sessionId: data.sessionId,
          runId: data.runId,
          type: data.type,
          title: data.title,
          description: data.description || "",
          lesson: data.lesson,
          context: data.context || {},
          tags: data.tags || [],
          rating: data.rating ?? 0,
          referencedCount: 0,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({
          experiences: { ...s.experiences, [entry.id]: entry },
          activeExperienceId: entry.id,
        }));
        return entry;
      },

      updateExperience: (id, updates) => {
        set((s) => {
          const existing = s.experiences[id];
          if (!existing) return s;
          return {
            experiences: {
              ...s.experiences,
              [id]: {
                ...existing,
                ...updates,
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      deleteExperience: (id) => {
        set((s) => {
          const next = { ...s.experiences };
          delete next[id];
          return {
            experiences: next,
            activeExperienceId: s.activeExperienceId === id ? null : s.activeExperienceId,
          };
        });
      },

      searchExperiences: (query) => {
        const lower = query.toLowerCase();
        return Object.values(get().experiences)
          .filter(
            (e) =>
              e.title.toLowerCase().includes(lower) ||
              e.description.toLowerCase().includes(lower) ||
              e.lesson.toLowerCase().includes(lower) ||
              e.tags.some((t) => t.toLowerCase().includes(lower)),
          )
          .sort((a, b) => b.rating - a.rating);
      },

      setActiveMemory: (id) => set({ activeMemoryId: id }),
      setActiveExperience: (id) => set({ activeExperienceId: id }),
    }),
    {
      name: "nexus-memory-store",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
