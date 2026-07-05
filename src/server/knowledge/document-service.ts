// 文档服务 —— 文档解析、切分、向量化

import { getProvider } from "@/server/providers";
import { parseEmbedding, stringifyEmbedding, cosineSimilarity } from "@/server/memory";

export type DocumentType = "text" | "markdown" | "url" | "database";

export interface DocumentChunk {
  id: string;
  documentId: string;
  index: number;
  content: string;
  embedding: number[];
  tokenCount: number;
  createdAt: number;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  type: DocumentType;
  source: string;
  content: string;
  chunks: DocumentChunk[];
  totalChunks: number;
  createdAt: number;
  updatedAt: number;
}

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100;

function generateId(): string {
  return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  const len = text.length;

  while (start < len) {
    let end = Math.min(start + CHUNK_SIZE, len);

    if (end < len) {
      const lastPeriod = text.lastIndexOf(".", end);
      const lastNewline = text.lastIndexOf("\n", end);
      const lastSpace = text.lastIndexOf(" ", end);

      const bestSplit = Math.max(lastPeriod, lastNewline, lastSpace);
      if (bestSplit > start + CHUNK_SIZE / 2) {
        end = bestSplit + 1;
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = end - CHUNK_OVERLAP;
    if (start < 0) start = 0;
  }

  return chunks.filter((c) => c.length > 50);
}

export class DocumentService {
  private documents: Map<string, KnowledgeDocument> = new Map();
  private chunks: Map<string, DocumentChunk> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem("nexus-documents");
      if (data) {
        const parsed = JSON.parse(data) as KnowledgeDocument[];
        parsed.forEach((doc) => {
          this.documents.set(doc.id, doc);
          doc.chunks.forEach((chunk) => this.chunks.set(chunk.id, chunk));
        });
      }
    } catch {}
  }

  private saveToStorage(): void {
    try {
      const data = JSON.stringify(Array.from(this.documents.values()));
      localStorage.setItem("nexus-documents", data);
    } catch {}
  }

  private async embed(text: string): Promise<number[]> {
    return getProvider().embed(text);
  }

  async createDocument(
    title: string,
    type: DocumentType,
    source: string,
    content: string,
  ): Promise<KnowledgeDocument> {
    const now = Date.now();
    const docId = generateId();

    const chunkTexts = chunkText(content);
    const chunks: DocumentChunk[] = [];

    for (let i = 0; i < chunkTexts.length; i++) {
      const embedding = await this.embed(chunkTexts[i]);
      chunks.push({
        id: `${docId}-chunk-${i}`,
        documentId: docId,
        index: i,
        content: chunkTexts[i],
        embedding,
        tokenCount: Math.floor(chunkTexts[i].length / 4),
        createdAt: now,
      });
    }

    const doc: KnowledgeDocument = {
      id: docId,
      title,
      type,
      source,
      content: content.slice(0, 1000) + (content.length > 1000 ? "..." : ""),
      chunks,
      totalChunks: chunks.length,
      createdAt: now,
      updatedAt: now,
    };

    this.documents.set(docId, doc);
    chunks.forEach((chunk) => this.chunks.set(chunk.id, chunk));
    this.saveToStorage();

    return doc;
  }

  getDocument(id: string): KnowledgeDocument | undefined {
    return this.documents.get(id);
  }

  listDocuments(): KnowledgeDocument[] {
    return Array.from(this.documents.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  deleteDocument(id: string): boolean {
    const doc = this.documents.get(id);
    if (!doc) return false;

    doc.chunks.forEach((chunk) => this.chunks.delete(chunk.id));
    this.documents.delete(id);
    this.saveToStorage();
    return true;
  }

  async searchDocuments(
    query: string,
    limit: number = 5,
  ): Promise<Array<{ document: KnowledgeDocument; similarity: number }>> {
    const queryEmbedding = await getProvider().embed(query);
    const results: Array<{ document: KnowledgeDocument; similarity: number }> = [];

    for (const doc of this.documents.values()) {
      let maxSim = 0;
      for (const chunk of doc.chunks) {
        const sim = cosineSimilarity(queryEmbedding, chunk.embedding);
        if (sim > maxSim) maxSim = sim;
      }
      if (maxSim > 0.1) {
        results.push({ document: doc, similarity: maxSim });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }

  getDocumentChunks(docId: string): DocumentChunk[] {
    const doc = this.documents.get(docId);
    return doc?.chunks || [];
  }

  async updateDocument(
    id: string,
    updates: Partial<Pick<KnowledgeDocument, "title" | "content">>,
  ): Promise<KnowledgeDocument | undefined> {
    const doc = this.documents.get(id);
    if (!doc) return undefined;

    const now = Date.now();
    if (updates.title) doc.title = updates.title;
    if (updates.content) {
      doc.chunks.forEach((chunk) => this.chunks.delete(chunk.id));
      const chunkTexts = chunkText(updates.content);
      const newChunks: DocumentChunk[] = [];

      for (let i = 0; i < chunkTexts.length; i++) {
        const embedding = await this.embed(chunkTexts[i]);
        newChunks.push({
          id: `${id}-chunk-${i}`,
          documentId: id,
          index: i,
          content: chunkTexts[i],
          embedding,
          tokenCount: Math.floor(chunkTexts[i].length / 4),
          createdAt: now,
        });
      }

      doc.chunks = newChunks;
      doc.totalChunks = newChunks.length;
      doc.content = updates.content.slice(0, 1000) + (updates.content.length > 1000 ? "..." : "");
      newChunks.forEach((chunk) => this.chunks.set(chunk.id, chunk));
    }

    doc.updatedAt = now;
    this.saveToStorage();
    return doc;
  }
}

export const documentService = new DocumentService();
