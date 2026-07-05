// 认证服务单元测试

import { describe, it, expect, beforeEach } from "vitest";

// 测试 auth-service 的纯函数逻辑（不依赖数据库）
describe("AuthService 纯函数测试", () => {
  describe("密码哈希", () => {
    it("bcrypt hash/compare 应正确工作", async () => {
      const bcrypt = await import("bcrypt");
      const password = "testPassword123";
      const hash = await bcrypt.hash(password, 10);

      expect(hash).not.toBe(password);
      expect(hash.startsWith("$2b$10$")).toBe(true);

      const valid = await bcrypt.compare(password, hash);
      expect(valid).toBe(true);

      const invalid = await bcrypt.compare("wrongPassword", hash);
      expect(invalid).toBe(false);
    });
  });

  describe("JWT Token 生成与验证", () => {
    it("jsonwebtoken 签发和验证应正确工作", async () => {
      const jwt = await import("jsonwebtoken");
      const payload = { userId: "test-uid", email: "test@test.com", role: "user" as const };
      const secret = "test-secret";
      const token = jwt.sign(payload, secret, { expiresIn: "1h" });

      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");

      const decoded = jwt.verify(token, secret) as typeof payload;
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it("无效 token 应抛出错误", async () => {
      const jwt = await import("jsonwebtoken");
      expect(() => jwt.verify("invalid.token.here", "secret")).toThrow();
    });
  });
});
