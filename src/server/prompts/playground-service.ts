// Playground 执行服务 —— 使用 LLM Provider 执行模板

import { getProvider } from "@/server/providers";
import { interpolate, resolveVariables, validateVariables } from "./variable-parser";
import type { PromptVariable } from "@/server/db/schema";

export interface PlaygroundRequest {
  systemPrompt: string;
  variables: PromptVariable[];
  variableValues: Record<string, string>;
  userMessage?: string;
  model?: string;
  temperature?: number;
}

export interface PlaygroundResult {
  output: string;
  usage: { prompt: number; completion: number; total: number };
  durationMs: number;
  resolvedPrompt: string;
}

export interface ABTestRequest {
  templateA: {
    systemPrompt: string;
    variables: PromptVariable[];
    name: string;
  };
  templateB: {
    systemPrompt: string;
    variables: PromptVariable[];
    name: string;
  };
  variableValues: Record<string, string>;
  userMessage?: string;
  model?: string;
  temperature?: number;
}

export interface ABTestResult {
  resultA: PlaygroundResult;
  resultB: PlaygroundResult;
}

/** 执行单个模板 */
export async function executePlayground(req: PlaygroundRequest): Promise<PlaygroundResult> {
  const start = Date.now();

  // 校验变量
  const missing = validateVariables(req.variables, req.variableValues);
  if (missing.length > 0) {
    throw new Error(`缺少必填变量：${missing.join(", ")}`);
  }

  // 解析变量并插值
  const resolved = resolveVariables(req.variables, req.variableValues);
  const systemPrompt = interpolate(req.systemPrompt, resolved);

  const provider = getProvider();
  const messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string;
  }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: req.userMessage || "请按照指令执行。" },
  ];

  const { content, usage } = await provider.complete({
    messages,
    model: req.model,
    temperature: req.temperature,
  });

  return {
    output: content,
    usage,
    durationMs: Date.now() - start,
    resolvedPrompt: systemPrompt,
  };
}

/** 执行 A/B 测试 */
export async function executeABTest(req: ABTestRequest): Promise<ABTestResult> {
  const [resultA, resultB] = await Promise.all([
    executePlayground({
      systemPrompt: req.templateA.systemPrompt,
      variables: req.templateA.variables,
      variableValues: req.variableValues,
      userMessage: req.userMessage,
      model: req.model,
      temperature: req.temperature,
    }),
    executePlayground({
      systemPrompt: req.templateB.systemPrompt,
      variables: req.templateB.variables,
      variableValues: req.variableValues,
      userMessage: req.userMessage,
      model: req.model,
      temperature: req.temperature,
    }),
  ]);

  return { resultA, resultB };
}
