// 知识库搜索 API

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ragService } from "@/server/knowledge";
import { applyRateLimit, validateText } from "@/server/middleware";
import { recordPerformance } from "@/server/monitoring/performance";
import { optionalAuth } from "@/server/auth/auth-middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

const BodySchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().optional(),
  minSimilarity: z.number().min(0).max(1).optional(),
});

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const authCtx = await optionalAuth(req);
  const ip = getClientIp(req);
  const { allowed, headers: rateLimitHeaders } = await applyRateLimit(ip, "/api/knowledge/search");
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimitHeaders },
    );
  }

  let body: z.infer<typeof BodySchema>;
  try {
    const raw = await req.json();
    body = BodySchema.parse(raw);
  } catch (err) {
    recordPerformance("/api/knowledge/search", "POST", Date.now() - startTime, 400);
    return NextResponse.json(
      { error: "Invalid request body", detail: String(err) },
      { status: 400, headers: rateLimitHeaders },
    );
  }

  const queryValidation = validateText(body.query);
  if (!queryValidation.valid) {
    recordPerformance("/api/knowledge/search", "POST", Date.now() - startTime, 400);
    return NextResponse.json(
      { error: "Invalid query input", details: queryValidation.errors },
      { status: 400, headers: rateLimitHeaders },
    );
  }

  try {
    const result = await ragService.retrieve(body.query, {
      limit: body.limit,
      minSimilarity: body.minSimilarity,
    });
    recordPerformance("/api/knowledge/search", "POST", Date.now() - startTime, 200);
    return NextResponse.json(result, { headers: rateLimitHeaders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    recordPerformance("/api/knowledge/search", "POST", Date.now() - startTime, 500, undefined, msg);
    return NextResponse.json({ error: msg }, { status: 500, headers: rateLimitHeaders });
  }
}
