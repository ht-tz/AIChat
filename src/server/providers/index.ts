// LLM Provider 抽象 —— 统一所有大模型调用入口
// 支持两种用法：
// 1. getProvider() —— 从环境变量读取配置（适合服务端固定配置）
// 2. createProvider(opts) —— 动态传参（适合前端设置页传来的 apiKey/baseUrl）
//
// 优先级：动态传参 > 环境变量 > Mock
// 安全说明：API Key 只在单次请求的内存中使用，不写入日志、不持久化到 DB

import type { ChatRequest, ToolDefinition, AgentStep, Attachment } from "@/lib/types";

export interface LLMProvider {
  stream(opts: {
    messages: Array<{
      role: "system" | "user" | "assistant" | "tool";
      content: string;
      name?: string;
      toolCallId?: string;
      attachments?: Attachment[];
    }>;
    tools?: ToolDefinition[];
    model?: string;
    temperature?: number;
    signal?: AbortSignal;
  }): AsyncIterable<AgentStep>;
  complete(opts: {
    messages: Array<{
      role: "system" | "user" | "assistant" | "tool";
      content: string;
      name?: string;
      toolCallId?: string;
      attachments?: Attachment[];
    }>;
    model?: string;
    temperature?: number;
    jsonMode?: boolean;
  }): Promise<{ content: string; usage: { prompt: number; completion: number; total: number } }>;
  embed(text: string): Promise<number[]>;
  name: string;
}

export interface ProviderConfig {
  provider?: "openai" | "mock" | "langchain";
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
}

import { MockProvider } from "./mock";
import { OpenAIProvider } from "./openai";

function getEnvProvider(): "openai" | "mock" | "langchain" {
  const kind = (process.env.LLM_PROVIDER ?? "mock").toLowerCase();
  if (kind === "openai" || kind === "langchain") return kind;
  return "mock";
}

function buildOpenAIProvider(apiKey: string, baseUrl: string, model: string): OpenAIProvider {
  return new OpenAIProvider({
    baseURL: baseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    apiKey,
    defaultModel: model || process.env.DEFAULT_MODEL || "gpt-4o-mini",
  });
}

// P1 优化：缓存 Provider 实例，按 apiKey+baseUrl 哈希，复用 HTTP 连接池（TLS keep-alive）
const providerCache = new Map<string, LLMProvider>();

/**
 * 动态创建 Provider（支持从前端请求中传来的 apiKey/baseUrl）
 *
 * 决策逻辑：
 * 1. 如果显式传入 provider=mock → Mock
 * 2. 如果传入了 apiKey → 使用 OpenAI 兼容协议（支持所有厂商：OpenAI/DeepSeek/通义千问/智谱/Ollama等）
 * 3. 如果环境变量 LLM_PROVIDER=openai 且有 OPENAI_API_KEY → 环境变量配置的 OpenAI
 * 4. 如果环境变量 LLM_PROVIDER=langchain → LangChain Provider
 * 5. 否则 Mock（学习模式，无需 Key）
 */
export function createProvider(cfg?: ProviderConfig): LLMProvider {
  // 显式 mock
  if (cfg?.provider === "mock") return new MockProvider();

  // 前端传来 apiKey —— 从缓存获取或创建 OpenAI 兼容 Provider
  if (cfg?.apiKey && cfg.apiKey.trim().length > 0) {
    const cacheKey = `${cfg.apiKey.trim()}|${cfg.baseUrl || ""}`;
    const cached = providerCache.get(cacheKey);
    if (cached) return cached;
    const provider = buildOpenAIProvider(cfg.apiKey.trim(), cfg.baseUrl || "", cfg.model || "");
    providerCache.set(cacheKey, provider);
    return provider;
  }

  // 环境变量配置
  const envProvider = getEnvProvider();
  if (envProvider === "openai" && process.env.OPENAI_API_KEY) {
    const cacheKey = `env|${process.env.OPENAI_API_KEY}|${process.env.OPENAI_BASE_URL || ""}`;
    const cached = providerCache.get(cacheKey);
    if (cached) return cached;
    const provider = buildOpenAIProvider(
      process.env.OPENAI_API_KEY,
      process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      process.env.DEFAULT_MODEL || "gpt-4o-mini",
    );
    providerCache.set(cacheKey, provider);
    return provider;
  }
  if (envProvider === "langchain") {
    const { LangChainProvider } = require("@/server/langchain/provider");
    return new LangChainProvider() as LLMProvider;
  }

  return new MockProvider();
}

/**
 * 兼容旧接口 —— 仅从环境变量创建 Provider
 * 新代码请使用 createProvider(cfg)
 */
export function getProvider(): LLMProvider {
  return createProvider();
}

/**
 * 检测当前是否使用真实模型（非 Mock）
 */
export function isRealProvider(cfg?: ProviderConfig): boolean {
  const p = createProvider(cfg);
  return p.name !== "mock";
}
