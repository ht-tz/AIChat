// 数据库连接 —— 仅在 server side 引用
// 用 postgres-js 作为 driver；drizzle-orm/pg/core 作为 ORM 层

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { logger } from "@/server/logger";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  // 不在 import 时崩溃；调用方拿到 null 自处理
  // 这样开发期不需要 DB 也能跑
  logger.warn("[db] DATABASE_URL not set, database features disabled");
}

/** 全局单例 client（避免 dev hot reload 多连接） */
declare global {
  // eslint-disable-next-line no-var
  var __pg: ReturnType<typeof postgres> | undefined;
}

const client = DATABASE_URL
  ? (global.__pg ??
    (global.__pg = postgres(DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    })))
  : (null as unknown as ReturnType<typeof postgres>);

export const db = client ? drizzle(client, { schema }) : null;

export { schema };
export * from "./schema";
