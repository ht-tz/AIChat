// code_runner —— 在 Node vm 沙箱里执行 JS 片段
// 沙箱限制：
//   - 用 runInNewContext 隔离
//   - 显式注入 console
//   - timeout 由 registry 统一守护（5s）
//   - 不暴露 require / process / globalThis

import vm from "node:vm";
import { z } from "zod";
import type { Tool } from "../types";

const Params = z.object({
  code: z
    .string()
    .min(1)
    .describe("要执行的 JavaScript 代码片段。返回值或 console.log 输出会被收集。"),
});

export const codeRunnerTool: Tool<typeof Params> = {
  name: "code_runner",
  description:
    "在 Node vm 沙箱中执行 JavaScript 片段（5s 超时）。返回最后表达式或 console.log 输出。",
  parameters: Params,
  execute: async (args) => {
    const logs: Array<{ level: string; text: string }> = [];
    const sandboxConsole = {
      log: (...v: unknown[]) => logs.push({ level: "log", text: v.map(stringify).join(" ") }),
      info: (...v: unknown[]) => logs.push({ level: "info", text: v.map(stringify).join(" ") }),
      warn: (...v: unknown[]) => logs.push({ level: "warn", text: v.map(stringify).join(" ") }),
      error: (...v: unknown[]) => logs.push({ level: "error", text: v.map(stringify).join(" ") }),
    };
    const sandbox = {
      console: sandboxConsole,
      Math,
      Date,
      JSON,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Map,
      Set,
      Promise,
    };
    try {
      // 优先尝试"返回最后一个表达式"
      // 把代码最后一行（非空）前面加 return
      const lines = args.code.split(/\r?\n/);
      let lastIdx = lines.length - 1;
      while (lastIdx >= 0 && lines[lastIdx].trim() === "") lastIdx--;
      const lastLine = lines[lastIdx] ?? "";
      const head = lines.slice(0, lastIdx).join("\n");
      const wrapped = `(function() {\n${head}\nreturn (${lastLine});\n})()`;
      const result = vm.runInNewContext(wrapped, sandbox, {
        timeout: 4900,
        displayErrors: true,
      });
      return {
        ok: true,
        result: safeStringify(result),
        logs,
        logText: logs.map((l) => `[${l.level}] ${l.text}`).join("\n"),
      };
    } catch (err) {
      // 退回纯语句模式：不能 return 时，直接执行语句收集 console
      try {
        vm.runInNewContext(args.code, sandbox, { timeout: 4900, displayErrors: true });
        return {
          ok: true,
          result: undefined,
          logs,
          logText: logs.map((l) => `[${l.level}] ${l.text}`).join("\n"),
        };
      } catch (err2) {
        return {
          ok: false,
          error: err2 instanceof Error ? err2.message : String(err2),
          logs,
          logText: logs.map((l) => `[${l.level}] ${l.text}`).join("\n"),
        };
      }
    }
  },
  toDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "要执行的 JavaScript 代码片段" },
        },
        required: ["code"],
      },
    };
  },
};

function stringify(v: unknown): string {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function safeStringify(v: unknown): string {
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "function") return "[Function]";
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
