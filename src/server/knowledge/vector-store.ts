// 向量存储 —— RAG 核心，基于内存的向量索引

import { cosineSimilarity, type Embedding } from "@/server/memory";

export interface VectorEntry {
  id: string;
  embedding: Embedding;
  metadata: Record<string, unknown>;
  documentId: string;
  content: string;
}

export interface SearchResult {
  entry: VectorEntry;
  similarity: number;
}

export class VectorStore {
  private entries: Map<string, VectorEntry> = new Map();

  add(
    id: string,
    embedding: Embedding,
    metadata: Record<string, unknown>,
    documentId: string,
    content: string,
  ): void {
    this.entries.set(id, { id, embedding, metadata, documentId, content });
  }

  get(id: string): VectorEntry | undefined {
    return this.entries.get(id);
  }

  delete(id: string): boolean {
    return this.entries.delete(id);
  }

  search(
    queryEmbedding: Embedding,
    options: { limit?: number; minSimilarity?: number; documentId?: string } = {},
  ): SearchResult[] {
    const limit = options.limit ?? 10;
    const minSimilarity = options.minSimilarity ?? 0.1;

    const results: SearchResult[] = [];

    for (const entry of this.entries.values()) {
      if (options.documentId && entry.documentId !== options.documentId) continue;

      const similarity = cosineSimilarity(queryEmbedding, entry.embedding);
      if (similarity >= minSimilarity) {
        results.push({ entry, similarity });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }

  getByDocument(documentId: string): VectorEntry[] {
    return Array.from(this.entries.values()).filter((e) => e.documentId === documentId);
  }

  count(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}

export const vectorStore = new VectorStore();
