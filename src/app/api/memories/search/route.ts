// 记忆搜索 API

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { memoryService } from "@/server/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  query: z.string().min(1),
  kind: z.enum(["short", "long", "episodic"]).optional(),
  limit: z.number().min(1).max(50).default(10),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof BodySchema>;
  try {
    const raw = await req.json();
    body = BodySchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", detail: String(err) },
      { status: 400 },
    );
  }

  try {
    const results = await memoryService.search({
      query: body.query,
      kind: body.kind,
      limit: body.limit,
    });
    return NextResponse.json({ results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
