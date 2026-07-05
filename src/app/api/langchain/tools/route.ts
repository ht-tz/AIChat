// M17: LangChain 工具调用 API
// 学习对比：LangChain DynamicTool vs 自研 toolRegistry

import { NextRequest, NextResponse } from "next/server";
import { adaptToLangChainTools, listToolComparison } from "@/server/langchain/tools-adapter";
import { toolRegistry } from "@/server/tools";
import { optionalAuth } from "@/server/auth";

export async function GET(req: NextRequest) {
  const authCtx = await optionalAuth(req);
  // 列出所有工具及适配状态
  return NextResponse.json({ tools: listToolComparison() });
}

export async function POST(req: NextRequest) {
  const authCtx = await optionalAuth(req);

  try {
    const body = await req.json();
    const { toolName, args, engine } = body;

    if (!toolName) {
      return NextResponse.json({ error: "toolName is required" }, { status: 400 });
    }

    if (engine === "langchain") {
      // LangChain DynamicTool 执行
      const lcTools = adaptToLangChainTools();
      const tool = lcTools.find((t) => t.name === toolName);
      if (!tool) {
        return NextResponse.json({ error: `Tool "${toolName}" not found` }, { status: 404 });
      }
      const result = await tool.invoke(JSON.stringify(args ?? {}));
      return NextResponse.json({
        engine: "langchain",
        toolName,
        result: typeof result === "string" ? result : JSON.stringify(result),
      });
    } else {
      // 自研 toolRegistry 执行
      const { result, durationMs } = await toolRegistry.execute(toolName, args ?? {});
      return NextResponse.json({
        engine: "builtin",
        toolName,
        result,
        durationMs,
      });
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
