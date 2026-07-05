"use client";

/**
 * M16: LangChain vs 自研 对比学习页面
 *
 * 学习目标：
 * 1. 对比 LangChain ChatModel 和自研 Provider 的调用方式
 * 2. 对比 PromptTemplate 和手写字符串拼接
 * 3. 理解 StructuredOutputParser 的优势
 */

import { useState, useRef, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";

type Engine = "builtin" | "langchain";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function LangChainComparePage() {
  const [input, setInput] = useState("什么是多智能体协作？请简要说明。");
  const [builtinMessages, setBuiltinMessages] = useState<ChatMessage[]>([]);
  const [langchainMessages, setLangchainMessages] = useState<ChatMessage[]>([]);
  const [builtinStreaming, setBuiltinStreaming] = useState(false);
  const [langchainStreaming, setLangchainStreaming] = useState(false);
  const [promptResult, setPromptResult] = useState<string>("");
  const [promptType, setPromptType] = useState<"basic" | "chat" | "plan" | "reflection" | "rag">(
    "plan",
  );
  const builtinAbortRef = useRef<AbortController | null>(null);
  const langchainAbortRef = useRef<AbortController | null>(null);

  // 自研引擎对话
  const runBuiltin = useCallback(async (userInput: string) => {
    setBuiltinStreaming(true);
    setBuiltinMessages((prev) => [
      ...prev,
      { role: "user", content: userInput },
      { role: "assistant", content: "" },
    ]);
    const abort = new AbortController();
    builtinAbortRef.current = abort;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: [{ role: "user", content: userInput }],
          stream: true,
        }),
        signal: abort.signal,
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const step = JSON.parse(line.slice(6));
                if (step.kind === "delta" && step.content) {
                  assistantContent += step.content;
                  setBuiltinMessages((prev) => {
                    const copy = [...prev];
                    copy[copy.length - 1] = { role: "assistant", content: assistantContent };
                    return copy;
                  });
                }
              } catch {}
            }
          }
        }
      }
    } catch (err) {
      setBuiltinMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: `错误: ${(err as Error).message}` };
        return copy;
      });
    } finally {
      setBuiltinStreaming(false);
    }
  }, []);

  // LangChain 引擎对话
  const runLangchain = useCallback(async (userInput: string) => {
    setLangchainStreaming(true);
    setLangchainMessages((prev) => [
      ...prev,
      { role: "user", content: userInput },
      { role: "assistant", content: "" },
    ]);
    const abort = new AbortController();
    langchainAbortRef.current = abort;

    try {
      const res = await fetch("/api/langchain/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: [{ role: "user", content: userInput }],
        }),
        signal: abort.signal,
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const step = JSON.parse(line.slice(6));
                if (step.kind === "delta" && step.content) {
                  assistantContent += step.content;
                  setLangchainMessages((prev) => {
                    const copy = [...prev];
                    copy[copy.length - 1] = { role: "assistant", content: assistantContent };
                    return copy;
                  });
                }
              } catch {}
            }
          }
        }
      }
    } catch (err) {
      setLangchainMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: `错误: ${(err as Error).message}` };
        return copy;
      });
    } finally {
      setLangchainStreaming(false);
    }
  }, []);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    const userInput = input.trim();
    setInput("");
    runBuiltin(userInput);
    runLangchain(userInput);
  }, [input, runBuiltin, runLangchain]);

  // PromptTemplate 实验
  const runPromptExperiment = useCallback(async () => {
    try {
      const variables: Record<string, string> = {};
      switch (promptType) {
        case "basic":
          variables.role = "数据分析师";
          variables.tone = "专业";
          variables.question = "什么是向量数据库？";
          break;
        case "chat":
          variables.role = "AI 架构师";
          variables.skill = "LangChain 框架";
          variables.question = "如何设计一个多智能体系统？";
          break;
        case "plan":
          variables.task = "构建一个知识库问答系统";
          break;
        case "reflection":
          variables.question = "什么是 RAG？";
          variables.answer = "RAG 是检索增强生成的缩写。";
          break;
        case "rag":
          variables.context = "向量数据库是一种专门存储和检索高维向量的数据库。";
          variables.sources = "[1] 向量数据库文档";
          variables.question = "什么是向量数据库？";
          break;
      }

      const res = await fetch("/api/langchain/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: promptType, variables }),
      });
      const data = await res.json();
      if (data.error) {
        setPromptResult(`错误: ${data.error}`);
      } else {
        setPromptResult(
          typeof data.result === "string" ? data.result : JSON.stringify(data.result, null, 2),
        );
      }
    } catch (err) {
      setPromptResult(`错误: ${(err as Error).message}`);
    }
  }, [promptType]);

  return (
    <div className="flex h-screen bg-cyber-bg text-cyber-text">
      <Sidebar open={true} onCloseMobile={() => {}} />
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* 标题 */}
          <div>
            <h1 className="text-cyber-accent text-2xl font-bold">
              LangChain vs 自研引擎 — 对比学习
            </h1>
            <p className="text-cyber-text-dim mt-1 text-sm">
              M16 学习目标：对比 LangChain ChatModel / PromptTemplate / OutputParser
              与自研方案的差异
            </p>
          </div>

          {/* 对比对话区 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 自研引擎 */}
            <div className="space-y-3 rounded-lg border border-cyber-border bg-cyber-surface p-4">
              <div className="flex items-center gap-2">
                <span className="bg-cyber-green h-2 w-2 rounded-full" />
                <h2 className="text-cyber-green font-semibold">自研引擎 (OpenAIProvider)</h2>
              </div>
              <div className="text-cyber-text-dim text-xs">
                手写 fetch + streaming delta 累积 + JSON.parse
              </div>
              <div className="h-64 space-y-2 overflow-auto text-sm">
                {builtinMessages.length === 0 ? (
                  <div className="text-cyber-text-dim pt-20 text-center">发送消息开始对比</div>
                ) : (
                  builtinMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={msg.role === "user" ? "text-cyber-blue" : "text-cyber-text"}
                    >
                      <span className="text-cyber-text-dim mr-2 text-xs">
                        {msg.role === "user" ? "👤" : "🤖"}
                      </span>
                      {msg.content || "..."}
                    </div>
                  ))
                )}
                {builtinStreaming && <div className="text-cyber-text-dim animate-pulse">▋</div>}
              </div>
            </div>

            {/* LangChain 引擎 */}
            <div className="space-y-3 rounded-lg border border-cyber-border bg-cyber-surface p-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyber-purple" />
                <h2 className="font-semibold text-cyber-purple">LangChain 引擎 (ChatOpenAI)</h2>
              </div>
              <div className="text-cyber-text-dim text-xs">
                ChatOpenAI + AIMessageChunk + 内置重试/超时
              </div>
              <div className="h-64 space-y-2 overflow-auto text-sm">
                {langchainMessages.length === 0 ? (
                  <div className="text-cyber-text-dim pt-20 text-center">发送消息开始对比</div>
                ) : (
                  langchainMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={msg.role === "user" ? "text-cyber-blue" : "text-cyber-text"}
                    >
                      <span className="text-cyber-text-dim mr-2 text-xs">
                        {msg.role === "user" ? "👤" : "🤖"}
                      </span>
                      {msg.content || "..."}
                    </div>
                  ))
                )}
                {langchainStreaming && <div className="text-cyber-text-dim animate-pulse">▋</div>}
              </div>
            </div>
          </div>

          {/* 输入区 */}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !builtinStreaming && !langchainStreaming && handleSend()
              }
              placeholder="输入问题，双引擎同时回答..."
              className="focus:border-cyber-accent flex-1 rounded border border-cyber-border bg-cyber-bg px-4 py-2 text-sm outline-none"
              disabled={builtinStreaming || langchainStreaming}
            />
            <button
              onClick={handleSend}
              disabled={builtinStreaming || langchainStreaming || !input.trim()}
              className="bg-cyber-accent rounded px-6 py-2 text-sm font-semibold text-cyber-bg hover:opacity-80 disabled:opacity-40"
            >
              双引擎发送
            </button>
          </div>

          {/* PromptTemplate 实验区 */}
          <div className="space-y-3 rounded-lg border border-cyber-border bg-cyber-surface p-4">
            <div className="flex items-center gap-2">
              <span className="text-cyber-yellow">📋</span>
              <h2 className="text-cyber-yellow font-semibold">
                PromptTemplate + OutputParser 实验
              </h2>
            </div>
            <div className="text-cyber-text-dim text-xs">
              对比自研字符串拼接 vs LangChain PromptTemplate.fromTemplate() +
              StructuredOutputParser.fromZodSchema()
            </div>

            <div className="flex flex-wrap gap-2">
              {(["basic", "chat", "plan", "reflection", "rag"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setPromptType(t)}
                  className={`rounded border px-3 py-1 text-xs ${
                    promptType === t
                      ? "border-cyber-accent text-cyber-accent bg-cyber-bg"
                      : "text-cyber-text-dim hover:border-cyber-accent border-cyber-border"
                  }`}
                >
                  {t === "basic"
                    ? "基础模板"
                    : t === "chat"
                      ? "对话模板"
                      : t === "plan"
                        ? "规划解析"
                        : t === "reflection"
                          ? "反思解析"
                          : "RAG 模板"}
                </button>
              ))}
            </div>

            <button
              onClick={runPromptExperiment}
              className="bg-cyber-yellow rounded px-4 py-2 text-sm font-semibold text-cyber-bg hover:opacity-80"
            >
              生成 Prompt
            </button>

            {promptResult && (
              <pre className="max-h-48 overflow-auto rounded border border-cyber-border bg-cyber-bg p-3 text-xs text-cyber-text">
                {promptResult}
              </pre>
            )}
          </div>

          {/* 学习要点 */}
          <div className="space-y-2 rounded-lg border border-cyber-border bg-cyber-surface p-4">
            <h3 className="text-cyber-accent font-semibold">📚 学习要点</h3>
            <div className="text-cyber-text-dim grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-cyber-green mb-1 font-semibold">自研方案</div>
                <ul className="space-y-1">
                  <li>• 手写 fetch 调用 OpenAI API</li>
                  <li>• 手动累积 streaming tool_call delta</li>
                  <li>• 字符串拼接提示词</li>
                  <li>• JSON.parse + try/catch 解析输出</li>
                  <li>• 完全可控，无框架依赖</li>
                </ul>
              </div>
              <div>
                <div className="mb-1 font-semibold text-cyber-purple">LangChain 方案</div>
                <ul className="space-y-1">
                  <li>• ChatOpenAI 封装，内置重试/超时</li>
                  <li>• model.stream() 返回 AIMessageChunk</li>
                  <li>• PromptTemplate 参数化模板</li>
                  <li>• StructuredOutputParser + Zod 自动解析</li>
                  <li>• LCEL pipe 语法: prompt | model | parser</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
