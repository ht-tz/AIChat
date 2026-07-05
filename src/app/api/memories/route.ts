// 记忆管理 API

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { memoryService } from "@/server/memory";
import { optionalAuth } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  sessionId: z.string().optional(),
  kind: z.enum(["short", "long", "episodic"]),
  content: z.string().min(1),
  summary: z.string().optional(),
  topics: z.array(z.string()).optional(),
  importance: z.number().min(0).max(100).optional(),
  source: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const SearchSchema = z.object({
  query: z.string().min(1),
  kind: z.enum(["short", "long", "episodic"]).optional(),
  limit: z.number().min(1).max(50).optional(),
});

export async function GET(req: NextRequest) {
  const authCtx = await optionalAuth(req);
  const searchParams = req.nextUrl.searchParams;
  const kind = searchParams.get("kind") as "short" | "long" | "episodic" | null;
  const status = searchParams.get("status") as "active" | "archived" | "forgotten" | null;

  const memories = memoryService.list({
    ...(kind ? { kind } : {}),
    ...(status ? { status } : {}),
  });

  return NextResponse.json({ memories });
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
    let result;
    switch (body.kind) {
      case "short":
        result = await memoryService.addShortTerm({
          sessionId: body.sessionId,
          content: body.content,
          summary: body.summary,
          topics: body.topics,
          importance: body.importance,
          source: body.source,
          metadata: body.metadata,
        });
        break;
      case "long":
        result = await memoryService.addLongTerm({
          sessionId: body.sessionId,
          content: body.content,
          summary: body.summary,
          topics: body.topics,
          importance: body.importance,
          source: body.source,
          metadata: body.metadata,
        });
        break;
      case "episodic":
        result = await memoryService.addEpisodic({
          sessionId: body.sessionId,
          content: body.content,
          summary: body.summary,
          topics: body.topics,
          importance: body.importance,
          source: body.source,
          metadata: body.metadata,
        });
        break;
    }
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
  const result = await memoryService.update(id, updates);
  if (!result) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest) {
  const authCtx = await optionalAuth(req);
  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const removed = memoryService.delete(id);
  if (!removed) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
