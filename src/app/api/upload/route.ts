import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { db } from "@/server/db";
import { files } from "@/server/db/schema";
import { optionalAuth } from "@/server/auth";
import { logger } from "@/server/logger";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_TEXT_TYPES = [
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/javascript",
  "text/typescript",
  "text/html",
  "text/css",
];

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];

function getFileType(mimeType: string): "text" | "image" | "other" {
  if (ALLOWED_TEXT_TYPES.includes(mimeType) || mimeType.startsWith("text/")) {
    return "text";
  }
  if (ALLOWED_IMAGE_TYPES.includes(mimeType) || mimeType.startsWith("image/")) {
    return "image";
  }
  return "other";
}

export async function POST(request: NextRequest) {
  const authCtx = await optionalAuth(request);
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const sessionId = formData.get("sessionId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    const fileType = getFileType(file.type);
    if (fileType === "other") {
      return NextResponse.json(
        { error: "Unsupported file type. Only text and image files are allowed." },
        { status: 400 },
      );
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const ext = path.extname(file.name) || "";
    const filename = `${nanoid()}${ext}`;
    const filePath = path.join(uploadDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const url = `/uploads/${filename}`;

    let fileRecordId: string | null = null;
    if (db && sessionId) {
      const [record] = await db
        .insert(files)
        .values({
          sessionId,
          filename,
          originalName: file.name,
          mimeType: file.type,
          fileType,
          size: file.size,
          path: filePath,
        })
        .returning({ id: files.id });
      fileRecordId = record?.id ?? null;
    }

    return NextResponse.json({
      id: fileRecordId ?? nanoid(),
      url,
      filename,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      fileType,
    });
  } catch (error) {
    logger.error({ err: error }, "[upload] error");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}
