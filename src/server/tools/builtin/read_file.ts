// read_file —— 读取已上传文件的内容
// 文本文件返回内容，图片文件返回URL

import { z } from "zod";
import { readFile } from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";
import type { Tool } from "../types";
import { db } from "@/server/db";
import { files } from "@/server/db/schema";

const Params = z.object({
  fileId: z.string().min(1).describe("要读取的文件ID"),
});

export const readFileTool: Tool<typeof Params> = {
  name: "read_file",
  description:
    "读取用户上传的文件内容。对于文本文件，返回文件文本内容；对于图片文件，返回访问URL。",
  parameters: Params,
  execute: async (args) => {
    if (!db) {
      throw new Error("Database not available");
    }

    const [fileRecord] = await db.select().from(files).where(eq(files.id, args.fileId)).limit(1);

    if (!fileRecord) {
      throw new Error(`File not found: ${args.fileId}`);
    }

    const url = `/uploads/${fileRecord.filename}`;

    if (fileRecord.fileType === "image") {
      return {
        filename: fileRecord.originalName,
        url,
        size: fileRecord.size,
        message: "图片文件，请直接查看",
      };
    }

    try {
      const filePath = path.isAbsolute(fileRecord.path)
        ? fileRecord.path
        : path.join(process.cwd(), fileRecord.path);
      const content = await readFile(filePath, "utf-8");
      return {
        filename: fileRecord.originalName,
        content,
        size: fileRecord.size,
      };
    } catch (err) {
      throw new Error(`Failed to read file: ${(err as Error).message}`);
    }
  },
  toDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "要读取的文件ID" },
        },
        required: ["fileId"],
      },
    };
  },
};
