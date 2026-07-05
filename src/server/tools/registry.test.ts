import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { toolRegistry } from "./registry";
import type { Tool } from "./types";

// 清理注册表，避免测试间干扰
beforeEach(() => {
  // 通过遍历清除已注册工具（ToolRegistry 没有 clear 方法，需要手动处理）
  const tools = toolRegistry.list();
  // 注意：这里只能测试公开 API，无法直接清空私有 Map
  // 实际测试中应该用独立的 ToolRegistry 实例
});

describe("ToolRegistry", () => {
  describe("register", () => {
    it("应该成功注册一个工具", () => {
      const mockTool: Tool<z.ZodObject<{ a: z.ZodNumber }>> = {
        name: "test_tool_" + Date.now(),
        description: "测试工具",
        parameters: z.object({ a: z.number() }),
        execute: async (args) => args.a * 2,
        toDefinition: () => ({
          type: "function" as const,
          function: {
            name: "test_tool",
            description: "测试工具",
            parameters: { type: "object", properties: { a: { type: "number" } }, required: ["a"] },
          },
        }),
      };

      expect(() => toolRegistry.register(mockTool)).not.toThrow();
    });

    it("重复注册同名工具应该抛错", () => {
      const uniqueName = "duplicate_test_" + Date.now();
      const mockTool: Tool = {
        name: uniqueName,
        description: "测试工具",
        parameters: z.object({}),
        execute: async () => "ok",
        toDefinition: () => ({
          type: "function" as const,
          function: { name: uniqueName, description: "测试工具", parameters: {} },
        }),
      };

      toolRegistry.register(mockTool);
      expect(() => toolRegistry.register(mockTool)).toThrow(
        `Tool "${uniqueName}" already registered`,
      );
    });
  });

  describe("list", () => {
    it("应该返回所有注册工具的定义", () => {
      const definitions = toolRegistry.list();
      expect(Array.isArray(definitions)).toBe(true);
      // 至少应该有之前注册的工具
      expect(definitions.length).toBeGreaterThan(0);
    });
  });

  describe("listMeta", () => {
    it("应该返回工具元信息", () => {
      const meta = toolRegistry.listMeta();
      expect(Array.isArray(meta)).toBe(true);
      if (meta.length > 0) {
        expect(meta[0]).toHaveProperty("name");
        expect(meta[0]).toHaveProperty("description");
      }
    });
  });

  describe("get", () => {
    it("查找存在的工具应返回工具对象", () => {
      // 先注册一个工具，然后查找
      const uniqueName = "get_test_" + Date.now();
      const mockTool: Tool = {
        name: uniqueName,
        description: "查找测试",
        parameters: z.object({}),
        execute: async () => "ok",
        toDefinition: () => ({
          type: "function" as const,
          function: { name: uniqueName, description: "查找测试", parameters: {} },
        }),
      };

      toolRegistry.register(mockTool);
      const tool = toolRegistry.get(uniqueName);
      expect(tool).toBeDefined();
      expect(tool?.name).toBe(uniqueName);
    });

    it("查找不存在的工具应返回 undefined", () => {
      const tool = toolRegistry.get("non_existent_tool_xyz");
      expect(tool).toBeUndefined();
    });
  });

  describe("parseArgs", () => {
    it("解析有效参数应返回解析结果", () => {
      const uniqueName = "parse_test_" + Date.now();
      const mockTool: Tool = {
        name: uniqueName,
        description: "解析测试",
        parameters: z.object({ value: z.number() }),
        execute: async (args) => args,
        toDefinition: () => ({
          type: "function" as const,
          function: { name: uniqueName, description: "解析测试", parameters: {} },
        }),
      };

      toolRegistry.register(mockTool);
      const result = toolRegistry.parseArgs(uniqueName, { value: 42 });
      expect(result).toEqual({ value: 42 });
    });

    it("解析不存在的工具应抛错", () => {
      expect(() => toolRegistry.parseArgs("non_existent", {})).toThrow(
        "Unknown tool: non_existent",
      );
    });

    it("解析无效参数应抛 Zod 错误", () => {
      const uniqueName = "parse_fail_" + Date.now();
      const mockTool: Tool = {
        name: uniqueName,
        description: "解析失败测试",
        parameters: z.object({ value: z.number() }),
        execute: async (args) => args,
        toDefinition: () => ({
          type: "function" as const,
          function: { name: uniqueName, description: "解析失败测试", parameters: {} },
        }),
      };

      toolRegistry.register(mockTool);
      expect(() => toolRegistry.parseArgs(uniqueName, { value: "not_a_number" })).toThrow();
    });
  });

  describe("execute", () => {
    it("执行工具应返回结果和耗时", async () => {
      const uniqueName = "exec_test_" + Date.now();
      const mockTool: Tool = {
        name: uniqueName,
        description: "执行测试",
        parameters: z.object({ x: z.number(), y: z.number() }),
        execute: async (args) => args.x + args.y,
        toDefinition: () => ({
          type: "function" as const,
          function: { name: uniqueName, description: "执行测试", parameters: {} },
        }),
      };

      toolRegistry.register(mockTool);
      const result = await toolRegistry.execute(uniqueName, { x: 10, y: 20 });
      expect(result.result).toBe(30);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("执行不存在的工具应抛错", async () => {
      await expect(toolRegistry.execute("non_existent", {})).rejects.toThrow(
        "Unknown tool: non_existent",
      );
    });

    it("工具执行超时应抛错", async () => {
      const uniqueName = "timeout_test_" + Date.now();
      const mockTool: Tool = {
        name: uniqueName,
        description: "超时测试",
        parameters: z.object({}),
        execute: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10000));
          return "never";
        },
        toDefinition: () => ({
          type: "function" as const,
          function: { name: uniqueName, description: "超时测试", parameters: {} },
        }),
      };

      toolRegistry.register(mockTool);
      await expect(toolRegistry.execute(uniqueName, {})).rejects.toThrow("timeout");
    });

    it("工具执行失败应包装错误信息", async () => {
      const uniqueName = "fail_test_" + Date.now();
      const mockTool: Tool = {
        name: uniqueName,
        description: "失败测试",
        parameters: z.object({}),
        execute: async () => {
          throw new Error("工具内部错误");
        },
        toDefinition: () => ({
          type: "function" as const,
          function: { name: uniqueName, description: "失败测试", parameters: {} },
        }),
      };

      toolRegistry.register(mockTool);
      await expect(toolRegistry.execute(uniqueName, {})).rejects.toThrow('Tool "fail_test');
    });

    it("abort signal 应中断执行", async () => {
      const uniqueName = "abort_test_" + Date.now();
      const controller = new AbortController();

      const mockTool: Tool = {
        name: uniqueName,
        description: "中断测试",
        parameters: z.object({}),
        execute: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return "never";
        },
        toDefinition: () => ({
          type: "function" as const,
          function: { name: uniqueName, description: "中断测试", parameters: {} },
        }),
      };

      toolRegistry.register(mockTool);

      // 立即 abort
      setTimeout(() => controller.abort(), 10);

      await expect(
        toolRegistry.execute(uniqueName, {}, { signal: controller.signal }),
      ).rejects.toThrow();
    });
  });
});
