import { describe, it, expect } from "vitest";
import {
  extractVariables,
  interpolate,
  resolveVariables,
  validateVariables,
} from "./variable-parser";
import type { PromptVariable } from "@/server/db/schema";

describe("Variable Parser", () => {
  describe("extractVariables", () => {
    it("应提取单个变量", () => {
      const result = extractVariables("Hello {{name}}!");
      expect(result).toEqual(["name"]);
    });

    it("应提取多个不同变量", () => {
      const result = extractVariables("{{greeting}} {{name}}, today is {{date}}");
      expect(result).toEqual(["greeting", "name", "date"]);
    });

    it("应去重重名变量", () => {
      const result = extractVariables("{{name}} and {{name}} again");
      expect(result).toEqual(["name"]);
    });

    it("无变量应返回空数组", () => {
      const result = extractVariables("Hello World!");
      expect(result).toEqual([]);
    });

    it("应支持下划线变量名", () => {
      const result = extractVariables("{{my_var_name}}");
      expect(result).toEqual(["my_var_name"]);
    });

    it("应支持数字变量名", () => {
      const result = extractVariables("{{var1}} {{var2}}");
      expect(result).toEqual(["var1", "var2"]);
    });

    it("空字符串应返回空数组", () => {
      const result = extractVariables("");
      expect(result).toEqual([]);
    });
  });

  describe("interpolate", () => {
    it("应替换变量", () => {
      const result = interpolate("Hello {{name}}!", { name: "World" });
      expect(result).toBe("Hello World!");
    });

    it("应替换多个变量", () => {
      const result = interpolate("{{greeting}} {{name}}!", {
        greeting: "Hi",
        name: "Alice",
      });
      expect(result).toBe("Hi Alice!");
    });

    it("缺失变量应保留原始占位符", () => {
      const result = interpolate("Hello {{name}} {{missing}}!", { name: "World" });
      expect(result).toBe("Hello World {{missing}}!");
    });

    it("无变量模板应原样返回", () => {
      const result = interpolate("Hello World!", { name: "test" });
      expect(result).toBe("Hello World!");
    });

    it("空模板应返回空字符串", () => {
      const result = interpolate("", { name: "test" });
      expect(result).toBe("");
    });

    it("空值映射应保留所有占位符", () => {
      const result = interpolate("{{a}} {{b}}", {});
      expect(result).toBe("{{a}} {{b}}");
    });
  });

  describe("resolveVariables", () => {
    it("应使用用户输入值", () => {
      const defs: PromptVariable[] = [
        { name: "name", description: "姓名", defaultValue: "", required: true },
      ];
      const result = resolveVariables(defs, { name: "Alice" });
      expect(result).toEqual({ name: "Alice" });
    });

    it("用户输入缺失时应使用默认值", () => {
      const defs: PromptVariable[] = [
        { name: "name", description: "姓名", defaultValue: "Guest", required: false },
      ];
      const result = resolveVariables(defs, {});
      expect(result).toEqual({ name: "Guest" });
    });

    it("用户输入和默认值都缺失时应使用空字符串", () => {
      const defs: PromptVariable[] = [
        { name: "name", description: "姓名", defaultValue: undefined, required: false },
      ];
      const result = resolveVariables(defs, {});
      expect(result).toEqual({ name: "" });
    });

    it("应处理多个变量", () => {
      const defs: PromptVariable[] = [
        { name: "a", description: "A", defaultValue: "1", required: false },
        { name: "b", description: "B", defaultValue: "2", required: false },
      ];
      const result = resolveVariables(defs, { a: "10" });
      expect(result).toEqual({ a: "10", b: "2" });
    });

    it("空定义应返回空对象", () => {
      const result = resolveVariables([], { name: "test" });
      expect(result).toEqual({});
    });
  });

  describe("validateVariables", () => {
    it("所有必填变量已填应返回空数组", () => {
      const defs: PromptVariable[] = [
        { name: "name", description: "姓名", defaultValue: "", required: true },
      ];
      const result = validateVariables(defs, { name: "Alice" });
      expect(result).toEqual([]);
    });

    it("必填变量未填应返回变量名", () => {
      const defs: PromptVariable[] = [
        { name: "name", description: "姓名", defaultValue: "", required: true },
      ];
      const result = validateVariables(defs, {});
      expect(result).toEqual(["name"]);
    });

    it("有默认值的变量未填不应报错", () => {
      const defs: PromptVariable[] = [
        { name: "name", description: "姓名", defaultValue: "Guest", required: true },
      ];
      const result = validateVariables(defs, {});
      expect(result).toEqual([]);
    });

    it("纯空格输入应视为未填", () => {
      const defs: PromptVariable[] = [
        { name: "name", description: "姓名", defaultValue: "", required: true },
      ];
      const result = validateVariables(defs, { name: "   " });
      expect(result).toEqual(["name"]);
    });

    it("多个缺失变量应全部返回", () => {
      const defs: PromptVariable[] = [
        { name: "a", description: "A", defaultValue: "", required: true },
        { name: "b", description: "B", defaultValue: "", required: true },
      ];
      const result = validateVariables(defs, {});
      expect(result).toEqual(["a", "b"]);
    });

    it("空定义应返回空数组", () => {
      const result = validateVariables([], {});
      expect(result).toEqual([]);
    });
  });
});
