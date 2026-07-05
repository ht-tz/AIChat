import { describe, it, expect } from "vitest";
import { validateText, validateJSON, validateURL, validateEmail } from "./input-validator";

describe("Input Validator", () => {
  describe("validateText", () => {
    it("空输入应返回无效", () => {
      const result = validateText("");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("输入不能为空");
    });

    it("纯空格输入应返回无效", () => {
      const result = validateText("   ");
      expect(result.valid).toBe(false);
    });

    it("正常文本应返回有效", () => {
      const result = validateText("Hello World");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitized).toBe("Hello World");
    });

    it("超长输入应截断并报错", () => {
      const longText = "a".repeat(200000);
      const result = validateText(longText);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("输入内容过长（最大 100000 字符）");
      expect(result.sanitized.length).toBe(100000);
    });

    it("script 标签应被检测并移除", () => {
      const input = 'Hello <script>alert("xss")</script> World';
      const result = validateText(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("检测到潜在危险内容");
      expect(result.sanitized).not.toContain("<script>");
    });

    it("javascript: 协议应被检测", () => {
      const input = 'Click javascript:alert("xss")';
      const result = validateText(input);
      expect(result.valid).toBe(false);
    });

    it("iframe 标签应被检测", () => {
      const input = "Hello <iframe src='evil.com'></iframe>";
      const result = validateText(input);
      expect(result.valid).toBe(false);
    });

    it("svg 标签应被检测", () => {
      const input = "Hello <svg onload='alert(1)'></svg>";
      const result = validateText(input);
      expect(result.valid).toBe(false);
    });

    it("事件处理器属性应被检测", () => {
      const input = '<img onerror="alert(1)" src="x">';
      const result = validateText(input);
      expect(result.valid).toBe(false);
    });
  });

  describe("validateJSON", () => {
    it("空输入应返回无效", () => {
      const result = validateJSON("");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("JSON 不能为空");
    });

    it("有效 JSON 应返回有效", () => {
      const result = validateJSON('{"name": "test", "value": 123}');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toContain('"name"');
    });

    it("无效 JSON 应返回无效", () => {
      const result = validateJSON("{invalid json}");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("无效的 JSON 格式");
    });

    it("数组 JSON 应返回有效", () => {
      const result = validateJSON("[1, 2, 3]");
      expect(result.valid).toBe(true);
    });

    it("超长 JSON 应截断", () => {
      const longArray = JSON.stringify(Array(100000).fill("x"));
      const result = validateJSON(longArray);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("JSON 内容过长（最大 100000 字符）");
    });
  });

  describe("validateURL", () => {
    it("有效 HTTP URL 应返回有效", () => {
      const result = validateURL("http://example.com");
      expect(result.valid).toBe(true);
    });

    it("有效 HTTPS URL 应返回有效", () => {
      const result = validateURL("https://example.com/path?query=1");
      expect(result.valid).toBe(true);
    });

    it("localhost 应被拒绝", () => {
      const result = validateURL("http://localhost:3000");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("不允许访问本地地址");
    });

    it("127.0.0.1 应被拒绝", () => {
      const result = validateURL("http://127.0.0.1:8080");
      expect(result.valid).toBe(false);
    });

    it("非 http/https 协议应被拒绝", () => {
      const result = validateURL("ftp://example.com");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("URL 必须使用 http 或 https 协议");
    });

    it("无效 URL 格式应被拒绝", () => {
      const result = validateURL("not-a-url");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("无效的 URL 格式");
    });

    it("file:// 协议应被拒绝", () => {
      const result = validateURL("file:///etc/passwd");
      expect(result.valid).toBe(false);
    });
  });

  describe("validateEmail", () => {
    it("有效邮箱应返回有效", () => {
      const result = validateEmail("user@example.com");
      expect(result.valid).toBe(true);
    });

    it("带子域名的邮箱应返回有效", () => {
      const result = validateEmail("user@mail.example.com");
      expect(result.valid).toBe(true);
    });

    it("无 @ 符号应返回无效", () => {
      const result = validateEmail("userexample.com");
      expect(result.valid).toBe(false);
    });

    it("无域名应返回无效", () => {
      const result = validateEmail("user@");
      expect(result.valid).toBe(false);
    });

    it("无用户名应返回无效", () => {
      const result = validateEmail("@example.com");
      expect(result.valid).toBe(false);
    });

    it("中文邮箱当前实现允许通过（正则不限制字符集）", () => {
      const result = validateEmail("用户@example.com");
      expect(result.valid).toBe(true);
    });
  });
});
