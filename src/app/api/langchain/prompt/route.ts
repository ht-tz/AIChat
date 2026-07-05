// M16: LangChain PromptTemplate API
// 学习对比：使用 LangChain PromptTemplate vs 自研字符串拼接

import { NextRequest, NextResponse } from "next/server";
import {
  createPromptExamples,
  createPlanParser,
  createReflectionParser,
  createRAGPrompt,
} from "@/server/langchain/prompts";
import { optionalAuth } from "@/server/auth";

export async function POST(req: NextRequest) {
  const authCtx = await optionalAuth(req);

  try {
    const body = await req.json();
    const { type, variables } = body;

    let result: unknown;

    switch (type) {
      case "basic": {
        const { basicTemplate } = createPromptExamples();
        result = await basicTemplate.format(variables);
        break;
      }

      case "chat": {
        const { chatTemplate } = createPromptExamples();
        result = await chatTemplate.format(variables);
        break;
      }

      case "plan": {
        const { parser, planPrompt } = createPlanParser();
        const formatted = await planPrompt.format({
          ...variables,
          format_instructions: parser.getFormatInstructions(),
        });
        result = { prompt: formatted, formatInstructions: parser.getFormatInstructions() };
        break;
      }

      case "reflection": {
        const { parser, reflectionPrompt } = createReflectionParser();
        const formatted = await reflectionPrompt.format({
          ...variables,
          format_instructions: parser.getFormatInstructions(),
        });
        result = { prompt: formatted, formatInstructions: parser.getFormatInstructions() };
        break;
      }

      case "rag": {
        const { ragPrompt } = createRAGPrompt();
        result = await ragPrompt.format(variables);
        break;
      }

      default:
        return NextResponse.json({ error: "Unknown type" }, { status: 400 });
    }

    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
