import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkRateLimit, applyRateLimit } from "./rate-limiter";

// Mock getCache
vi.mock("@/server/redis/adapter", () => ({
  getCache: () => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe("Rate Limiter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkRateLimit", () => {
    it("首次请求应允许通过", async () => {
      const result = await checkRateLimit("127.0.0.1", "/api/test");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
      expect(result.resetTime).toBeGreaterThan(0);
    });

    it("应返回正确的 remaining 数量", async () => {
      const result = await checkRateLimit("127.0.0.1", "/api/test", {
        maxRequests: 10,
        windowMs: 60000,
      });
      expect(result.remaining).toBeLessThanOrEqual(10);
    });

    it("应使用自定义配置", async () => {
      const config = { maxRequests: 5, windowMs: 30000 };
      const result = await checkRateLimit("192.168.1.1", "/api/custom", config);
      expect(result.allowed).toBe(true);
    });

    it("不同 IP 应该独立计数", async () => {
      const result1 = await checkRateLimit("10.0.0.1", "/api/test");
      const result2 = await checkRateLimit("10.0.0.2", "/api/test");
      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });
  });

  describe("applyRateLimit", () => {
    it("应返回 allowed 和 headers", async () => {
      const result = await applyRateLimit("127.0.0.1", "/api/test");
      expect(result).toHaveProperty("allowed");
      expect(result).toHaveProperty("headers");
    });

    it("headers 应包含限流信息", async () => {
      const result = await applyRateLimit("127.0.0.1", "/api/test");
      expect(result.headers).toHaveProperty("X-RateLimit-Limit");
      expect(result.headers).toHaveProperty("X-RateLimit-Remaining");
      expect(result.headers).toHaveProperty("X-RateLimit-Reset");
    });

    it("应使用默认配置", async () => {
      const result = await applyRateLimit("127.0.0.1", "/api/test");
      expect(result.headers["X-RateLimit-Limit"]).toBe("60");
    });

    it("应使用自定义配置", async () => {
      const config = { maxRequests: 100, windowMs: 120000 };
      const result = await applyRateLimit("127.0.0.1", "/api/test", config);
      expect(result.headers["X-RateLimit-Limit"]).toBe("100");
    });
  });
});
