// OpenAI 兼容 Provider
// 支持所有 OpenAI 兼容协议的厂商（OpenAI/DeepSeek/通义千问/豆包/智谱/Kimi/文心/MiMo/MiniMax 等）
// M2 升级：正确处理工具调用（累积 streaming 的 tool_call 增量，最后 yield 一次 tool_call）
// 兼容性优化：自动适配不同厂商的参数差异（max_tokens vs max_completion_tokens、错误详情提取等）

import OpenAI from "openai";
import type { LLMProvider } from "./index";
import type { AgentStep, ToolDefinition, Attachment } from "@/lib/types";
import { logger } from "@/server/logger";

interface OpenAIConfig {
  baseURL: string;
  apiKey: string;
  defaultModel: string;
}

interface ToolCallAccum {
  id: string;
  name: string;
  argsBuf: string;
}

type VendorFlavor =
  | "openai"
  | "xiaomimimo"
  | "deepseek"
  | "qwen"
  | "doubao"
  | "zhipu"
  | "kimi"
  | "wenxin"
  | "minimax"
  | "generic";

function detectVendor(baseURL: string): VendorFlavor {
  const url = baseURL.toLowerCase();
  if (url.includes("xiaomimimo.com")) return "xiaomimimo";
  if (url.includes("deepseek.com")) return "deepseek";
  if (url.includes("aliyuncs.com") || url.includes("dashscope")) return "qwen";
  if (url.includes("volces.com") || url.includes("ark.cn-beijing")) return "doubao";
  if (url.includes("bigmodel.cn")) return "zhipu";
  if (url.includes("moonshot.cn")) return "kimi";
  if (url.includes("baidubce.com") || url.includes("qianfan")) return "wenxin";
  if (url.includes("minimaxi.com")) return "minimax";
  if (url.includes("openai.com")) return "openai";
  return "generic";
}

function extractErrorMessage(err: unknown): string {
  if (!(err instanceof OpenAI.APIError)) {
    return err instanceof Error ? err.message : String(err);
  }
  const parts: string[] = [];
  if (err.status) parts.push(`HTTP ${err.status}`);
  if (err.message) parts.push(err.message);
  const body = err.error as Record<string, unknown> | undefined;
  if (body) {
    if (typeof body.message === "string" && body.message !== err.message) {
      parts.push(body.message);
    }
    if (typeof body.type === "string") parts.push(`[${body.type}]`);
    if (typeof body.code === "string" || typeof body.code === "number") {
      parts.push(`(code: ${body.code})`);
    }
  }
  return parts.join(" · ");
}

export class OpenAIProvider implements LLMProvider {
  name = "openai";
  private client: OpenAI;
  private defaultModel: string;
  private vendor: VendorFlavor;

  constructor(cfg: OpenAIConfig) {
    this.vendor = detectVendor(cfg.baseURL);
    this.client = new OpenAI({
      baseURL: cfg.baseURL,
      apiKey: cfg.apiKey,
      defaultHeaders: this.vendor === "xiaomimimo" ? { "api-key": cfg.apiKey } : undefined,
    });
    this.defaultModel = cfg.defaultModel;
  }

  private toChatMessages(
    messages: Array<{
      role: string;
      content: string;
      name?: string;
      toolCallId?: string;
      attachments?: Attachment[];
    }>,
  ) {
    return messages.map((m) => ({
      role: m.role as "system" | "user" | "assistant" | "function" | "tool",
      content: m.content,
      ...(m.name ? { name: m.name } : {}),
      ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
    }));
  }

  private toTools(tools?: ToolDefinition[]) {
    if (!tools || tools.length === 0) return undefined;
    return tools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  private buildExtraParams(tools?: ReturnType<OpenAIProvider["toTools"]>): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    if (this.vendor === "xiaomimimo") {
      params.thinking = { type: "disabled" };
    }
    if (tools && tools.length > 0) {
      if (this.vendor === "xiaomimimo" || this.vendor === "qwen" || this.vendor === "wenxin") {
        params.parallel_tool_calls = false;
      }
    }
    return params;
  }

  async *stream(opts: {
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
  }): AsyncIterable<AgentStep> {
    const model = opts.model && opts.model !== "mock-default" ? opts.model : this.defaultModel;
    const toolAccum = new Map<number, ToolCallAccum>();
    const tools = this.toTools(opts.tools);
    const extra = this.buildExtraParams(tools);

    try {
      const stream = await this.client.chat.completions.create(
        {
          model,
          messages: this.toChatMessages(opts.messages) as OpenAI.ChatCompletionMessageParam[],
          tools: tools as OpenAI.ChatCompletionTool[],
          temperature: opts.temperature ?? 0.7,
          stream: true,
          // vendor-specific params not in OpenAI SDK types
          ...extra,
        } as OpenAI.ChatCompletionCreateParams,
        { signal: opts.signal },
      );

      for await (const chunk of stream as AsyncIterable<OpenAI.ChatCompletionChunk>) {
        if (opts.signal?.aborted) return;
        const delta = chunk.choices?.[0]?.delta;
        // vendor-specific extension (e.g. DeepSeek) not in OpenAI SDK types
        const extendedDelta = delta as typeof delta & { reasoning_content?: string };

        if (extendedDelta?.reasoning_content) {
          yield { kind: "thought", content: extendedDelta.reasoning_content };
        }

        if (delta?.content) {
          yield { kind: "delta", content: delta.content };
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolAccum.has(idx)) {
              toolAccum.set(idx, {
                id: tc.id ?? `call_${idx}_${Date.now()}`,
                name: "",
                argsBuf: "",
              });
            }
            const acc = toolAccum.get(idx)!;
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name = tc.function.name;
            if (tc.function?.arguments) acc.argsBuf += tc.function.arguments;
          }
        }

        const finish = chunk.choices?.[0]?.finish_reason;
        if (finish === "tool_calls" && toolAccum.size > 0) {
          for (const acc of toolAccum.values()) {
            let parsed: Record<string, unknown> = {};
            try {
              parsed = acc.argsBuf ? JSON.parse(acc.argsBuf) : {};
            } catch {
              parsed = { _raw: acc.argsBuf, _parseError: true };
            }
            yield {
              kind: "tool_call",
              name: acc.name,
              args: parsed,
              requireConfirm: false,
            };
          }
          return;
        }

        if (finish && finish !== "tool_calls") {
          const usage = (chunk as any).usage ?? { prompt_tokens: 0, completion_tokens: 0 };
          yield {
            kind: "done",
            usage: {
              prompt: usage.prompt_tokens ?? 0,
              completion: usage.completion_tokens ?? 0,
              total: (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0),
            },
            runId: `oai-${Date.now()}`,
          };
        }
      }
    } catch (err) {
      logger.error({ err }, "[OpenAIProvider] stream error");
      yield { kind: "error", message: extractErrorMessage(err) };
    }
  }

  async complete(opts: {
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
  }): Promise<{ content: string; usage: { prompt: number; completion: number; total: number } }> {
    const model = opts.model && opts.model !== "mock-default" ? opts.model : this.defaultModel;
    // vendor-specific params (thinking, etc.) require `as any` on the full params object
    const res = (await this.client.chat.completions.create({
      model,
      messages: this.toChatMessages(opts.messages) as OpenAI.ChatCompletionMessageParam[],
      temperature: opts.temperature ?? 0.7,
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
      ...(this.vendor === "xiaomimimo" ? { thinking: { type: "disabled" } } : {}),
    } as OpenAI.ChatCompletionCreateParams)) as OpenAI.ChatCompletion;
    const choice = res.choices[0];
    return {
      content: choice.message.content ?? "",
      usage: {
        prompt: res.usage?.prompt_tokens ?? 0,
        completion: res.usage?.completion_tokens ?? 0,
        total: res.usage?.total_tokens ?? 0,
      },
    };
  }

  async embed(text: string): Promise<number[]> {
    const res = await this.client.embeddings.create({
      model: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
      input: text,
    });
    return res.data[0].embedding;
  }
}
