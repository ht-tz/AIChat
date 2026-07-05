"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nanoid } from "nanoid";

export type ModelProvider = "mock" | "openai";
export type ThemeId = "cyber-dark" | "cyber-light" | "ocean" | "forest" | "sunset" | "midnight";

export type ModelOption = {
  id: string;
  label: string;
  provider: ModelProvider;
  baseUrl?: string;
  vendor?: string;
  custom?: boolean;
  apiKey?: string;
  model?: string;
};

export type CustomModelInput = {
  label: string;
  modelId: string;
  baseUrl: string;
  vendor?: string;
  apiKey?: string;
};

export interface ServerModelConfig {
  id: string;
  modelId: string;
  label: string;
  vendor: string;
  baseUrl: string;
  apiKeyMasked: string;
  apiKeyPrefix: string;
  hasKey: boolean;
  temperature: number;
  isActive: boolean;
}

export const MODEL_OPTIONS: ModelOption[] = [
  { id: "mock-default", label: "Mock（学习模式）", provider: "mock", vendor: "内置" },
  // ─── OpenAI ───
  {
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    vendor: "OpenAI",
  },
  {
    id: "gpt-4o",
    label: "GPT-4o",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    vendor: "OpenAI",
  },
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    vendor: "OpenAI",
  },
  {
    id: "gpt-5.5",
    label: "GPT-5.5",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    vendor: "OpenAI",
  },
  // ─── DeepSeek ───
  {
    id: "deepseek-v4",
    label: "DeepSeek-V4",
    provider: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    vendor: "DeepSeek",
  },
  {
    id: "deepseek-v4-pro",
    label: "DeepSeek-V4 Pro",
    provider: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    vendor: "DeepSeek",
  },
  {
    id: "deepseek-v4-flash",
    label: "DeepSeek-V4 Flash",
    provider: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    vendor: "DeepSeek",
  },
  {
    id: "deepseek-chat",
    label: "DeepSeek-V3",
    provider: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    vendor: "DeepSeek",
  },
  {
    id: "deepseek-reasoner",
    label: "DeepSeek-R1",
    provider: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    vendor: "DeepSeek",
  },
  // ─── 通义千问（阿里） ───
  {
    id: "qwen3.7-max",
    label: "Qwen3.7-Max",
    provider: "openai",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    vendor: "通义千问",
  },
  {
    id: "qwen3.5-plus",
    label: "Qwen3.5 Plus",
    provider: "openai",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    vendor: "通义千问",
  },
  {
    id: "qwen3.5-397b-a17b",
    label: "Qwen3.5-397B",
    provider: "openai",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    vendor: "通义千问",
  },
  {
    id: "qwen3-235b-a22b",
    label: "Qwen3-235B",
    provider: "openai",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    vendor: "通义千问",
  },
  {
    id: "qwen3-72b",
    label: "Qwen3-72B",
    provider: "openai",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    vendor: "通义千问",
  },
  {
    id: "qwen3-32b",
    label: "Qwen3-32B",
    provider: "openai",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    vendor: "通义千问",
  },
  {
    id: "qwen-plus",
    label: "千问 Plus",
    provider: "openai",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    vendor: "通义千问",
  },
  {
    id: "qwen-turbo",
    label: "千问 Turbo",
    provider: "openai",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    vendor: "通义千问",
  },
  {
    id: "qwen-long",
    label: "千问 Long",
    provider: "openai",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    vendor: "通义千问",
  },
  // ─── 豆包（字节/火山引擎） ───
  {
    id: "doubao-seed",
    label: "豆包 Seed",
    provider: "openai",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    vendor: "豆包",
  },
  {
    id: "doubao-2-pro-32k",
    label: "豆包 2.0 Pro 32K",
    provider: "openai",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    vendor: "豆包",
  },
  {
    id: "doubao-2-lite-32k",
    label: "豆包 2.0 Lite 32K",
    provider: "openai",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    vendor: "豆包",
  },
  {
    id: "doubao-1-5-pro-32k-250115",
    label: "豆包 1.5 Pro 32K",
    provider: "openai",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    vendor: "豆包",
  },
  {
    id: "doubao-1-5-lite-32k-250115",
    label: "豆包 1.5 Lite 32K",
    provider: "openai",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    vendor: "豆包",
  },
  {
    id: "doubao-pro-4k",
    label: "豆包 Pro 4K",
    provider: "openai",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    vendor: "豆包",
  },
  {
    id: "doubao-lite-4k",
    label: "豆包 Lite 4K",
    provider: "openai",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    vendor: "豆包",
  },
  // ─── 智谱 GLM ───
  {
    id: "glm-5.1",
    label: "GLM-5.1",
    provider: "openai",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    vendor: "智谱",
  },
  {
    id: "glm-5",
    label: "GLM-5",
    provider: "openai",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    vendor: "智谱",
  },
  {
    id: "glm-4.5",
    label: "GLM-4.5",
    provider: "openai",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    vendor: "智谱",
  },
  {
    id: "glm-4-plus",
    label: "GLM-4 Plus",
    provider: "openai",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    vendor: "智谱",
  },
  {
    id: "glm-4-air",
    label: "GLM-4 Air",
    provider: "openai",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    vendor: "智谱",
  },
  {
    id: "glm-4-long",
    label: "GLM-4 Long",
    provider: "openai",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    vendor: "智谱",
  },
  {
    id: "glm-4-flash",
    label: "GLM-4 Flash",
    provider: "openai",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    vendor: "智谱",
  },
  // ─── Kimi（月之暗面） ───
  {
    id: "kimi-k2.6",
    label: "Kimi K2.6",
    provider: "openai",
    baseUrl: "https://api.moonshot.cn/v1",
    vendor: "Kimi",
  },
  {
    id: "kimi-k2",
    label: "Kimi K2",
    provider: "openai",
    baseUrl: "https://api.moonshot.cn/v1",
    vendor: "Kimi",
  },
  {
    id: "moonshot-v1-auto",
    label: "Kimi Auto",
    provider: "openai",
    baseUrl: "https://api.moonshot.cn/v1",
    vendor: "Kimi",
  },
  {
    id: "moonshot-v1-128k",
    label: "Kimi（128K）",
    provider: "openai",
    baseUrl: "https://api.moonshot.cn/v1",
    vendor: "Kimi",
  },
  {
    id: "moonshot-v1-32k",
    label: "Kimi（32K）",
    provider: "openai",
    baseUrl: "https://api.moonshot.cn/v1",
    vendor: "Kimi",
  },
  {
    id: "moonshot-v1-8k",
    label: "Kimi（8K）",
    provider: "openai",
    baseUrl: "https://api.moonshot.cn/v1",
    vendor: "Kimi",
  },
  // ─── 百度文心一言 ───
  {
    id: "ernie-5.1",
    label: "文心 5.1",
    provider: "openai",
    baseUrl: "https://qianfan.baidubce.com/v2",
    vendor: "文心一言",
  },
  {
    id: "ernie-5.0",
    label: "文心 5.0",
    provider: "openai",
    baseUrl: "https://qianfan.baidubce.com/v2",
    vendor: "文心一言",
  },
  {
    id: "ernie-4.5",
    label: "文心 4.5",
    provider: "openai",
    baseUrl: "https://qianfan.baidubce.com/v2",
    vendor: "文心一言",
  },
  // ─── 小米 MiMo ───
  {
    id: "mimo-v2.5-pro",
    label: "MiMo V2.5 Pro",
    provider: "openai",
    baseUrl: "https://api.xiaomimimo.com/v1",
    vendor: "小米",
  },
  {
    id: "mimo-v2.5-coding-plan",
    label: "MiMo V2.5 Coding Plan",
    provider: "openai",
    baseUrl: "https://token-plan-cn.xiaomimimo.com/v1",
    vendor: "小米",
  },
  {
    id: "mimo-v2.5",
    label: "MiMo V2.5（全模态）",
    provider: "openai",
    baseUrl: "https://api.xiaomimimo.com/v1",
    vendor: "小米",
  },
  {
    id: "mimo-v2-flash",
    label: "MiMo V2 Flash（快速）",
    provider: "openai",
    baseUrl: "https://api.xiaomimimo.com/v1",
    vendor: "小米",
  },
  // ─── MiniMax ───
  {
    id: "minimax-m2.7",
    label: "MiniMax M2.7",
    provider: "openai",
    baseUrl: "https://api.minimaxi.com/v1",
    vendor: "MiniMax",
  },
];

export function getModelById(
  id: string,
  customModels: ModelOption[] = [],
): ModelOption | undefined {
  return [...MODEL_OPTIONS, ...customModels].find((m) => m.id === id);
}

export function getAllModels(customModels: ModelOption[] = []): ModelOption[] {
  return [...MODEL_OPTIONS, ...customModels];
}

export const VENDOR_KEY_URLS: Record<string, string> = {
  OpenAI: "https://platform.openai.com/api-keys",
  DeepSeek: "https://platform.deepseek.com/api_keys",
  通义千问: "https://dashscope.console.aliyun.com/apiKey",
  豆包: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
  智谱: "https://open.bigmodel.cn/usercenter/apikeys",
  Kimi: "https://platform.moonshot.cn/console/api-keys",
  文心一言: "https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application",
  小米: "https://platform.xiaomimimo.com/settings/api-keys",
  MiniMax: "https://platform.minimaxi.com/user-center/basic-information/interface-key",
};

export const DEFAULT_ENABLED_TOOLS = [
  "calculator",
  "get_current_time",
  "web_search",
  "code_runner",
  "word_count",
  "read_file",
  "generate_image",
  "read_pdf",
];

interface SettingsState {
  modelId: string;
  temperature: number;
  theme: ThemeId;
  enabledTools: string[];
  customModels: ModelOption[];
  modelApiKeys: Record<string, string>;
  serverConfigs: Record<string, ServerModelConfig>;
  serverActiveModelId: string | null;
  isLoggedIn: boolean;
  hydrated: boolean;

  setModel: (id: string) => void;
  setTemperature: (t: number) => void;
  setTheme: (t: SettingsState["theme"]) => void;
  toggleTool: (name: string) => void;
  setEnabledTools: (names: string[]) => void;
  addCustomModel: (input: CustomModelInput) => ModelOption;
  removeCustomModel: (id: string) => void;
  updateCustomModel: (id: string, input: Partial<CustomModelInput>) => void;
  setLocalModelKey: (modelId: string, key: string) => void;
  setServerConfigs: (configs: ServerModelConfig[], activeModelId: string | null) => void;
  setLoggedIn: (logged: boolean) => void;
  getModelKey: (modelId: string) => string | null;
  getModelBaseUrl: (modelId: string) => string;
  hasModelKey: (modelId: string) => boolean;
  setHydrated: () => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      modelId: "mock-default",
      temperature: 0.7,
      theme: "cyber-dark",
      enabledTools: [...DEFAULT_ENABLED_TOOLS],
      customModels: [],
      modelApiKeys: {},
      serverConfigs: {},
      serverActiveModelId: null,
      isLoggedIn: false,
      hydrated: false,

      setModel: (modelId) => {
        set({ modelId });
      },
      setTemperature: (temperature) => set({ temperature }),
      setTheme: (theme) => set({ theme }),
      toggleTool: (name) =>
        set((s) => ({
          enabledTools: s.enabledTools.includes(name)
            ? s.enabledTools.filter((t) => t !== name)
            : [...s.enabledTools, name],
        })),
      setEnabledTools: (enabledTools) => set({ enabledTools }),
      addCustomModel: (input) => {
        const id = `custom-${nanoid(8)}`;
        const newModel: ModelOption = {
          id,
          label: input.label,
          provider: "openai",
          model: input.modelId,
          baseUrl: input.baseUrl.endsWith("/") ? input.baseUrl.slice(0, -1) : input.baseUrl,
          vendor: input.vendor || "自定义",
          custom: true,
          apiKey: input.apiKey,
        };
        set((s) => ({ customModels: [...s.customModels, newModel] }));
        if (input.apiKey) {
          set((s) => ({ modelApiKeys: { ...s.modelApiKeys, [id]: input.apiKey! } }));
        }
        return newModel;
      },
      removeCustomModel: (id) =>
        set((s) => {
          const next = s.customModels.filter((m) => m.id !== id);
          const newKeys = { ...s.modelApiKeys };
          delete newKeys[id];
          const modelId = s.modelId === id ? "mock-default" : s.modelId;
          return {
            customModels: next,
            modelApiKeys: newKeys,
            modelId,
          };
        }),
      updateCustomModel: (id, input) =>
        set((s) => ({
          customModels: s.customModels.map((m) =>
            m.id === id
              ? {
                  ...m,
                  label: input.label ?? m.label,
                  model: input.modelId ?? m.model,
                  baseUrl: input.baseUrl
                    ? input.baseUrl.endsWith("/")
                      ? input.baseUrl.slice(0, -1)
                      : input.baseUrl
                    : m.baseUrl,
                  vendor: input.vendor ?? m.vendor,
                  apiKey: input.apiKey ?? m.apiKey,
                }
              : m,
          ),
          ...(input.apiKey ? { modelApiKeys: { ...s.modelApiKeys, [id]: input.apiKey } } : {}),
        })),
      setLocalModelKey: (modelId, key) =>
        set((s) => ({
          modelApiKeys: { ...s.modelApiKeys, [modelId]: key },
        })),
      setServerConfigs: (configs, activeModelId) => {
        const map: Record<string, ServerModelConfig> = {};
        for (const c of configs) {
          map[c.modelId] = c;
        }
        set({ serverConfigs: map, serverActiveModelId: activeModelId });
        if (activeModelId && !get().modelId) {
          set({ modelId: activeModelId });
        }
      },
      setLoggedIn: (isLoggedIn) => set({ isLoggedIn }),
      getModelKey: (modelId) => {
        const state = get();
        if (modelId === "mock-default") return "mock";
        if (state.isLoggedIn && state.serverConfigs[modelId]?.hasKey) {
          return "__server__";
        }
        const localKey = state.modelApiKeys[modelId];
        if (localKey) return localKey;
        const customModel = state.customModels.find((m) => m.id === modelId);
        return customModel?.apiKey ?? null;
      },
      getModelBaseUrl: (modelId) => {
        const state = get();
        if (state.isLoggedIn && state.serverConfigs[modelId]) {
          return state.serverConfigs[modelId].baseUrl;
        }
        const model = getModelById(modelId, state.customModels);
        return model?.baseUrl ?? "";
      },
      hasModelKey: (modelId) => {
        const state = get();
        if (modelId === "mock-default") return true;
        if (state.isLoggedIn) {
          return !!state.serverConfigs[modelId]?.hasKey;
        }
        return !!state.modelApiKeys[modelId];
      },
      setHydrated: () => set({ hydrated: true }),
      reset: () =>
        set({
          modelId: "mock-default",
          temperature: 0.7,
          theme: "cyber-dark",
          enabledTools: [...DEFAULT_ENABLED_TOOLS],
          customModels: [],
          modelApiKeys: {},
          serverConfigs: {},
          serverActiveModelId: null,
        }),
    }),
    {
      name: "nexus-settings-v2",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

export const TOOL_DISPLAY: Array<{
  name: string;
  label: string;
  description: string;
  icon: string;
}> = [
  { name: "calculator", label: "数学计算", description: "calculator", icon: "∑" },
  { name: "get_current_time", label: "当前时间", description: "get_current_time", icon: "⏱" },
  { name: "web_search", label: "联网搜索", description: "web_search", icon: "🔍" },
  { name: "code_runner", label: "JS 沙箱", description: "code_runner", icon: "</>" },
  { name: "word_count", label: "字数统计", description: "word_count", icon: "Ab" },
  { name: "read_file", label: "读取文件", description: "read_file", icon: "📄" },
  { name: "generate_image", label: "生成图片", description: "generate_image", icon: "🎨" },
  { name: "summarize_report", label: "导出报告", description: "summarize_report", icon: "📋" },
];
