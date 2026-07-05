// M17: LangChain Tools 适配层
// 学习目标：将自研工具适配为 LangChain DynamicTool
// 对比：自研 Tool 接口 + toolRegistry vs LangChain tool() 函数 + ToolExecutor
//
// 核心差异：
// 1. 自研方案：实现 Tool 接口（name/description/parameters/execute/toDefinition）
// 2. LangChain：使用 DynamicTool 或 tool() 装饰器，自动生成 schema
//
// 适配策略：将现有 8 个内置工具包装为 LangChain DynamicTool

import { DynamicTool } from "@langchain/core/tools";
import { toolRegistry, registerBuiltinTools } from "@/server/tools";

// 确保工具已注册
registerBuiltinTools();

/**
 * 将自研工具转换为 LangChain DynamicTool
 *
 * 自研 Tool 接口：
 *   { name, description, parameters: ZodSchema, execute: (args, ctx) => Promise<T> }
 *
 * LangChain DynamicTool：
 *   { name, description, func: (input) => Promise<string> }
 *
 * 关键差异：LangChain DynamicTool 的 func 接收字符串输入，返回字符串输出
 * 而 LangChain 的 tool() 函数支持 Zod schema，更接近自研方案
 */
export function adaptToLangChainTools(): DynamicTool[] {
  const tools = toolRegistry.list();
  const langchainTools: DynamicTool[] = [];

  for (const toolDef of tools) {
    // 获取自研 Tool 对象（含 execute 函数）
    const tool = toolRegistry.get(toolDef.name);
    if (!tool) continue;

    // 创建 LangChain DynamicTool
    // 对比自研：自研方案直接调用 tool.execute(args, ctx)
    // LangChain：通过 DynamicTool.func 间接调用
    const lcTool = new DynamicTool({
      name: tool.name,
      description: tool.description,
      func: async (input: string) => {
        try {
          // 尝试解析 JSON 输入
          let args: Record<string, unknown>;
          try {
            args = JSON.parse(input);
          } catch {
            // 非 JSON，作为简单字符串参数
            args = { input };
          }

          // 使用自研 toolRegistry 执行
          const { result } = await toolRegistry.execute(tool.name, args);
          return typeof result === "string" ? result : JSON.stringify(result);
        } catch (err) {
          return `Error: ${(err as Error).message}`;
        }
      },
    });

    langchainTools.push(lcTool);
  }

  return langchainTools;
}

/**
 * 列出所有工具信息（用于 UI 展示）
 */
export function listToolComparison() {
  const tools = toolRegistry.list();
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    builtinSchema: t.parameters,
    langchainAdapted: true,
  }));
}
