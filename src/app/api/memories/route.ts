// 记忆管理 API

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { memoryService } from "@/server/memory";
import { requireAuth } from "@/server/auth/auth-middleware";

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

export const GET = requireAuth(async (req, ctx) => {
  const searchParams = req.nextUrl.searchParams;
  const kind = searchParams.get("kind") as "short" | "long" | "episodic" | null;
  const status = searchParams.get("status") as "active" | "archived" | "forgotten" | null;

  const memories = memoryService.list({
    ...(kind ? { kind } : {}),
    ...(status ? { status } : {}),
  });

  return NextResponse.json({ memories });
});

export const POST = requireAuth(async (req, ctx) => {
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
});

const UpdateSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1).optional(),
  summary: z.string().optional(),
  topics: z.array(z.string()).optional(),
  importance: z.number().min(0).max(100).optional(),
  status: z.enum(["active", "archived", "forgotten"]).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const PUT = requireAuth(async (req, ctx) => {
  let body: z.infer<typeof UpdateSchema>;
  try {
    const raw = await req.json();
    body = UpdateSchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", detail: String(err) },
      { status: 400 },
    );
  }
  const { id, ...updates } = body;
  const result = await memoryService.update(id, updates);
  if (!result) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404 });
  }
  return NextResponse.json(result);
});

const DeleteSchema = z.object({
  id: z.string().min(1),
});

export const DELETE = requireAuth(async (req, ctx) => {
  let body: z.infer<typeof DeleteSchema>;
  try {
    const raw = await req.json();
    body = DeleteSchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", detail: String(err) },
      { status: 400 },
    );
  }
  const removed = memoryService.delete(body.id);
  if (!removed) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
});
