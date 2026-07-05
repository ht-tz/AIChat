import { describe, it, expect } from "vitest";
import { MockProvider } from "./mock";

describe("MockProvider", () => {
  const provider = new MockProvider();

  describe("name", () => {
    it("应返回 'mock'", () => {
      expect(provider.name).toBe("mock");
    });
  });

  describe("embed", () => {
    it("应返回 1536 维向量", async () => {
      const result = await provider.embed("hello");
      expect(result).toHaveLength(1536);
    });

    it("相同输入应返回相同向量", async () => {
      const a = await provider.embed("test");
      const b = await provider.embed("test");
      expect(a).toEqual(b);
    });

    it("不同输入应返回不同向量", async () => {
      const a = await provider.embed("hello");
      const b = await provider.embed("world");
      expect(a).not.toEqual(b);
    });

    it("归一化后模长应接近 1", async () => {
      const vec = await provider.embed("normalize test");
      const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
      expect(norm).toBeCloseTo(1, 5);
    });

    it("空字符串应返回有效向量", async () => {
      const result = await provider.embed("");
      expect(result).toHaveLength(1536);
    });
  });

  describe("complete", () => {
    it("应返回 mock 前缀的回复", async () => {
      const result = await provider.complete({
        messages: [{ role: "user", content: "Hello" }],
      });
      expect(result.content).toContain("[mock-complete]");
      expect(result.content).toContain("Hello");
    });

    it("jsonMode 应返回 JSON 格式", async () => {
      const result = await provider.complete({
        messages: [{ role: "user", content: "test" }],
        jsonMode: true,
      });
      const parsed = JSON.parse(result.content);
      expect(parsed.ok).toBe(true);
      expect(parsed.mock).toBe(true);
    });

    it("应返回 usage 信息", async () => {
      const result = await provider.complete({
        messages: [{ role: "user", content: "test" }],
      });
      expect(result.usage).toHaveProperty("prompt");
      expect(result.usage).toHaveProperty("completion");
      expect(result.usage).toHaveProperty("total");
      expect(result.usage.total).toBe(result.usage.prompt + result.usage.completion);
    });
  });

  describe("stream", () => {
    it("应流式返回 delta 事件", async () => {
      const steps: any[] = [];
      for await (const step of provider.stream({
        messages: [{ role: "user", content: "Hello" }],
      })) {
        steps.push(step);
      }

      const deltas = steps.filter((s) => s.kind === "delta");
      expect(deltas.length).toBeGreaterThan(0);
    });

    it("流式应包含 done 事件", async () => {
      const steps: any[] = [];
      for await (const step of provider.stream({
        messages: [{ role: "user", content: "Hello" }],
      })) {
        steps.push(step);
      }

      const done = steps.find((s) => s.kind === "done");
      expect(done).toBeDefined();
      expect(done.usage).toBeDefined();
    });

    it("问候语应触发自我介绍", async () => {
      const steps: any[] = [];
      for await (const step of provider.stream({
        messages: [{ role: "user", content: "你好" }],
      })) {
        steps.push(step);
      }

      const deltas = steps.filter((s) => s.kind === "delta");
      const fullReply = deltas.map((d) => d.content).join("");
      expect(fullReply).toContain("NEXUS");
    });

    it("计算器表达式应触发 tool_call", async () => {
      const steps: any[] = [];
      for await (const step of provider.stream({
        messages: [{ role: "user", content: "123 * 456" }],
      })) {
        steps.push(step);
      }

      const toolCall = steps.find((s) => s.kind === "tool_call");
      expect(toolCall).toBeDefined();
      expect(toolCall.name).toBe("calculator");
    });

    it("时间查询应触发 get_current_time", async () => {
      const steps: any[] = [];
      for await (const step of provider.stream({
        messages: [{ role: "user", content: "现在几点" }],
      })) {
        steps.push(step);
      }

      const toolCall = steps.find((s) => s.kind === "tool_call");
      expect(toolCall).toBeDefined();
      expect(toolCall.name).toBe("get_current_time");
    });

    it("搜索查询应触发 web_search", async () => {
      const steps: any[] = [];
      for await (const step of provider.stream({
        messages: [{ role: "user", content: "搜索 NEXUS" }],
      })) {
        steps.push(step);
      }

      const toolCall = steps.find((s) => s.kind === "tool_call");
      expect(toolCall).toBeDefined();
      expect(toolCall.name).toBe("web_search");
    });

    it("工具结果应生成总结", async () => {
      const steps: any[] = [];
      for await (const step of provider.stream({
        messages: [
          { role: "user", content: "123 * 456" },
          { role: "tool", name: "calculator", content: '{"value": 56088, "formatted": "56,088"}' },
        ],
      })) {
        steps.push(step);
      }

      const deltas = steps.filter((s) => s.kind === "delta");
      const reply = deltas.map((d) => d.content).join("");
      expect(reply).toContain("56088");
    });

    it("abort signal 应中断流", async () => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 50);

      const steps: any[] = [];
      try {
        for await (const step of provider.stream({
          messages: [{ role: "user", content: "Hello World" }],
          signal: controller.signal,
        })) {
          steps.push(step);
        }
      } catch {
        // abort 可能抛错，这是预期的
      }

      // 如果中断了，steps 应该少于正常流程
      // 这个测试主要验证 abort 不会导致未捕获异常
    });
  });
});
