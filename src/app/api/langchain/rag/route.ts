// M17: LangChain RAG 查询 API
// 学习对比：LangChain RetrievalQAChain vs 自研 rag-service
// M17 补全: 新增 DocumentLoader 对比

import { NextRequest, NextResponse } from "next/server";
import { ragQuery, compareChunking } from "@/server/langchain/rag";
import { comparePdfLoaders, getLoaderComparison } from "@/server/langchain/document-loaders";
import { optionalAuth } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authCtx = await optionalAuth(req);

  try {
    const body = await req.json();
    const { question, mode } = body;

    if (mode === "compare-chunking") {
      // 分块对比实验
      const text =
        body.text ||
        "这是一个用于测试分块的文本。\n\n第一段内容。\n\n第二段内容，包含一些较长的句子来测试分块策略的效果。";
      const result = await compareChunking(text);
      return NextResponse.json({ result });
    }

    if (mode === "compare-pdf-loader") {
      // PDF 加载器对比
      const filePath = body.filePath || "/tmp/sample.pdf";
      const result = comparePdfLoaders(filePath);
      return NextResponse.json({ result });
    }

    if (mode === "loader-info") {
      // Loader 生态信息
      return NextResponse.json({ result: getLoaderComparison() });
    }

    if (!question) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    // RAG 查询
    const result = await ragQuery(question);
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  // GET 返回 Loader 对比信息
  return NextResponse.json({ loaders: getLoaderComparison() });
}
