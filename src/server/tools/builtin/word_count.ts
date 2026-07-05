// word_count —— 文本统计（字符 / 行 / 词 / 中文字数）

import { z } from "zod";
import type { Tool } from "../types";

const Params = z.object({
  text: z.string().min(1).describe("要统计的文本"),
});

export const wordCountTool: Tool<typeof Params> = {
  name: "word_count",
  description:
    "统计文本的字符数（含空格）、字符数（不含空格）、单词数（按空格分）、行数、中文字数。",
  parameters: Params,
  execute: async (args) => {
    const text = args.text;
    const charsWithSpace = text.length;
    const charsNoSpace = text.replace(/\s/g, "").length;
    const lines = text.split(/\r?\n/).length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    // 中文字符数（CJK 统一表意文字）
    const cjk = (text.match(/[\u4E00-\u9FFF\u3400-\u4DBF]/g) || []).length;
    return {
      charsWithSpace,
      charsNoSpace,
      lines,
      words,
      cjk,
    };
  },
  toDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "要统计的文本" },
        },
        required: ["text"],
      },
    };
  },
};
