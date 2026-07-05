// 知识库文档 API

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { documentService, ragService } from "@/server/knowledge";
import { applyRateLimit, validateText } from "@/server/middleware";
import { recordPerformance } from "@/server/monitoring/performance";
import { requireAuth } from "@/server/auth/auth-middleware";

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

export const GET = requireAuth(async (req, ctx) => {
  const startTime = Date.now();
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
});

export const POST = requireAuth(async (req, ctx) => {
  const startTime = Date.now();
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
});

const UpdateDocSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  source: z.string().optional(),
});

export const PUT = requireAuth(async (req, ctx) => {
  const startTime = Date.now();
  const ip = getClientIp(req);
  const { allowed, headers: rateLimitHeaders } = applyRateLimit(ip, "/api/knowledge/documents");
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimitHeaders },
    );
  }

  let body: z.infer<typeof UpdateDocSchema>;
  try {
    const raw = await req.json();
    body = UpdateDocSchema.parse(raw);
  } catch (err) {
    recordPerformance("/api/knowledge/documents", "PUT", Date.now() - startTime, 400);
    return NextResponse.json(
      { error: "Invalid request body", detail: String(err) },
      { status: 400, headers: rateLimitHeaders },
    );
  }
  const { id, ...updates } = body;
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
});

const DeleteDocSchema = z.object({
  id: z.string().min(1),
});

export const DELETE = requireAuth(async (req, ctx) => {
  const startTime = Date.now();
  const ip = getClientIp(req);
  const { allowed, headers: rateLimitHeaders } = applyRateLimit(ip, "/api/knowledge/documents");
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimitHeaders },
    );
  }

  let body: z.infer<typeof DeleteDocSchema>;
  try {
    const raw = await req.json();
    body = DeleteDocSchema.parse(raw);
  } catch (err) {
    recordPerformance("/api/knowledge/documents", "DELETE", Date.now() - startTime, 400);
    return NextResponse.json(
      { error: "Invalid request body", detail: String(err) },
      { status: 400, headers: rateLimitHeaders },
    );
  }
  ragService.removeDocumentFromStore(body.id);
  const removed = documentService.deleteDocument(body.id);
  if (!removed) {
    recordPerformance("/api/knowledge/documents", "DELETE", Date.now() - startTime, 404);
    return NextResponse.json(
      { error: "Document not found" },
      { status: 404, headers: rateLimitHeaders },
    );
  }
  recordPerformance("/api/knowledge/documents", "DELETE", Date.now() - startTime, 200);
  return NextResponse.json({ success: true }, { headers: rateLimitHeaders });
});
