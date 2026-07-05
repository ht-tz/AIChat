// 报告导出 API
// POST /api/export —— 导出 Markdown 报告

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { sessions, messages as messagesTable } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { summarizeReportTool } from "@/server/tools/builtin/summarize_report";
import { optionalAuth } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  sessionId: z.string().min(1),
  format: z.enum(["markdown"]).default("markdown"),
  includeSummary: z.boolean().default(true),
  title: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const authCtx = await optionalAuth(request);
  let parsed: z.infer<typeof BodySchema>;
  try {
    const raw = await request.json();
    parsed = BodySchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", detail: String(err) },
      { status: 400 },
    );
  }

  try {
    if (!db) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    // 查询会话
    const sessionRows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, parsed.sessionId))
      .limit(1);
    const session = sessionRows[0];

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // 查询消息
    const dbMessages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.sessionId, parsed.sessionId))
      .orderBy(messagesTable.createdAt);

    const messages = dbMessages.map((m) => ({
      role: m.role as "system" | "user" | "assistant" | "tool",
      content: m.content,
      attachments:
        (m.attachments as Array<{
          id: string;
          type: string;
          name: string;
          url: string;
          mimeType: string;
          size: number;
        }> | null) || undefined,
    }));

    // 生成报告
    const reportResult = (await summarizeReportTool.execute(
      {
        messages,
        title: parsed.title || session.title || "NEXUS 对话报告",
        includeSummary: parsed.includeSummary,
      },
      { sessionId: parsed.sessionId },
    )) as { content: string };

    const report = reportResult.content;
    const filename = `${(parsed.title || session.title || "report").replace(/\s+/g, "_")}.md`;

    return new NextResponse(report, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
