// Mock Provider —— 无需 API Key，开箱即用，用于学习与离线调试
// M2 升级：支持工具调用。检测用户输入，模拟 LLM 主动 tool_call。
// M4 升级：支持附件，支持图片生成触发

import type { LLMProvider } from "./index";
import type { AgentStep, ToolDefinition, Attachment } from "@/lib/types";

interface ToolRule {
  pattern: RegExp;
  extractArgs: (input: string) => Record<string, unknown> | null;
  toolName: string;
  summarize: (input: string, result: any) => string;
}

const TOOL_RULES: ToolRule[] = [
  {
    pattern: /(画|生成|创建|做)\s*(一)?张|(picture|image|draw|generate|create)\s*(a|an)?/i,
    toolName: "generate_image",
    extractArgs: (input) => {
      let prompt = input
        .replace(/^(请|帮我|麻烦)?\s*(画|生成|创建|做)\s*(一)?[张个幅]\s*/i, "")
        .replace(/^(please|can you|help me)\s*(draw|generate|create|make)\s*(a|an)?\s*/i, "")
        .trim();
      if (!prompt) prompt = input;
      return { prompt, size: "512x512" };
    },
    summarize: (_input, r) => {
      return `已为你生成图片！提示词："${r.prompt}"\n\n![生成图片](${r.url})`;
    },
  },
  {
    pattern: /(现在几点|当前时间|现在时间|几点钟|几点了)/i,
    toolName: "get_current_time",
    extractArgs: () => ({}),
    summarize: (_input, r) => {
      return `当前时间是 **${r.human}**。\n\nISO 8601 时间戳：\`${r.iso}\``;
    },
  },
  {
    pattern: /(统计|字数|多少字|多少字符)/,
    toolName: "word_count",
    extractArgs: (input) => {
      const m =
        input.match(/统计[：:.\s]*(.+)/) ||
        input.match(/(.+?)(?:多少字|多少字符|的字数|的字数统计)/);
      const text = m ? m[1].trim() : input;
      return { text };
    },
    summarize: (_input, r) => {
      return `统计结果：\n- 字符数（含空格）：**${r.charsWithSpace}**\n- 字符数（不含空格）：${r.charsNoSpace}\n- 行数：${r.lines}\n- 单词数：${r.words}\n- 中文字数：${r.cjk}`;
    },
  },
  {
    pattern: /(运行\s*js|执行\s*js|跑一下\s*js|js\s*[:：]|node\s*[:：]|执行代码|跑代码)/i,
    toolName: "code_runner",
    extractArgs: (input) => {
      const m =
        input.match(/(?:运行|执行|跑)\s*js\s*[:：]?\s*([\s\S]+)/i) ||
        input.match(/(?:js|node)\s*[:：]\s*([\s\S]+)/i) ||
        input.match(/(?:执行代码|跑代码)\s*[:：]?\s*([\s\S]+)/);
      const code = m ? m[1].trim() : input;
      return { code };
    },
    summarize: (_input, r) => {
      if (!r.ok) return `代码执行失败：\`${r.error}\``;
      const out = r.result !== undefined ? `返回值：\`${r.result}\`` : "（无返回值）";
      const log = r.logText ? `\n\n输出：\n\`\`\`\n${r.logText}\n\`\`\`` : "";
      return `${out}${log}`;
    },
  },
  {
    pattern: /(搜索|搜一下|查一下|lookup|search)\s*[:：\s]*(.+)/i,
    toolName: "web_search",
    extractArgs: (input) => {
      const m = input.match(/(?:搜索|搜一下|查一下|lookup|search)\s*[:：\s]*(.+)/i);
      return { query: m ? m[1].trim() : input, limit: 3 };
    },
    summarize: (input, r) => {
      if (!r.hits || r.hits.length === 0) return `未找到关于"${r.query}"的结果。`;
      const list = r.hits
        .map(
          (h: any, i: number) =>
            `**${i + 1}. [${h.title}](${h.url})**  (相关度 ${(h.score * 100).toFixed(0)}%)\n${h.snippet}`,
        )
        .join("\n\n");
      return `搜索"${r.query}"，共 ${r.count} 条结果：\n\n${list}\n\n> ⚠️ 当前为 Mock 搜索结果，真实 API 接入在 M5+ 规划。`;
    },
  },
  {
    pattern:
      /^[^\u4e00-\u9fa5]{0,80}$|[\d.][\d.\s+\-*/^(),]*(?:sqrt|sin|cos|tan|log|ln|exp|pi|e|\d)/i,
    toolName: "calculator",
    extractArgs: (input) => {
      const m = input.match(
        /([\d.\s+\-*/^(),]*\d[\d.\s+\-*/^(),]*(?:sqrt|sin|cos|tan|log|ln|exp|pi|e)?[\d.\s+\-*/^(),]*)/i,
      );
      if (!m) return null;
      return { expression: m[1].trim() };
    },
    summarize: (_input, r) =>
      `计算结果：**${r.value}**${r.formatted !== String(r.value) ? `（${r.formatted}）` : ""}`,
  },
];

function pickToolRule(input: string): ToolRule | null {
  for (const rule of TOOL_RULES) {
    if (rule.pattern.test(input)) return rule;
  }
  return null;
}

function pickPlan(
  input: string,
): {
  goal: string;
  todos: { id: string; title: string; status: "pending" | "running" | "done" }[];
} | null {
  const m = input.match(/^计划\s*[:：]?\s*(.+)/);
  if (!m) return null;
  const goal = m[1].trim();
  return {
    goal,
    todos: [
      { id: "step1", title: `理解目标：${goal.slice(0, 20)}`, status: "running" },
      { id: "step2", title: "调用相关工具收集信息", status: "pending" },
      { id: "step3", title: "整理信息并给出最终答案", status: "pending" },
    ],
  };
}

function describeAttachments(attachments?: Attachment[]): string {
  if (!attachments || attachments.length === 0) return "";
  const parts: string[] = [];
  const files = attachments.filter((a) => a.type === "file");
  const images = attachments.filter((a) => a.type === "image");
  if (files.length > 0) {
    parts.push(`${files.length} 个文件：${files.map((f) => f.name).join("、")}`);
  }
  if (images.length > 0) {
    parts.push(`${images.length} 张图片`);
  }
  return `\n\n> 📎 用户还上传了：${parts.join("，")}。你可以使用 read_file 工具读取文件内容（需要 fileId）。`;
}

function detectIntent(
  input: string,
  attachments?: Attachment[],
): { reply: string; thought?: string } {
  const trivial = input.trim();
  const attachmentHint = describeAttachments(attachments);

  if (/(你好|hi|hello|嗨|哈喽)/i.test(trivial)) {
    return {
      reply: `你好！我是 NEXUS，一个面向开发者的 AI Agent。\n\n我可以调用工具帮你：\n- 数学计算（"123 * 456"）\n- 查时间（"现在几点"）\n- 联网搜索（"搜索 NEXUS"，Mock 数据）\n- 跑 JS 代码（"运行 JS：1+2*3"）\n- 字数统计（"统计：你好世界"）\n- **生成图片**（"画一张赛博朋克城市"）\n- **读取你上传的文件**${attachmentHint}\n\n试一个具体的问题吧！${attachmentHint ? "\n\n" + attachmentHint : ""}`,
      thought: "用户在进行初次问候，我应该友好地自我介绍并引导用户提出可触发工具的具体问题。",
    };
  }
  if (/(你是谁|你叫什么|什么模型)/i.test(trivial)) {
    return {
      reply: `我是 **NEXUS**，一个开源 AI Agent 学习项目。\n\n当前运行在 \`Mock Provider\` 模式（无需 API Key），可演示工具调用。在 \`/settings\` 切换到 OpenAI 兼容的厂商后可使用真实大模型。${attachmentHint}`,
    };
  }
  if (/(lru|cache|缓存)/i.test(trivial)) {
    return {
      reply: `下面是一个 TypeScript 实现的 LRU 缓存：\n\n\`\`\`ts\nclass LRUCache<K, V> {\n  private map = new Map<K, V>();\n  constructor(private capacity: number) {}\n\n  get(key: K): V | undefined {\n    if (!this.map.has(key)) return undefined;\n    const value = this.map.get(key)!;\n    this.map.delete(key);\n    this.map.set(key, value);\n    return value;\n  }\n\n  put(key: K, value: V): void {\n    if (this.map.has(key)) this.map.delete(key);\n    this.map.set(key, value);\n    if (this.map.size > this.capacity) {\n      const firstKey = this.map.keys().next().value!;\n      this.map.delete(firstKey);\n    }\n  }\n}\n\`\`\`\n\n**复杂度**：读写 O(1)，空间 O(capacity)。${attachmentHint}`,
    };
  }
  if (/(next\.?js|app router)/i.test(trivial)) {
    return {
      reply: `**Next.js App Router vs Pages Router 核心对比**\n\n| 维度 | App Router (RSC) | Pages Router |\n|------|------------------|--------------|\n| 渲染模型 | 默认 Server Components | 默认 CSR |\n| 数据获取 | 异步 \`async\` 组件 | \`getServerSideProps\` |\n| 路由 | 嵌套 Layout | \`pages/\` 平铺 |\n| Streaming | 原生 RSC 流式 | 需 SWR |\n\n新项目直接用 App Router，老项目短期不必迁移。${attachmentHint}`,
    };
  }

  let extra = "";
  if (attachments && attachments.length > 0) {
    extra = `\n\n📎 检测到你上传了附件，你可以让我帮你读取文件内容。${attachmentHint}`;
  }

  return {
    reply: `这是 Mock Provider 的演示回复。\n\n你输入了：\`${input.slice(0, 200)}\`\n\n我可以调用工具帮你做事，试试：\n- "123 * 456" （calculator）\n- "现在几点" （get_current_time）\n- "运行 JS：1+2*3" （code_runner）\n- "搜索 NEXUS" （web_search Mock）\n- "统计：你好世界" （word_count）\n- **"画一张赛博朋克图片"（generate_image）**${extra}`,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class MockProvider implements LLMProvider {
  name = "mock";

  async *stream(opts: {
    messages: Array<{
      role: "system" | "user" | "assistant" | "tool";
      content: string;
      name?: string;
      toolCallId?: string;
      attachments?: Attachment[];
    }>;
    tools?: ToolDefinition[];
    model?: string;
    temperature?: number;
    signal?: AbortSignal;
  }): AsyncIterable<AgentStep> {
    const lastUser = [...opts.messages].reverse().find((m) => m.role === "user");
    const lastTool = [...opts.messages].reverse().find((m) => m.role === "tool");
    const lastSystem = [...opts.messages].reverse().find((m) => m.role === "system");
    const input = lastUser?.content ?? "";
    const attachments = lastUser?.attachments;
    const isReflectionRevise = lastSystem?.content.startsWith("[Reflection]") ?? false;

    if (lastTool) {
      const toolName = lastTool.name ?? "";
      let result: any = null;
      try {
        result = JSON.parse(lastTool.content);
      } catch {
        result = { raw: lastTool.content };
      }
      const rule = TOOL_RULES.find((r) => r.toolName === toolName);
      const summary = rule
        ? rule.summarize(input, result)
        : `工具 ${toolName} 返回：\`${JSON.stringify(result)}\``;
      yield { kind: "thought", content: `工具 ${toolName} 返回了结果，我把它整理成自然语言。` };
      await sleep(300);
      const score = isReflectionRevise ? 0.9 : 0.85;
      const critique = isReflectionRevise ? "已根据反馈改进答案。" : "答案基于工具结果，可信度高。";
      yield { kind: "reflection", score, critique, revise: false };
      const chars = Array.from(summary);
      for (const ch of chars) {
        if (opts.signal?.aborted) return;
        yield { kind: "delta", content: ch };
        await sleep(8 + Math.random() * 14);
      }
      yield {
        kind: "done",
        usage: {
          prompt: input.length,
          completion: summary.length,
          total: input.length + summary.length,
        },
        runId: `mock-${Date.now()}`,
      };
      return;
    }

    if (isReflectionRevise) {
      yield { kind: "thought", content: "根据反思反馈重新生成答案。" };
      await sleep(200);
      const reply = `**改进版答案**：\n\n针对"${input}"，基于反思反馈，我重新整理：\n\n1. 核心要点：...\n2. 详细说明：...\n3. 建议：...`;
      for (const ch of Array.from(reply)) {
        if (opts.signal?.aborted) return;
        yield { kind: "delta", content: ch };
        await sleep(8 + Math.random() * 14);
      }
      yield { kind: "reflection", score: 0.92, critique: "已改进，覆盖更全面。", revise: false };
      yield {
        kind: "done",
        usage: {
          prompt: input.length,
          completion: reply.length,
          total: input.length + reply.length,
        },
        runId: `mock-${Date.now()}`,
      };
      return;
    }

    const plan = pickPlan(input);
    if (plan) {
      yield { kind: "thought", content: `用户想要"${plan.goal}"，我先制定一个计划。` };
      await sleep(200);
      yield { kind: "plan", todos: plan.todos };
      await sleep(200);
      const m = plan.goal.match(
        /([\d.\s+\-*/^(),]*\d[\d.\s+\-*/^(),]*(?:sqrt|sin|cos|tan|log|ln|exp|pi|e)?[\d.\s+\-*/^(),]*)/i,
      );
      if (m) {
        yield {
          kind: "tool_call",
          name: "calculator",
          args: { expression: m[1].trim() },
          requireConfirm: false,
        };
        return;
      }
    }

    const rule = pickToolRule(input);
    if (rule) {
      const args = rule.extractArgs(input);
      if (args) {
        yield { kind: "thought", content: `用户的需求看起来需要调用 \`${rule.toolName}\` 工具。` };
        await sleep(250);
        yield {
          kind: "tool_call",
          name: rule.toolName,
          args,
          requireConfirm: false,
        };
        return;
      }
    }

    const { reply, thought } = detectIntent(input, attachments);
    if (thought) {
      yield { kind: "thought", content: thought };
      await sleep(250);
    }
    const chars = Array.from(reply);
    let buffer = "";
    for (const ch of chars) {
      if (opts.signal?.aborted) return;
      buffer += ch;
      yield { kind: "delta", content: ch };
      await sleep(8 + Math.random() * 18);
    }
    yield {
      kind: "reflection",
      score: 0.88,
      critique: "已根据用户问题给出通用回答。",
      revise: false,
    };
    yield {
      kind: "done",
      usage: {
        prompt: input.length,
        completion: buffer.length,
        total: input.length + buffer.length,
      },
      runId: `mock-${Date.now()}`,
    };
  }

  async complete(opts: {
    messages: Array<{
      role: "system" | "user" | "assistant" | "tool";
      content: string;
      name?: string;
      toolCallId?: string;
      attachments?: Attachment[];
    }>;
    jsonMode?: boolean;
  }): Promise<{ content: string; usage: { prompt: number; completion: number; total: number } }> {
    const last = [...opts.messages].reverse().find((m) => m.role === "user");
    const content = last?.content ?? "";
    const reply = `[mock-complete] ${content.slice(0, 200)}`;
    return {
      content: opts.jsonMode ? JSON.stringify({ ok: true, mock: true }) : reply,
      usage: {
        prompt: content.length,
        completion: reply.length,
        total: content.length + reply.length,
      },
    };
  }

  async embed(text: string): Promise<number[]> {
    const dim = 1536;
    const vec = new Array<number>(dim).fill(0);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      vec[i % dim] += (code % 97) / 100;
    }
    const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
    return vec.map((x) => x / norm);
  }
}
