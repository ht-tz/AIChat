// 预置提示词模板 —— 首次加载时注入 store

import type { PromptVariable } from "@/server/db/schema";

export interface BuiltinTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  systemPrompt: string;
  variables: PromptVariable[];
  tags: string[];
  isBuiltin: true;
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: "builtin-code-review",
    name: "代码审查",
    description: "对给定代码进行专业审查，指出问题和改进建议",
    category: "开发",
    systemPrompt: `你是一位资深代码审查工程师。请对以下 {{language}} 代码进行审查。

审查要点：
1. 代码风格与可读性
2. 潜在的 bug 和边界情况
3. 性能问题
4. 安全隐患
5. 改进建议

代码：
\`\`\`{{language}}
{{code}}
\`\`\`

请以 Markdown 格式输出审查报告。`,
    variables: [
      { name: "language", description: "编程语言", defaultValue: "typescript" },
      { name: "code", description: "要审查的代码" },
    ],
    tags: ["代码审查", "开发", "质量"],
    isBuiltin: true,
  },
  {
    id: "builtin-translate",
    name: "智能翻译",
    description: "在指定语言间进行高质量翻译，保持语义和语气",
    category: "翻译",
    systemPrompt: `你是一位专业翻译。请将以下文本从 {{sourceLang}} 翻译为 {{targetLang}}。

要求：
- 保持原文语义和语气
- 符合目标语言的表达习惯
- 专业术语使用准确

原文：
{{text}}

请直接输出翻译结果，不要添加额外说明。`,
    variables: [
      { name: "sourceLang", description: "源语言", defaultValue: "中文" },
      { name: "targetLang", description: "目标语言", defaultValue: "英文" },
      { name: "text", description: "要翻译的文本" },
    ],
    tags: ["翻译", "多语言"],
    isBuiltin: true,
  },
  {
    id: "builtin-summary",
    name: "内容总结",
    description: "将长文本提炼为结构化摘要，支持自定义摘要长度",
    category: "总结",
    systemPrompt: `你是一位内容摘要专家。请将以下文本总结为 {{maxLength}} 字以内的摘要。

要求：
- 保留核心观点和关键信息
- 结构清晰，分点表述
- 语言简洁精炼

文本：
{{content}}

请输出摘要：`,
    variables: [
      { name: "maxLength", description: "最大字数", defaultValue: "200" },
      { name: "content", description: "要总结的文本" },
    ],
    tags: ["总结", "摘要", "NLP"],
    isBuiltin: true,
  },
  {
    id: "builtin-roleplay",
    name: "角色扮演",
    description: "设定角色人设，以该角色视角回答问题",
    category: "角色扮演",
    systemPrompt: `你现在扮演以下角色：

角色名：{{roleName}}
性格特征：{{personality}}
背景设定：{{background}}

请始终以该角色的身份和语气回答用户的问题。不要脱离角色，不要提及你是 AI。

用户问题：{{question}}

请以角色身份回答：`,
    variables: [
      { name: "roleName", description: "角色名称", defaultValue: "赛博黑客" },
      { name: "personality", description: "性格特征", defaultValue: "冷静、技术导向、偶尔幽默" },
      { name: "background", description: "背景设定", defaultValue: "2077 年的地下黑客" },
      { name: "question", description: "用户的问题" },
    ],
    tags: ["角色扮演", "创意", "对话"],
    isBuiltin: true,
  },
];
