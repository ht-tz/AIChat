import { describe, it, expect } from "vitest";
import {
  cosineSimilarity,
  euclideanDistance,
  normalizeVector,
  parseEmbedding,
  stringifyEmbedding,
} from "./vector-utils";

describe("Vector Utils", () => {
  describe("cosineSimilarity", () => {
    it("相同向量应返回 1", () => {
      const a = [1, 0, 0];
      expect(cosineSimilarity(a, a)).toBe(1);
    });

    it("正交向量应返回 0", () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      expect(cosineSimilarity(a, b)).toBe(0);
    });

    it("相反向量应返回 -1", () => {
      const a = [1, 0, 0];
      const b = [-1, 0, 0];
      expect(cosineSimilarity(a, b)).toBe(-1);
    });

    it("零向量应返回 0", () => {
      const a = [0, 0, 0];
      const b = [1, 2, 3];
      expect(cosineSimilarity(a, b)).toBe(0);
    });

    it("两个零向量应返回 0", () => {
      expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
    });

    it("不同长度向量应取最小长度计算", () => {
      const a = [1, 0, 0, 0];
      const b = [0, 1];
      expect(cosineSimilarity(a, b)).toBe(0);
    });

    it("相似向量应返回接近 1 的值", () => {
      const a = [1, 1, 0];
      const b = [1, 1, 0.1];
      const result = cosineSimilarity(a, b);
      expect(result).toBeGreaterThan(0.95);
    });
  });

  describe("euclideanDistance", () => {
    it("相同向量应返回 0", () => {
      const a = [1, 2, 3];
      expect(euclideanDistance(a, a)).toBe(0);
    });

    it("应正确计算距离", () => {
      const a = [0, 0];
      const b = [3, 4];
      expect(euclideanDistance(a, b)).toBe(5);
    });

    it("单点距离应为差的绝对值", () => {
      expect(euclideanDistance([1], [4])).toBe(3);
    });

    it("不同长度向量应取最小长度", () => {
      const a = [1, 2, 3, 4];
      const b = [1, 2];
      expect(euclideanDistance(a, b)).toBe(0);
    });

    it("负数坐标应正常工作", () => {
      const a = [-1, -1];
      const b = [2, 3];
      expect(euclideanDistance(a, b)).toBe(5);
    });
  });

  describe("normalizeVector", () => {
    it("单位向量应保持不变", () => {
      const v = [1, 0, 0];
      expect(normalizeVector(v)).toEqual([1, 0, 0]);
    });

    it("归一化后模长应为 1", () => {
      const v = [3, 4];
      const result = normalizeVector(v);
      const norm = Math.sqrt(result[0] ** 2 + result[1] ** 2);
      expect(norm).toBeCloseTo(1, 10);
    });

    it("零向量应原样返回", () => {
      expect(normalizeVector([0, 0, 0])).toEqual([0, 0, 0]);
    });

    it("负数向量应正常归一化", () => {
      const v = [-3, -4];
      const result = normalizeVector(v);
      expect(result[0]).toBeCloseTo(-0.6, 10);
      expect(result[1]).toBeCloseTo(-0.8, 10);
    });
  });

  describe("parseEmbedding", () => {
    it("有效 JSON 数组应解析成功", () => {
      const result = parseEmbedding("[1, 2, 3]");
      expect(result).toEqual([1, 2, 3]);
    });

    it("无效 JSON 应返回空数组", () => {
      const result = parseEmbedding("not json");
      expect(result).toEqual([]);
    });

    it("空字符串应返回空数组", () => {
      const result = parseEmbedding("");
      expect(result).toEqual([]);
    });

    it("JSON 对象应返回对象（parseEmbedding 不校验类型）", () => {
      const result = parseEmbedding('{"a": 1}');
      expect(result).toEqual({ a: 1 });
    });
  });

  describe("stringifyEmbedding", () => {
    it("应序列化为 JSON 字符串", () => {
      const result = stringifyEmbedding([1, 2, 3]);
      expect(result).toBe("[1,2,3]");
    });

    it("空数组应序列化为 []", () => {
      expect(stringifyEmbedding([])).toBe("[]");
    });

    it("浮点数应保持精度", () => {
      const result = stringifyEmbedding([0.123456789]);
      expect(result).toBe("[0.123456789]");
    });

    it("round-trip 应保持一致", () => {
      const original = [1.5, 2.7, 3.14];
      const parsed = parseEmbedding(stringifyEmbedding(original));
      expect(parsed).toEqual(original);
    });
  });
});
