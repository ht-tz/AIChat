import { describe, it, expect } from "vitest";
import { cosineSimilarity, parseEmbedding, stringifyEmbedding } from "@/server/memory/vector-utils";

describe("vector-utils", () => {
  it("cosine similarity of identical vectors is 1", () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("cosine similarity of orthogonal vectors is 0", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it("cosine similarity of opposite vectors is -1", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
  });

  it("parseEmbedding and stringifyEmbedding roundtrip", () => {
    const original = [0.1, 0.2, 0.3, -0.4];
    const str = stringifyEmbedding(original);
    const parsed = parseEmbedding(str);
    expect(parsed).toHaveLength(4);
    parsed.forEach((v, i) => expect(v).toBeCloseTo(original[i], 5));
  });
});
