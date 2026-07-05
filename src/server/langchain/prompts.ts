// LangChain PromptTemplate + OutputParser 实验室
// 学习目标：使用 LangChain 的提示词模板和输出解析器
// 对比：自研方案中手写字符串拼接 + JSON.parse + Zod 验证
//
// 核心概念：
// 1. PromptTemplate — 参数化提示词，支持变量注入
// 2. ChatPromptTemplate — 多角色对话模板（system/human/ai）
// 3. StructuredOutputParser — 结构化输出解析，绑定 Zod schema
// 4. LCEL Chain — LangChain Expression Language（pipe 语法）

import { ChatPromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";

/**
 * 1. 基础 PromptTemplate —— 对比自研字符串拼接
 *
 * 自研方案：
 *   const prompt = `你是一个${role}，请回答：${question}`;
 *
 * LangChain 方案：
 *   const template = PromptTemplate.fromTemplate("你是一个{role}，请回答：{question}");
 *   const prompt = await template.format({ role: "分析师", question: "..." });
 */
export function createPromptExamples() {
  // 基础模板
  const basicTemplate = PromptTemplate.fromTemplate(
    "你是一个{role}，请用{tone}的语气回答以下问题：\n\n{question}",
  );

  // 对话模板（多角色）
  const chatTemplate = ChatPromptTemplate.fromMessages([
    ["system", "你是一个专业的{role}，擅长{skill}。"],
    ["human", "{question}"],
  ]);

  return { basicTemplate, chatTemplate };
}

/**
 * 2. 规划提示词模板 —— 对比自研 plan 生成
 *
 * 自研方案（reasoning-service.ts）：
 *   const planPrompt = `分析以下任务，拆解为 3-5 个步骤...\n${userInput}`;
 *   const result = await getProvider().complete({ messages: [...] });
 *   const plan = JSON.parse(result.content);
 *
 * LangChain 方案：
 *   使用 StructuredOutputParser + Zod，自动生成格式指令
 */
export function createPlanParser() {
  // 定义输出 schema
  const planSchema = z.object({
    steps: z
      .array(
        z.object({
          id: z.string().describe("步骤唯一标识"),
          title: z.string().describe("步骤标题"),
          description: z.string().describe("步骤详细描述"),
          dependencies: z.array(z.string()).describe("依赖的前置步骤 ID"),
        }),
      )
      .describe("任务拆解的步骤列表"),
  });

  // 创建结构化输出解析器
  const parser = StructuredOutputParser.fromZodSchema(planSchema);

  // 规划提示词模板
  const planPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `你是一个任务规划专家。将用户任务拆解为 3-5 个可执行步骤。
        
{format_instructions}`,
    ],
    ["human", "{task}"],
  ]);

  return { parser, planPrompt, planSchema };
}

/**
 * 3. 反思提示词模板 —— 对比自研 reflection 评分
 *
 * 自研方案：
 *   手写 prompt → complete → JSON.parse → 提取 score/critique/revise
 *
 * LangChain 方案：
 *   StructuredOutputParser 自动处理格式化和解析
 */
export function createReflectionParser() {
  const reflectionSchema = z.object({
    score: z.number().min(1).max(10).describe("回答质量评分（1-10）"),
    critique: z.string().describe("对回答的评价"),
    revise: z.boolean().describe("是否需要修改"),
    suggestions: z.array(z.string()).describe("具体改进建议"),
  });

  const parser = StructuredOutputParser.fromZodSchema(reflectionSchema);

  const reflectionPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `你是一个质量评审专家。评估以下回答的质量。
      
{format_instructions}`,
    ],
    ["human", "问题：{question}\n\n回答：{answer}"],
  ]);

  return { parser, reflectionPrompt, reflectionSchema };
}

/**
 * 4. RAG 提示词模板 —— 对比自研 rag-service.ts
 *
 * 自研方案：
 *   const prompt = `基于以下上下文回答问题：\n${context}\n\n问题：${query}`;
 *
 * LangChain 方案：
 *   ChatPromptTemplate + format_instructions 自动注入
 */
export function createRAGPrompt() {
  const ragPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `你是一个知识助手。基于以下检索到的上下文回答用户问题。
如果上下文中没有相关信息，请诚实说明。

上下文：
{context}

来源：
{sources}`,
    ],
    ["human", "{question}"],
  ]);

  return { ragPrompt };
}

/**
 * 5. 多智能体角色提示词 —— 对比自研 agents.ts
 *
 * 为 8 个预置 Agent 生成角色提示词
 */
export function createAgentRolePrompts() {
  const roleTemplate = PromptTemplate.fromTemplate(
    `你是「{agentName}」，一个{role}。

你的核心职责：
{responsibilities}

你的专业能力：
{skills}

你的工作风格：
{style}

请以你的角色视角处理以下任务：`,
  );

  return { roleTemplate };
}

/**
 * 6. LCEL Chain 示例 —— LangChain 表达式语言
 *
 * LCEL (LangChain Expression Language) 使用 pipe 语法串联组件：
 *   prompt | model | parser
 *
 * 对比自研方案：手动调用 complete() → JSON.parse() → 验证
 */
export async function createPlanChain(input: { task: string }) {
  const { ChatOpenAI } = await import("@langchain/openai");
  const { parser, planPrompt } = createPlanParser();

  const model = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY ?? "",
    configuration: {
      baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    },
    modelName: process.env.DEFAULT_MODEL ?? "gpt-4o-mini",
    temperature: 0.3,
  });

  // LCEL Chain: prompt → model → parser
  const chain = planPrompt.pipe(model).pipe(parser);

  const result = await chain.invoke({
    task: input.task,
    format_instructions: parser.getFormatInstructions(),
  });

  return result;
}

/**
 * 7. JsonOutputParser 示例 —— 简单 JSON 输出
 *
 * 对比自研方案中 jsonMode: true 的使用
 */
export function createJsonParser() {
  // JsonOutputParser 从 @langchain/core/output_parsers 导入
  // 这里用 StructuredOutputParser 替代，功能更强大
  const schema = z.object({
    result: z.string().describe("结果"),
  });
  const parser = StructuredOutputParser.fromZodSchema(schema);
  return { parser };
}
