// 工具函数单元测试

import { describe, it, expect } from "vitest";

// 测试 rate-limiter 的核心逻辑
describe("RateLimiter 逻辑", () => {
  it("滑动窗口应正确限制请求", () => {
    // 模拟滑动窗口限流逻辑
    const windowMs = 60_000;
    const maxRequests = 5;
    const requests: number[] = [];

    function allowRequest(now: number): boolean {
      // 清理过期请求
      while (requests.length > 0 && requests[0] < now - windowMs) {
        requests.shift();
      }
      if (requests.length >= maxRequests) {
        return false;
      }
      requests.push(now);
      return true;
    }

    const now = Date.now();
    // 前 5 个请求应通过
    for (let i = 0; i < 5; i++) {
      expect(allowRequest(now + i)).toBe(true);
    }
    // 第 6 个应被拒绝
    expect(allowRequest(now + 5)).toBe(false);

    // 窗口过后应恢复
    expect(allowRequest(now + windowMs + 1)).toBe(true);
  });
});

// 测试 input-validator 的核心逻辑
describe("InputValidator 逻辑", () => {
  const XSS_PATTERNS = [
    /<script[^>]*>/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe[^>]*>/i,
    /<svg[^>]*on/i,
  ];

  function isXSS(input: string): boolean {
    return XSS_PATTERNS.some((pattern) => pattern.test(input));
  }

  it("应检测 script 标签", () => {
    expect(isXSS("<script>alert(1)</script>")).toBe(true);
    expect(isXSS("<SCRIPT>alert(1)</SCRIPT>")).toBe(true);
  });

  it("应检测 javascript: 协议", () => {
    expect(isXSS("javascript:alert(1)")).toBe(true);
    expect(isXSS("JAVASCRIPT:alert(1)")).toBe(true);
  });

  it("应检测事件处理器", () => {
    expect(isXSS("<img onerror=alert(1)>")).toBe(true);
    expect(isXSS("<div onclick=alert(1)>")).toBe(true);
  });

  it("应检测 iframe 注入", () => {
    expect(isXSS("<iframe src=evil.com>")).toBe(true);
  });

  it("正常输入不应被标记", () => {
    expect(isXSS("Hello World")).toBe(false);
    expect(isXSS("这是一段普通文本")).toBe(false);
    expect(isXSS("<p>正常的 HTML 段落</p>")).toBe(false);
  });
});
