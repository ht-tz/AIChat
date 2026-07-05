// 记忆注入 API

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { injectMemories, extractAndSaveMemory, getMemoryInjectionStatus } from "@/server/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const InjectSchema = z.object({
  query: z.string().min(1),
  maxMemories: z.number().min(1).max(20).default(5),
  minSimilarity: z.number().min(0).max(1).default(0.15),
  includeShortTerm: z.boolean().default(true),
  includeLongTerm: z.boolean().default(true),
  includeEpisodic: z.boolean().default(true),
});

const ExtractSchema = z.object({
  sessionId: z.string(),
  conversation: z.array(z.object({ role: z.string(), content: z.string() })),
});

export async function GET() {
  const status = await getMemoryInjectionStatus();
  return NextResponse.json(status);
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();

    if (raw.action === "inject") {
      const body = InjectSchema.parse(raw);
      const result = await injectMemories(body.query, {
        maxMemories: body.maxMemories,
        minSimilarity: body.minSimilarity,
        includeShortTerm: body.includeShortTerm,
        includeLongTerm: body.includeLongTerm,
        includeEpisodic: body.includeEpisodic,
      });
      return NextResponse.json(result);
    }

    if (raw.action === "extract") {
      const body = ExtractSchema.parse(raw);
      const saved = await extractAndSaveMemory(body.sessionId, body.conversation);
      return NextResponse.json({ savedCount: saved.length, memories: saved });
    }

    return NextResponse.json(
      { error: 'Invalid action, must be "inject" or "extract"' },
      { status: 400 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", detail: String(err) },
      { status: 400 },
    );
  }
}
