// 经验案例 API

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { experienceService } from "@/server/memory";
import { optionalAuth } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  sessionId: z.string().optional(),
  runId: z.string().optional(),
  type: z.enum(["success", "failure", "insight"]),
  title: z.string().min(1),
  description: z.string().optional(),
  lesson: z.string().min(1),
  context: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  rating: z.number().min(0).max(5).optional(),
});

export async function GET(req: NextRequest) {
  const authCtx = await optionalAuth(req);
  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get("type") as "success" | "failure" | "insight" | null;

  const experiences = experienceService.list(type ? { type } : undefined);
  return NextResponse.json({ experiences });
}

export async function POST(req: NextRequest) {
  const authCtx = await optionalAuth(req);
  let body: z.infer<typeof CreateSchema>;
  try {
    const raw = await req.json();
    body = CreateSchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", detail: String(err) },
      { status: 400 },
    );
  }

  try {
    const result = experienceService.create(body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const authCtx = await optionalAuth(req);
  const { id, ...updates } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const result = experienceService.update(id, updates);
  if (!result) {
    return NextResponse.json({ error: "Experience not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest) {
  const authCtx = await optionalAuth(req);
  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const removed = experienceService.delete(id);
  if (!removed) {
    return NextResponse.json({ error: "Experience not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
