// 评估指标 API

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  evaluateAnswerQuality,
  evaluateRetrieval,
  getEvaluationStats,
  clearEvaluations,
} from "@/server/monitoring/evaluation";
import { requireAuth } from "@/server/auth/auth-middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QualitySchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

const RetrievalSchema = z.object({
  query: z.string().min(1),
  retrieved: z.array(z.string()),
  relevant: z.array(z.string()),
});

export const GET = requireAuth(async (req, ctx) => {
  const stats = getEvaluationStats();
  return NextResponse.json(stats);
});

export const POST = requireAuth(async (req, ctx) => {
  try {
    const raw = await req.json();

    if (raw.type === "quality") {
      const body = QualitySchema.parse(raw);
      const score = evaluateAnswerQuality(body.question, body.answer);
      return NextResponse.json(score);
    }

    if (raw.type === "retrieval") {
      const body = RetrievalSchema.parse(raw);
      const metric = evaluateRetrieval(body.query, body.retrieved, body.relevant);
      return NextResponse.json(metric);
    }

    return NextResponse.json(
      { error: 'Invalid type, must be "quality" or "retrieval"' },
      { status: 400 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", detail: String(err) },
      { status: 400 },
    );
  }
});

export const DELETE = requireAuth(async (req, ctx) => {
  clearEvaluations();
  return NextResponse.json({ success: true, message: "Evaluation records cleared" });
});
