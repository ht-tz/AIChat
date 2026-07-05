// web_search —— Mock 搜索（M2 阶段先用静态数据；M5+ 接入真实 API）

import { z } from "zod";
import type { Tool } from "../types";

const Params = z.object({
  query: z.string().min(1).describe("搜索关键词"),
  limit: z.number().int().min(1).max(10).optional().describe("返回结果数，默认 3"),
});

interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  score: number;
}

const MOCK_INDEX: Array<{ keywords: string[]; hits: SearchHit[] }> = [
  {
    keywords: ["nexus", "ai agent", "agent"],
    hits: [
      {
        title: "NEXUS · 开源 AI Agent 学习项目",
        url: "https://github.com/nexus-agent/nexus",
        snippet:
          "一个面向开发者的 AI Agent 学习项目，Next.js + PostgreSQL + pgvector，完整 ReAct / Plan / Reflexion / 多智能体实现。",
        score: 0.96,
      },
      {
        title: "什么是 ReAct (Reasoning + Acting) 范式",
        url: "https://lilianweng.github.io/posts/2023-03-15-prompt-engineering/#react",
        snippet:
          "ReAct 让 LLM 在推理与行动之间交替：思考 → 行动 → 观察 → 思考 → …… 提升多步任务的可靠性。",
        score: 0.91,
      },
      {
        title: "Function Calling 协议全解",
        url: "https://platform.openai.com/docs/guides/function-calling",
        snippet: "OpenAI 推出的工具调用协议，让 LLM 输出结构化 JSON 参数，由客户端执行后回传结果。",
        score: 0.87,
      },
    ],
  },
  {
    keywords: ["next.js", "nextjs", "app router"],
    hits: [
      {
        title: "Next.js App Router 官方文档",
        url: "https://nextjs.org/docs/app",
        snippet:
          "App Router 基于 React Server Components，支持流式 SSR、嵌套 Layout、Server Actions 等。",
        score: 0.97,
      },
      {
        title: "RSC 与 Server Action 实战",
        url: "https://nextjs.org/docs/app/getting-started/server-components",
        snippet:
          "Server Component 默认在服务端渲染，零 JS 体积；Server Action 让你在服务端直接处理表单提交。",
        score: 0.9,
      },
    ],
  },
  {
    keywords: ["react", "use state", "hooks"],
    hits: [
      {
        title: "React Hooks 速查表",
        url: "https://react.dev/reference/react/hooks",
        snippet:
          "useState / useEffect / useMemo / useCallback / useRef / useContext / useReducer 的语义、依赖、最佳实践。",
        score: 0.94,
      },
    ],
  },
];

export const webSearchTool: Tool<typeof Params> = {
  name: "web_search",
  description: "联网搜索关键词（当前为 Mock 实现，返回预置的演示数据；M5+ 接入真实搜索 API）。",
  parameters: Params,
  execute: async (args) => {
    const q = args.query.toLowerCase();
    const limit = args.limit ?? 3;
    // 命中第一组匹配度最高的索引
    const matched = MOCK_INDEX.find((entry) =>
      entry.keywords.some((k) => q.includes(k.toLowerCase())),
    );
    const hits = matched
      ? matched.hits.slice(0, limit)
      : [
          {
            title: `关于 "${args.query}" 的演示结果`,
            url: `https://example.com/search?q=${encodeURIComponent(args.query)}`,
            snippet:
              "这是 Mock web_search 的演示数据，关键词未命中预置索引。真实 API 接入在 M5+ 规划。",
            score: 0.5,
          },
        ];
    return { query: args.query, count: hits.length, hits };
  },
  toDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "搜索关键词" },
          limit: { type: "number", description: "返回结果数（1-10），默认 3" },
        },
        required: ["query"],
      },
    };
  },
};
