// LangChain Provider 适配器
// 学习目标：使用 LangChain 的 ChatModel 抽象替代自研 LLMProvider 接口
// 对比：src/server/providers/openai.ts（自研 OpenAI Provider）
//
// 核心差异：
// 1. 自研方案：手写 fetch 调用 OpenAI API，手动处理 streaming delta
// 2. LangChain：使用 ChatOpenAI 类，内置 streaming、tool calling、retry
//
// 使用方式：
//   环境变量 LLM_PROVIDER=langchain 自动启用

import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import type { LLMProvider } from "@/server/providers";
import type { AgentStep, ToolDefinition, Attachment } from "@/lib/types";

/**
 * LangChain Provider —— 适配自研 LLMProvider 接口
 *
 * 学习要点：
 * - ChatOpenAI 封装了 OpenAI 兼容协议（含 DeepSeek/Kimi/通义等）
 * - 自研方案需手写 fetch + 累积 streaming delta，LangChain 内置处理
 * - LangChain 自动处理重试、超时、错误恢复
 */
export class LangChainProvider implements LLMProvider {
  name = "langchain";
  private model: ChatOpenAI;

  constructor() {
    this.model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY ?? "",
      configuration: {
        baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      },
      modelName: process.env.DEFAULT_MODEL ?? "gpt-4o-mini",
      temperature: 0.7,
      streaming: true,
    });
  }

  /**
   * 流式对话 —— 适配自研 AgentStep 协议
   *
   * 对比自研 openai.ts:
   *   自研：手动 for await chunk，解析 delta.content / delta.tool_calls
   *   LangChain：model.stream() 返回 AsyncIterable<AIMessageChunk>
   */
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
    // 1. 转换消息格式：自研格式 → LangChain Message
    const messages = opts.messages.map((m) => {
      switch (m.role) {
        case "system":
          return new SystemMessage(m.content);
        case "user":
          return new HumanMessage(m.content);
        case "assistant":
          return new AIMessage(m.content);
        case "tool":
          return new ToolMessage(m.content, m.toolCallId ?? "");
        default:
          return new HumanMessage(m.content);
      }
    });

    // 2. 可选：切换模型/温度
    let model = this.model;
    if (opts.model && opts.model !== "mock-default") {
      model = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY ?? "",
        configuration: {
          baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
        },
        modelName: opts.model,
        temperature: opts.temperature ?? 0.7,
        streaming: true,
      });
    }

    try {
      // 3. 流式输出
      const stream = await model.stream(messages as any, {
        signal: opts.signal,
      });

      for await (const chunk of stream) {
        if (opts.signal?.aborted) return;

        // LangChain chunk 是 AIMessageChunk，content 在 .content 属性
        const content = typeof chunk.content === "string" ? chunk.content : "";
        if (content) {
          yield { kind: "delta", content };
        }
      }

      // 4. 流结束，发送 done 事件
      yield {
        kind: "done",
        usage: { prompt: 0, completion: 0, total: 0 },
        runId: `lc-${Date.now()}`,
      };
    } catch (err) {
      yield { kind: "error", message: (err as Error).message };
    }
  }

  /**
   * 非流式补全 —— 对比自研 openai.ts complete()
   *
   * LangChain 优势：
   * - 内置 StructuredOutputParser，无需手写 JSON.parse + try/catch
   * - 支持 withStructuredOutput() 直接绑定 Zod schema
   */
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
    const messages = opts.messages.map((m) => {
      switch (m.role) {
        case "system":
          return new SystemMessage(m.content);
        case "user":
          return new HumanMessage(m.content);
        case "assistant":
          return new AIMessage(m.content);
        case "tool":
          return new ToolMessage(m.content, m.toolCallId ?? "");
        default:
          return new HumanMessage(m.content);
      }
    });

    let model = this.model;
    if (opts.model && opts.model !== "mock-default") {
      model = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY ?? "",
        configuration: {
          baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
        },
        modelName: opts.model,
        temperature: opts.temperature ?? 0.7,
      });
    }

    const response = await model.invoke(messages as any);
    const content = typeof response.content === "string" ? response.content : "";

    return {
      content,
      usage: { prompt: 0, completion: 0, total: 0 },
    };
  }

  /**
   * 文本嵌入 —— 对比自研 openai.ts embed()
   */
  async embed(text: string): Promise<number[]> {
    // LangChain 使用 OpenAIEmbeddings 类
    const { OpenAIEmbeddings } = await import("@langchain/openai");
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY ?? "",
      configuration: {
        baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      },
      modelName: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
    });
    const result = await embeddings.embedQuery(text);
    return result;
  }
}
