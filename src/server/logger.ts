// 结构化日志 — pino
import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  transport: isDev ? { target: "pino/file", options: { destination: 1 } } : undefined,
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.passwordHash",
      "*.keyHash",
      "*.apiKey",
      "*.token",
    ],
    remove: true,
  },
});

// 子日志器工厂
export function createContextLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

// HTTP 请求日志中间件辅助
export function logRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  extra?: Record<string, unknown>,
) {
  const logData = { method, path, statusCode, durationMs, ...extra };
  if (statusCode >= 500) {
    logger.error(logData, "request failed");
  } else if (statusCode >= 400) {
    logger.warn(logData, "request error");
  } else {
    logger.info(logData, "request completed");
  }
}
