// get_current_time —— 返回当前时间，支持时区

import { z } from "zod";
import type { Tool } from "../types";

const Params = z.object({
  timezone: z
    .string()
    .optional()
    .describe("IANA 时区，如 'Asia/Shanghai'、'America/Los_Angeles'。省略则使用服务器本地时区。"),
  format: z
    .enum(["iso", "human", "both"])
    .optional()
    .describe("输出格式：iso(机器可读) / human(人类可读) / both(都返回)。默认 both。"),
});

export const getCurrentTimeTool: Tool<typeof Params> = {
  name: "get_current_time",
  description:
    "获取服务器当前时间，支持 IANA 时区（如 'Asia/Shanghai'）。返回 ISO 时间戳与人类可读字符串。",
  parameters: Params,
  execute: async (args) => {
    const now = new Date();
    const timezone = args.timezone;
    let iso: string;
    let human: string;
    try {
      if (timezone) {
        iso = now.toISOString();
        human =
          now.toLocaleString("zh-CN", {
            timeZone: timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }) + ` (${timezone})`;
      } else {
        iso = now.toISOString();
        human =
          now.toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }) + " (服务器本地)";
      }
    } catch (err) {
      throw new Error(`Invalid timezone: ${timezone}`);
    }
    if (args.format === "iso") return { iso };
    if (args.format === "human") return { human };
    return { iso, human };
  },
  toDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: "object",
        properties: {
          timezone: {
            type: "string",
            description: "IANA 时区，如 'Asia/Shanghai'。省略则使用服务器本地时区。",
          },
          format: {
            type: "string",
            enum: ["iso", "human", "both"],
            description: "输出格式：iso / human / both。默认 both。",
          },
        },
        required: [],
      },
    };
  },
};
