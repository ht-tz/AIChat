import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { files } from "@/server/db/schema";
import { optionalAuth } from "@/server/auth";
import { logger } from "@/server/logger";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const authCtx = await optionalAuth(request);
  try {
    const { id } = params;

    if (!db) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    const [fileRecord] = await db.select().from(files).where(eq(files.id, id)).limit(1);

    if (!fileRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    try {
      const filePath = path.isAbsolute(fileRecord.path)
        ? fileRecord.path
        : path.join(process.cwd(), fileRecord.path);
      const content = await readFile(filePath);

      return new NextResponse(content, {
        headers: {
          "Content-Type": fileRecord.mimeType,
          "Content-Disposition": `inline; filename="${encodeURIComponent(fileRecord.originalName)}"`,
        },
      });
    } catch (fsError) {
      logger.error({ err: fsError }, "[files] read error");
      return NextResponse.json(
        {
          id: fileRecord.id,
          filename: fileRecord.filename,
          originalName: fileRecord.originalName,
          mimeType: fileRecord.mimeType,
          size: fileRecord.size,
          fileType: fileRecord.fileType,
          error: "File content not found on disk",
        },
        { status: 200 },
      );
    }
  } catch (error) {
    logger.error({ err: error }, "[files] error");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get file" },
      { status: 500 },
    );
  }
}
