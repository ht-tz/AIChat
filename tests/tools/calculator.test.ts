import { describe, it, expect } from "vitest";
import { toolRegistry } from "@/server/tools";

describe("calculator tool", () => {
  const calc = toolRegistry.get("calculator")!;
  expect(calc).toBeDefined();

  const run = async (expression: string) => {
    const { result } = await toolRegistry.execute("calculator", { expression });
    return result as { value: number; formatted: string; expression: string };
  };

  it("基本四则运算", async () => {
    expect((await run("123 * 456")).value).toBe(56088);
    expect((await run("1 + 2 * 3")).value).toBe(7);
    expect((await run("(1 + 2) * 3")).value).toBe(9);
    expect((await run("10 / 4")).value).toBe(2.5);
  });

  it("幂运算与函数", async () => {
    expect((await run("2 ^ 10")).value).toBe(1024);
    expect((await run("sqrt(16)")).value).toBe(4);
    expect((await run("sqrt(2) + 1")).value).toBeCloseTo(2.4142, 3);
    expect((await run("log(100)")).value).toBe(2);
  });

  it("常量与负数", async () => {
    expect((await run("pi")).value).toBeCloseTo(3.1416, 3);
    expect((await run("e")).value).toBeCloseTo(2.7183, 3);
    expect((await run("-5 + 3")).value).toBe(-2);
    expect((await run("abs(-7)")).value).toBe(7);
  });

  it("toDefinition 输出符合 OpenAI Function Calling 协议", () => {
    const def = calc.toDefinition();
    expect(def.name).toBe("calculator");
    expect(def.parameters.type).toBe("object");
    expect(def.parameters.required).toContain("expression");
  });

  it("拒绝空表达式", async () => {
    await expect(run("")).rejects.toThrow();
  });
});
