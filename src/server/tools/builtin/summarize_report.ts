// summarize_report —— Markdown 报告生成工具

import { z } from "zod";
import type { Tool } from "../types";

const Params = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant", "tool"]),
        content: z.string(),
        attachments: z
          .array(
            z.object({
              id: z.string(),
              type: z.string(),
              name: z.string(),
              url: z.string(),
              mimeType: z.string(),
              size: z.number(),
            }),
          )
          .optional(),
      }),
    )
    .describe("对话历史消息列表"),
  title: z.string().optional().describe("报告标题"),
  includeSummary: z.boolean().default(true).describe("是否包含对话摘要"),
});

type ReportMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  attachments?: Array<{
    id: string;
    type: string;
    name: string;
    url: string;
    mimeType: string;
    size: number;
  }>;
};

function generateSummary(messages: ReportMessage[]): string {
  const userMessages = messages.filter((m) => m.role === "user");
  const assistantMessages = messages.filter((m) => m.role === "assistant");

  const topics: string[] = [];
  for (const msg of userMessages) {
    const lines = msg.content.split(/[。！？\n]/).filter((l) => l.trim().length > 5);
    for (const line of lines.slice(0, 3)) {
      if (!topics.includes(line.trim())) topics.push(line.trim());
    }
  }

  return [
    "本次对话中，用户提出了以下问题：",
    "",
    ...topics.slice(0, 5).map((t) => `- ${t}`),
    "",
    `AI 提供了 ${assistantMessages.length} 条回复，涵盖了对话主题的各个方面。`,
  ].join("\n");
}

function collectAttachments(
  messages: ReportMessage[],
): Array<{ name: string; type: string; size: number; url: string }> {
  const result: Array<{ name: string; type: string; size: number; url: string }> = [];
  for (const msg of messages) {
    if (msg.attachments) {
      for (const att of msg.attachments) {
        if (!result.find((r) => r.url === att.url)) {
          result.push({ name: att.name, type: att.type, size: att.size, url: att.url });
        }
      }
    }
  }
  return result;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function generateMarkdownReport(args: z.infer<typeof Params>): string {
  const { messages, title, includeSummary } = args;
  const now = new Date();
  const userCount = messages.filter((m) => m.role === "user").length;
  const assistantCount = messages.filter((m) => m.role === "assistant").length;
  const attachments = collectAttachments(messages);

  const lines: string[] = [];

  lines.push(`# ${title || "NEXUS 对话报告"}`);
  lines.push("");
  lines.push("## 基本信息");
  lines.push("");
  lines.push(`- 报告标题：${title || "NEXUS 对话报告"}`);
  lines.push(`- 生成时间：${now.toLocaleString("zh-CN")}`);
  lines.push(`- 消息总数：${messages.length}`);
  lines.push(`- 用户消息：${userCount}`);
  lines.push(`- AI 回复：${assistantCount}`);
  lines.push(`- 附件数量：${attachments.length}`);
  lines.push("");

  if (includeSummary) {
    lines.push("## 对话摘要");
    lines.push("");
    lines.push(generateSummary(messages));
    lines.push("");
  }

  if (attachments.length > 0) {
    lines.push("## 附件列表");
    lines.push("");
    lines.push("| 名称 | 类型 | 大小 |");
    lines.push("|------|------|------|");
    for (const att of attachments) {
      lines.push(`| ${att.name} | ${att.type} | ${formatBytes(att.size)} |`);
    }
    lines.push("");
  }

  lines.push("## 完整对话记录");
  lines.push("");

  for (const msg of messages) {
    if (msg.role === "system") continue;
    const label = msg.role === "user" ? "用户" : msg.role === "assistant" ? "AI" : "工具";
    const emoji = msg.role === "user" ? "👤" : msg.role === "assistant" ? "🤖" : "🔧";
    lines.push("---");
    lines.push(`### ${emoji} ${label}`);
    lines.push("");
    lines.push(msg.content);
    lines.push("");

    if (msg.attachments && msg.attachments.length > 0) {
      lines.push("**附件：**");
      for (const att of msg.attachments) {
        lines.push(`- [${att.name}](${att.url}) (${att.type}, ${formatBytes(att.size)})`);
      }
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");
  lines.push("## 统计信息");
  lines.push("");
  lines.push("- 生成工具：NEXUS Export API");
  lines.push("- 报告格式：Markdown");
  lines.push(`- 生成日期：${now.toLocaleString("zh-CN")}`);
  lines.push("");

  return lines.join("\n");
}

export const summarizeReportTool: Tool<typeof Params> = {
  name: "summarize_report",
  description:
    "将对话历史汇总为结构化 Markdown 报告。包含基本信息、对话摘要、附件列表和完整对话记录。",
  parameters: Params,
  execute: async (args) => {
    const report = generateMarkdownReport(args);
    const attachments = collectAttachments(args.messages);
    return {
      title: args.title || "NEXUS 对话报告",
      content: report,
      messageCount: args.messages.length,
      attachmentCount: attachments.length,
    };
  },
  toDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: "object",
        properties: {
          messages: {
            type: "array",
            items: {
              type: "object",
              properties: {
                role: { type: "string", enum: ["system", "user", "assistant", "tool"] },
                content: { type: "string" },
                attachments: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      type: { type: "string" },
                      name: { type: "string" },
                      url: { type: "string" },
                      mimeType: { type: "string" },
                      size: { type: "number" },
                    },
                  },
                },
              },
            },
          },
          title: { type: "string" },
          includeSummary: { type: "boolean" },
        },
        required: ["messages"],
      },
    };
  },
};
