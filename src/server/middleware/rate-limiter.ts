// API 限流中间件

import { getCache } from "@/server/redis/adapter";

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60000,
};

export async function checkRateLimit(
  ip: string,
  path: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const cache = getCache();
  const key = `ratelimit:${ip}:${path}`;
  const now = Date.now();
  const windowKey = `${key}:${Math.floor(now / config.windowMs)}`;

  const countStr = await cache.get(windowKey);
  const count = parseInt(countStr || "0", 10) || 0;
  const resetTime = Math.floor(now / config.windowMs) * config.windowMs + config.windowMs;

  const allowed = count < config.maxRequests;
  if (allowed) {
    await cache.set(windowKey, String(count + 1), Math.ceil(config.windowMs / 1000));
  }

  return {
    allowed,
    remaining: Math.max(0, config.maxRequests - count - (allowed ? 1 : 0)),
    resetTime,
  };
}

export async function applyRateLimit(
  ip: string,
  path: string,
  config?: RateLimitConfig,
): Promise<{ allowed: boolean; headers: Record<string, string> }> {
  const result = await checkRateLimit(ip, path, config);

  return {
    allowed: result.allowed,
    headers: {
      "X-RateLimit-Limit": String(config?.maxRequests || DEFAULT_CONFIG.maxRequests),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset": String(Math.ceil(result.resetTime / 1000)),
    },
  };
}
