// 工具注册中心
// 负责：注册 / 列出 / 通过 name 查找 / 校验参数 / 带超时执行
// 任何工具必须先 register 才能被 Provider 看到

import { z } from "zod";
import type { Tool, ToolContext } from "./types";
import type { ToolDefinition } from "@/lib/types";

class ToolRegistry {
  private tools = new Map<string, Tool>();

  /** 注册一个工具，name 重复会抛错 */
  register<T extends z.ZodTypeAny>(tool: Tool<T>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" already registered`);
    }
    this.tools.set(tool.name, tool as unknown as Tool);
  }

  /** 列出所有工具的 OpenAI 协议描述（发给 LLM） */
  list(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.toDefinition());
  }

  /** 列出所有工具的元信息（前端展示用） */
  listMeta(): Array<{ name: string; description: string; requireConfirm?: boolean }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      requireConfirm: t.requireConfirm,
    }));
  }

  /** 通过 name 查找工具，找不到返回 undefined */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /** 校验参数（返回 parsedArgs 或抛错） */
  parseArgs(name: string, rawArgs: unknown): Record<string, unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return tool.parameters.parse(rawArgs ?? {}) as Record<string, unknown>;
  }

  /**
   * 带超时的工具执行
   * - 默认 5s 超时（防止 vm 沙箱死循环等）
   * - zod 校验失败抛错到调用方
   * - 工具内部错误统一包装
   */
  async execute(
    name: string,
    rawArgs: unknown,
    ctx: ToolContext = {},
  ): Promise<{ result: unknown; durationMs: number }> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    const args = this.parseArgs(name, rawArgs);
    const startedAt = Date.now();
    try {
      // 用 Promise.race 做超时控制；不依赖工具内部实现
      const result = await Promise.race([
        Promise.resolve(tool.execute(args, ctx)),
        new Promise((_, reject) => {
          const t = setTimeout(
            () => reject(new Error(`Tool "${name}" timeout after 5000ms`)),
            5000,
          );
          ctx.signal?.addEventListener("abort", () => {
            clearTimeout(t);
            reject(new Error("aborted"));
          });
        }),
      ]);
      return { result, durationMs: Date.now() - startedAt };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Tool "${name}" failed: ${msg}`);
    }
  }
}

/** 全局单例 */
export const toolRegistry = new ToolRegistry();
