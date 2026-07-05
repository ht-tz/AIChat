// 向量相似度计算工具

export type Embedding = number[];

export function cosineSimilarity(a: Embedding, b: Embedding): number {
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dotProduct += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function euclideanDistance(a: Embedding, b: Embedding): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    sum += Math.pow(a[i] - b[i], 2);
  }
  return Math.sqrt(sum);
}

export function normalizeVector(v: Embedding): Embedding {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  if (norm === 0) return v;
  return v.map((x) => x / norm);
}

export function parseEmbedding(str: string): Embedding {
  try {
    return JSON.parse(str);
  } catch {
    return [];
  }
}

export function stringifyEmbedding(v: Embedding): string {
  return JSON.stringify(v);
}
