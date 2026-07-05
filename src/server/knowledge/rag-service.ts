// RAG 服务 —— 检索增强生成

import { getProvider } from "@/server/providers";
import { documentService } from "./document-service";
import { vectorStore } from "./vector-store";

export interface RAGResult {
  context: string;
  sources: Array<{ documentId: string; title: string; similarity: number; snippet: string }>;
  query: string;
}

export class RAGService {
  async retrieve(
    query: string,
    options: { limit?: number; minSimilarity?: number } = {},
  ): Promise<RAGResult> {
    const queryEmbedding = await getProvider().embed(query);
    const limit = options.limit ?? 5;
    const minSimilarity = options.minSimilarity ?? 0.15;

    const results = vectorStore.search(queryEmbedding, { limit, minSimilarity });

    const sources = results.map((r) => {
      const doc = documentService.getDocument(r.entry.documentId);
      return {
        documentId: r.entry.documentId,
        title: doc?.title || "Unknown",
        similarity: Math.round(r.similarity * 100),
        snippet: r.entry.content.slice(0, 150) + "...",
      };
    });

    const context = results.map((r) => r.entry.content).join("\n\n---\n\n");

    return { context, sources, query };
  }

  async generateWithContext(
    query: string,
    options?: { limit?: number; minSimilarity?: number },
  ): Promise<{ answer: string; sources: RAGResult["sources"] }> {
    const rag = await this.retrieve(query, options);

    if (!rag.context) {
      const result = await getProvider().complete({
        messages: [{ role: "user", content: query }],
      });
      return { answer: result.content, sources: [] };
    }

    const prompt = `基于以下知识库内容回答用户问题。如果知识库中没有相关信息，请直接回答，不要编造。

知识库内容：
${rag.context}

用户问题：${query}

请给出详细的回答，并在最后列出参考的知识库来源。`;

    const result = await getProvider().complete({
      messages: [{ role: "user", content: prompt }],
    });

    return { answer: result.content, sources: rag.sources };
  }

  async addDocumentToStore(docId: string): Promise<void> {
    const doc = documentService.getDocument(docId);
    if (!doc) return;

    for (const chunk of doc.chunks) {
      vectorStore.add(
        chunk.id,
        chunk.embedding,
        {
          documentId: doc.id,
          title: doc.title,
          type: doc.type,
          chunkIndex: chunk.index,
        },
        doc.id,
        chunk.content,
      );
    }
  }

  removeDocumentFromStore(docId: string): void {
    const entries = vectorStore.getByDocument(docId);
    entries.forEach((entry) => vectorStore.delete(entry.id));
  }

  getStats(): { documentCount: number; chunkCount: number } {
    return {
      documentCount: documentService.listDocuments().length,
      chunkCount: vectorStore.count(),
    };
  }
}

export const ragService = new RAGService();
