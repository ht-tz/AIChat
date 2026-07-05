// 知识库文档 API

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { documentService, ragService } from "@/server/knowledge";
import { applyRateLimit, validateText } from "@/server/middleware";
import { recordPerformance } from "@/server/monitoring/performance";
import { optionalAuth } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

const CreateSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["text", "markdown", "url", "database"]),
  source: z.string(),
  content: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const authCtx = await optionalAuth(req);
  const ip = getClientIp(req);
  const { allowed, headers: rateLimitHeaders } = applyRateLimit(ip, "/api/knowledge/documents");
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimitHeaders },
    );
  }
  const documents = documentService.listDocuments();
  const stats = ragService.getStats();
  recordPerformance("/api/knowledge/documents", "GET", Date.now() - startTime, 200);
  return NextResponse.json({ documents, stats }, { headers: rateLimitHeaders });
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const authCtx = await optionalAuth(req);
  const ip = getClientIp(req);
  const { allowed, headers: rateLimitHeaders } = applyRateLimit(ip, "/api/knowledge/documents");
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimitHeaders },
    );
  }

  let body: z.infer<typeof CreateSchema>;
  try {
    const raw = await req.json();
    body = CreateSchema.parse(raw);
  } catch (err) {
    recordPerformance("/api/knowledge/documents", "POST", Date.now() - startTime, 400);
    return NextResponse.json(
      { error: "Invalid request body", detail: String(err) },
      { status: 400, headers: rateLimitHeaders },
    );
  }

  const titleValidation = validateText(body.title);
  const contentValidation = validateText(body.content);
  if (!titleValidation.valid || !contentValidation.valid) {
    recordPerformance("/api/knowledge/documents", "POST", Date.now() - startTime, 400);
    return NextResponse.json(
      {
        error: "Invalid input",
        titleErrors: titleValidation.errors,
        contentErrors: contentValidation.errors,
      },
      { status: 400, headers: rateLimitHeaders },
    );
  }

  try {
    const doc = await documentService.createDocument(
      body.title,
      body.type,
      body.source,
      body.content,
    );
    await ragService.addDocumentToStore(doc.id);
    recordPerformance("/api/knowledge/documents", "POST", Date.now() - startTime, 201);
    return NextResponse.json(doc, { status: 201, headers: rateLimitHeaders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    recordPerformance(
      "/api/knowledge/documents",
      "POST",
      Date.now() - startTime,
      500,
      undefined,
      msg,
    );
    return NextResponse.json({ error: msg }, { status: 500, headers: rateLimitHeaders });
  }
}

export async function PUT(req: NextRequest) {
  const startTime = Date.now();
  const authCtx = await optionalAuth(req);
  const ip = getClientIp(req);
  const { allowed, headers: rateLimitHeaders } = applyRateLimit(ip, "/api/knowledge/documents");
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimitHeaders },
    );
  }

  const { id, ...updates } = await req.json();
  if (!id) {
    recordPerformance("/api/knowledge/documents", "PUT", Date.now() - startTime, 400);
    return NextResponse.json(
      { error: "id is required" },
      { status: 400, headers: rateLimitHeaders },
    );
  }
  const result = await documentService.updateDocument(id, updates);
  if (!result) {
    recordPerformance("/api/knowledge/documents", "PUT", Date.now() - startTime, 404);
    return NextResponse.json(
      { error: "Document not found" },
      { status: 404, headers: rateLimitHeaders },
    );
  }
  await ragService.removeDocumentFromStore(id);
  await ragService.addDocumentToStore(id);
  recordPerformance("/api/knowledge/documents", "PUT", Date.now() - startTime, 200);
  return NextResponse.json(result, { headers: rateLimitHeaders });
}

export async function DELETE(req: NextRequest) {
  const startTime = Date.now();
  const authCtx = await optionalAuth(req);
  const ip = getClientIp(req);
  const { allowed, headers: rateLimitHeaders } = applyRateLimit(ip, "/api/knowledge/documents");
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimitHeaders },
    );
  }

  const { id } = await req.json();
  if (!id) {
    recordPerformance("/api/knowledge/documents", "DELETE", Date.now() - startTime, 400);
    return NextResponse.json(
      { error: "id is required" },
      { status: 400, headers: rateLimitHeaders },
    );
  }
  ragService.removeDocumentFromStore(id);
  const removed = documentService.deleteDocument(id);
  if (!removed) {
    recordPerformance("/api/knowledge/documents", "DELETE", Date.now() - startTime, 404);
    return NextResponse.json(
      { error: "Document not found" },
      { status: 404, headers: rateLimitHeaders },
    );
  }
  recordPerformance("/api/knowledge/documents", "DELETE", Date.now() - startTime, 200);
  return NextResponse.json({ success: true }, { headers: rateLimitHeaders });
}
