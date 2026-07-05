// calculator —— 数学表达式求值
// 用手写的 Shunting-yard 算法（先转后缀表达式再求值），避免引入 mathjs 等依赖
// 支持：+ - * / ^ () 与常用函数 sqrt sin cos tan log ln exp abs floor ceil round

import { z } from "zod";
import type { Tool } from "../types";

const Params = z.object({
  expression: z.string().min(1).describe("数学表达式，如 '123 * 456' 或 'sqrt(2) + 1'"),
});

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sqrt: Math.sqrt,
  sin: (x) => Math.sin(x),
  cos: (x) => Math.cos(x),
  tan: (x) => Math.tan(x),
  log: (x) => Math.log10(x),
  ln: (x) => Math.log(x),
  exp: (x) => Math.exp(x),
  abs: (x) => Math.abs(x),
  floor: (x) => Math.floor(x),
  ceil: (x) => Math.ceil(x),
  round: (x) => Math.round(x),
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

/** 词法分析：把字符串切成数字 / 运算符 / 标识符 / 括号 */
function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (c === " " || c === "\t" || c === "\n") {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let num = "";
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i++];
      }
      tokens.push(num);
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let id = "";
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        id += expr[i++];
      }
      tokens.push(id);
      continue;
    }
    // 单字符运算符
    tokens.push(c);
    i++;
  }
  return tokens;
}

/** 把中缀表达式转成 RPN（Shunting-yard） */
function toRPN(tokens: string[]): string[] {
  const output: string[] = [];
  const stack: string[] = [];
  const prec: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 4, u: 5 };

  // 上一段是不是"运算符"（用于判断一元负号）
  // 起始视为运算符
  let lastIsOp = true;

  for (const t of tokens) {
    if (/^[0-9.]+$/.test(t)) {
      output.push(t);
      lastIsOp = false;
    } else if (FUNCTIONS[t]) {
      stack.push(t);
      lastIsOp = true;
    } else if (t === ",") {
      // 函数参数分隔
      while (stack.length && stack[stack.length - 1] !== "(") {
        output.push(stack.pop()!);
      }
    } else if (t === "-") {
      if (lastIsOp) {
        // 一元负号：标记为 u
        stack.push("u");
      } else {
        // 二元减号
        while (
          stack.length &&
          stack[stack.length - 1] !== "(" &&
          (prec[stack[stack.length - 1]] ?? 0) >= prec[t]
        ) {
          output.push(stack.pop()!);
        }
        stack.push(t);
        lastIsOp = true;
      }
    } else if (t in prec) {
      while (
        stack.length &&
        stack[stack.length - 1] !== "(" &&
        (prec[stack[stack.length - 1]] ?? 0) >= prec[t]
      ) {
        output.push(stack.pop()!);
      }
      stack.push(t);
      lastIsOp = true;
    } else if (t === "(") {
      stack.push(t);
      lastIsOp = true;
    } else if (t === ")") {
      while (stack.length && stack[stack.length - 1] !== "(") {
        output.push(stack.pop()!);
      }
      stack.pop(); // 弹出 "("
      if (stack.length && FUNCTIONS[stack[stack.length - 1]]) {
        output.push(stack.pop()!);
        lastIsOp = false;
      } else {
        lastIsOp = false;
      }
    } else if (t in CONSTANTS) {
      output.push(String(CONSTANTS[t]));
      lastIsOp = false;
    }
  }
  while (stack.length) output.push(stack.pop()!);
  return output;
}

/** 计算 RPN */
function evalRPN(rpn: string[]): number {
  const stack: number[] = [];
  for (const t of rpn) {
    if (FUNCTIONS[t]) {
      const arg = stack.pop()!;
      stack.push(FUNCTIONS[t](arg));
    } else if (t === "u") {
      const arg = stack.pop()!;
      stack.push(-arg);
    } else if ("+-*/^".includes(t)) {
      const b = stack.pop()!;
      const a = stack.pop()!;
      let r: number;
      switch (t) {
        case "+":
          r = a + b;
          break;
        case "-":
          r = a - b;
          break;
        case "*":
          r = a * b;
          break;
        case "/":
          r = a / b;
          break;
        case "^":
          r = Math.pow(a, b);
          break;
        default:
          throw new Error(`Unknown op ${t}`);
      }
      stack.push(r);
    } else {
      stack.push(parseFloat(t));
    }
  }
  if (stack.length !== 1) throw new Error("Invalid expression");
  return stack[0];
}

export const calculatorTool: Tool<typeof Params> = {
  name: "calculator",
  description:
    "计算数学表达式。支持 + - * / ^ 运算与 sqrt sin cos tan log ln exp abs floor ceil round 函数，常量 pi e。",
  parameters: Params,
  execute: async (args) => {
    const tokens = tokenize(args.expression);
    if (tokens.length === 0) throw new Error("Empty expression");
    const rpn = toRPN(tokens);
    const value = evalRPN(rpn);
    if (Number.isNaN(value)) throw new Error("Result is NaN");
    if (!Number.isFinite(value)) throw new Error("Result is infinite");
    return {
      expression: args.expression,
      value,
      formatted: Number.isInteger(value)
        ? value.toString()
        : value.toFixed(6).replace(/\.?0+$/, ""),
    };
  },
  toDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "数学表达式，如 '123 * 456' 或 'sqrt(2) + 1'",
          },
        },
        required: ["expression"],
      },
    };
  },
};
