"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { BUILTIN_TEMPLATES } from "@/server/prompts/builtin-templates";
import { extractVariables } from "@/server/prompts/variable-parser";
import type { PromptVariable } from "@/server/db/schema";

/** 版本记录 */
export interface PromptVersionData {
  version: number;
  systemPrompt: string;
  variables: PromptVariable[];
  changelog: string;
  createdAt: number;
}

/** 模板数据（前端 Store 版本） */
export interface PromptTemplateData {
  id: string;
  name: string;
  description: string;
  category: string;
  systemPrompt: string;
  variables: PromptVariable[];
  tags: string[];
  isBuiltin: boolean;
  currentVersion: number;
  versions: PromptVersionData[];
  createdAt: number;
  updatedAt: number;
}

interface PromptsState {
  templates: Record<string, PromptTemplateData>;
  activeId: string | null;
  hydrated: boolean;

  list: () => PromptTemplateData[];
  get: (id: string) => PromptTemplateData | undefined;
  create: (data: {
    name: string;
    description?: string;
    category?: string;
    systemPrompt: string;
    variables?: PromptVariable[];
    tags?: string[];
  }) => string;
  update: (
    id: string,
    data: Partial<
      Pick<
        PromptTemplateData,
        "name" | "description" | "category" | "systemPrompt" | "variables" | "tags"
      >
    > & { changelog?: string },
  ) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => string | null;
  rollback: (id: string, version: number) => void;
  setActive: (id: string | null) => void;
  setHydrated: () => void;
}

function builtinToTemplate(b: (typeof BUILTIN_TEMPLATES)[number]): PromptTemplateData {
  return {
    id: b.id,
    name: b.name,
    description: b.description,
    category: b.category,
    systemPrompt: b.systemPrompt,
    variables: b.variables,
    tags: b.tags,
    isBuiltin: true,
    currentVersion: 1,
    versions: [
      {
        version: 1,
        systemPrompt: b.systemPrompt,
        variables: b.variables,
        changelog: "初始版本",
        createdAt: Date.now(),
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function genId(): string {
  return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const usePromptsStore = create<PromptsState>()(
  persist(
    (set, get) => ({
      templates: {},
      activeId: null,
      hydrated: false,

      list: () => {
        const all = Object.values(get().templates);
        // 确保 builtin 模板始终存在
        const existingIds = new Set(all.map((t) => t.id));
        const missing = BUILTIN_TEMPLATES.filter((b) => !existingIds.has(b.id)).map(
          builtinToTemplate,
        );
        return [...all, ...missing].sort((a, b) => {
          if (a.isBuiltin !== b.isBuiltin) return a.isBuiltin ? -1 : 1;
          return b.updatedAt - a.updatedAt;
        });
      },

      get: (id) => {
        const t = get().templates[id];
        if (t) return t;
        const b = BUILTIN_TEMPLATES.find((b) => b.id === id);
        return b ? builtinToTemplate(b) : undefined;
      },

      create: (data) => {
        const id = genId();
        const now = Date.now();
        const variables =
          data.variables ?? extractVariables(data.systemPrompt).map((name) => ({ name }));
        const template: PromptTemplateData = {
          id,
          name: data.name,
          description: data.description ?? "",
          category: data.category ?? "custom",
          systemPrompt: data.systemPrompt,
          variables,
          tags: data.tags ?? [],
          isBuiltin: false,
          currentVersion: 1,
          versions: [
            {
              version: 1,
              systemPrompt: data.systemPrompt,
              variables,
              changelog: "初始版本",
              createdAt: now,
            },
          ],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ templates: { ...s.templates, [id]: template }, activeId: id }));
        return id;
      },

      update: (id, data) => {
        set((s) => {
          const existing = s.templates[id];
          if (!existing) return s;
          const now = Date.now();
          const newVersion = existing.currentVersion + 1;
          const updated: PromptTemplateData = {
            ...existing,
            name: data.name ?? existing.name,
            description: data.description ?? existing.description,
            category: data.category ?? existing.category,
            systemPrompt: data.systemPrompt ?? existing.systemPrompt,
            variables: data.variables ?? existing.variables,
            tags: data.tags ?? existing.tags,
            currentVersion: newVersion,
            updatedAt: now,
            versions: [
              ...existing.versions,
              {
                version: newVersion,
                systemPrompt: data.systemPrompt ?? existing.systemPrompt,
                variables: data.variables ?? existing.variables,
                changelog: data.changelog ?? `版本 ${newVersion}`,
                createdAt: now,
              },
            ],
          };
          return { templates: { ...s.templates, [id]: updated } };
        });
      },

      remove: (id) => {
        set((s) => {
          const t = s.templates[id];
          if (t?.isBuiltin) return s; // 不能删除内置模板
          const next = { ...s.templates };
          delete next[id];
          return { templates: next, activeId: s.activeId === id ? null : s.activeId };
        });
      },

      duplicate: (id) => {
        const src = get().get(id);
        if (!src) return null;
        const newId = genId();
        const now = Date.now();
        const copy: PromptTemplateData = {
          ...src,
          id: newId,
          name: `${src.name}（副本）`,
          isBuiltin: false,
          currentVersion: 1,
          versions: [
            {
              version: 1,
              systemPrompt: src.systemPrompt,
              variables: src.variables,
              changelog: `复制自 ${src.name}`,
              createdAt: now,
            },
          ],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ templates: { ...s.templates, [newId]: copy }, activeId: newId }));
        return newId;
      },

      rollback: (id, version) => {
        set((s) => {
          const existing = s.templates[id];
          if (!existing) return s;
          const target = existing.versions.find((v) => v.version === version);
          if (!target) return s;
          const now = Date.now();
          const newVersion = existing.currentVersion + 1;
          const updated: PromptTemplateData = {
            ...existing,
            systemPrompt: target.systemPrompt,
            variables: target.variables,
            currentVersion: newVersion,
            updatedAt: now,
            versions: [
              ...existing.versions,
              {
                version: newVersion,
                systemPrompt: target.systemPrompt,
                variables: target.variables,
                changelog: `回滚到版本 ${version}`,
                createdAt: now,
              },
            ],
          };
          return { templates: { ...s.templates, [id]: updated } };
        });
      },

      setActive: (id) => set({ activeId: id }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "nexus-prompts",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
