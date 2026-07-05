// generate_image —— Mock 图片生成工具
// 返回一个赛博风格的 SVG 占位图片 data URL

import { z } from "zod";
import type { Tool } from "../types";
import { db } from "@/server/db";
import { images } from "@/server/db/schema";

const Params = z.object({
  prompt: z.string().min(1).describe("图片生成提示词"),
  size: z.enum(["1024x1024", "512x512"]).optional().default("512x512").describe("图片尺寸"),
});

function generateCyberSvg(prompt: string, size: string): string {
  const [w, h] = size.split("x").map(Number);
  const displayPrompt = prompt.slice(0, 50);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a"/>
      <stop offset="50%" style="stop-color:#1e1b4b"/>
      <stop offset="100%" style="stop-color:#0f172a"/>
    </linearGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#06b6d4"/>
      <stop offset="100%" style="stop-color:#a855f7"/>
    </linearGradient>
    <filter id="neon">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <g opacity="0.15" stroke="url(#glow)" stroke-width="1">
    ${Array.from({ length: 12 }, (_, i) => {
      const y = (i / 12) * h;
      return `<line x1="0" y1="${y}" x2="${w}" y2="${y}"/>`;
    }).join("\n    ")}
    ${Array.from({ length: 12 }, (_, i) => {
      const x = (i / 12) * w;
      return `<line x1="${x}" y1="0" x2="${x}" y2="${h}"/>`;
    }).join("\n    ")}
  </g>
  <circle cx="${w / 2}" cy="${h / 2 - 30}" r="${Math.min(w, h) / 4}" fill="none" stroke="url(#glow)" stroke-width="3" filter="url(#neon)"/>
  <circle cx="${w / 2}" cy="${h / 2 - 30}" r="${Math.min(w, h) / 6}" fill="url(#glow)" opacity="0.3"/>
  <text x="${w / 2}" y="${h / 2 + 40}" text-anchor="middle" fill="#06b6d4" font-family="monospace" font-size="${Math.max(12, w / 30)}" font-weight="bold" filter="url(#neon)">
    AI GENERATED
  </text>
  <text x="${w / 2}" y="${h / 2 + 70}" text-anchor="middle" fill="#94a3b8" font-family="system-ui" font-size="${Math.max(10, w / 40)}">
    ${displayPrompt}
  </text>
  <text x="${w / 2}" y="${h - 30}" text-anchor="middle" fill="#64748b" font-family="monospace" font-size="${Math.max(8, w / 50)}">
    [M4 Mock] Cyberpunk Placeholder
  </text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export const generateImageTool: Tool<typeof Params> = {
  name: "generate_image",
  description: "根据文字提示生成图片。当用户要求画图、生成图片、生成图像时使用此工具。",
  parameters: Params,
  execute: async (args, ctx) => {
    const startTime = Date.now();
    const imageUrl = generateCyberSvg(args.prompt, args.size);
    const durationMs = Date.now() - startTime;

    if (db && ctx.sessionId) {
      try {
        await db.insert(images).values({
          sessionId: ctx.sessionId,
          runId: ctx.runId,
          prompt: args.prompt,
          model: "mock-image-gen",
          status: "success",
          url: imageUrl,
          durationMs,
        });
      } catch (err) {
        console.warn("[generate_image] failed to persist:", err);
      }
    }

    return {
      prompt: args.prompt,
      url: imageUrl,
      size: args.size,
      status: "success",
    };
  },
  toDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "图片生成提示词" },
          size: {
            type: "string",
            enum: ["1024x1024", "512x512"],
            description: "图片尺寸",
          },
        },
        required: ["prompt"],
      },
    };
  },
};
