// 记忆服务 —— 短期记忆、长期记忆、检索

import { getProvider } from "@/server/providers";
import {
  cosineSimilarity,
  parseEmbedding,
  stringifyEmbedding,
  type Embedding,
} from "./vector-utils";

export type MemoryKind = "short" | "long" | "episodic";
export type MemoryStatus = "active" | "archived" | "forgotten";

export interface MemoryEntry {
  id: string;
  sessionId?: string;
  kind: MemoryKind;
  content: string;
  summary: string;
  topics: string[];
  importance: number;
  embedding: Embedding;
  source: string;
  metadata: Record<string, unknown>;
  status: MemoryStatus;
  referencedCount: number;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
}

export interface CreateMemoryInput {
  sessionId?: string;
  kind: MemoryKind;
  content: string;
  summary?: string;
  topics?: string[];
  importance?: number;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchMemoryInput {
  query: string;
  kind?: MemoryKind;
  limit?: number;
  minSimilarity?: number;
}

export interface SearchResult {
  memory: MemoryEntry;
  similarity: number;
}

const MEMORY_LIMIT = 1000;

export class MemoryService {
  private memories: Map<string, MemoryEntry> = new Map();
  private shortTermMemory: string[] = [];

  async init(): Promise<void> {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem("nexus-memories");
      if (data) {
        const parsed = JSON.parse(data) as MemoryEntry[];
        parsed.forEach((m) => this.memories.set(m.id, m));
      }
    } catch {}
    try {
      const stm = localStorage.getItem("nexus-short-term");
      if (stm) {
        this.shortTermMemory = JSON.parse(stm);
      }
    } catch {}
  }

  private saveToStorage(): void {
    try {
      const data = JSON.stringify(Array.from(this.memories.values()));
      localStorage.setItem("nexus-memories", data);
    } catch {}
    try {
      localStorage.setItem("nexus-short-term", JSON.stringify(this.shortTermMemory));
    } catch {}
  }

  private async embed(text: string): Promise<Embedding> {
    return getProvider().embed(text);
  }

  private async createEntry(input: CreateMemoryInput): Promise<MemoryEntry> {
    const now = Date.now();
    const embedding = await this.embed(input.content);
    const entry: MemoryEntry = {
      id: `mem-${now}-${Math.random().toString(36).slice(2, 8)}`,
      sessionId: input.sessionId,
      kind: input.kind,
      content: input.content,
      summary: input.summary || input.content.slice(0, 100),
      topics: input.topics || [],
      importance: input.importance ?? 50,
      embedding,
      source: input.source || "conversation",
      metadata: input.metadata || {},
      status: "active",
      referencedCount: 0,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
    };

    if (this.memories.size >= MEMORY_LIMIT) {
      const oldest = Array.from(this.memories.values()).sort(
        (a, b) => a.lastAccessedAt - b.lastAccessedAt,
      )[0];
      if (oldest) {
        this.memories.delete(oldest.id);
      }
    }

    this.memories.set(entry.id, entry);
    this.saveToStorage();
    return entry;
  }

  async addShortTerm(input: Omit<CreateMemoryInput, "kind">): Promise<MemoryEntry> {
    const entry = await this.createEntry({ ...input, kind: "short" });
    this.shortTermMemory.push(entry.id);
    if (this.shortTermMemory.length > 50) {
      this.shortTermMemory = this.shortTermMemory.slice(-50);
    }
    this.saveToStorage();
    return entry;
  }

  async addLongTerm(input: Omit<CreateMemoryInput, "kind">): Promise<MemoryEntry> {
    return this.createEntry({ ...input, kind: "long" });
  }

  async addEpisodic(input: Omit<CreateMemoryInput, "kind">): Promise<MemoryEntry> {
    return this.createEntry({ ...input, kind: "episodic" });
  }

  get(id: string): MemoryEntry | undefined {
    const entry = this.memories.get(id);
    if (entry) {
      entry.lastAccessedAt = Date.now();
      entry.referencedCount++;
      this.saveToStorage();
    }
    return entry;
  }

  async update(
    id: string,
    updates: Partial<
      Pick<MemoryEntry, "content" | "summary" | "topics" | "importance" | "status" | "metadata">
    >,
  ): Promise<MemoryEntry | undefined> {
    const entry = this.memories.get(id);
    if (!entry) return undefined;
    const now = Date.now();
    if (updates.content) {
      entry.content = updates.content;
      entry.embedding = await getProvider().embed(updates.content);
    }
    if (updates.summary) entry.summary = updates.summary;
    if (updates.topics) entry.topics = updates.topics;
    if (updates.importance !== undefined) entry.importance = updates.importance;
    if (updates.status) entry.status = updates.status;
    if (updates.metadata) entry.metadata = updates.metadata;
    entry.updatedAt = now;
    this.saveToStorage();
    return entry;
  }

  delete(id: string): boolean {
    const removed = this.memories.delete(id);
    if (removed) {
      this.shortTermMemory = this.shortTermMemory.filter((mid) => mid !== id);
      this.saveToStorage();
    }
    return removed;
  }

  list(options?: { kind?: MemoryKind; status?: MemoryStatus }): MemoryEntry[] {
    return Array.from(this.memories.values())
      .filter((m) => {
        if (options?.kind && m.kind !== options.kind) return false;
        if (options?.status && m.status !== options.status) return false;
        return true;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async search(input: SearchMemoryInput): Promise<SearchResult[]> {
    const queryEmbedding = await this.embed(input.query);
    const limit = input.limit ?? 10;
    const minSimilarity = input.minSimilarity ?? 0.1;

    const results: SearchResult[] = [];
    for (const memory of this.memories.values()) {
      if (memory.status !== "active") continue;
      if (input.kind && memory.kind !== input.kind) continue;

      const sim = cosineSimilarity(queryEmbedding, memory.embedding);
      if (sim >= minSimilarity) {
        results.push({ memory, similarity: sim });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }

  getShortTermMemories(): MemoryEntry[] {
    return this.shortTermMemory
      .map((id) => this.memories.get(id))
      .filter((m): m is MemoryEntry => m !== undefined);
  }

  async retrieveForContext(query: string, maxCount: number = 5): Promise<MemoryEntry[]> {
    const results = await this.search({ query, limit: maxCount, minSimilarity: 0.15 });
    return results.map((r) => r.memory);
  }

  summarizeSession(sessionId: string): string {
    const sessionMemories = this.list({ kind: "short" }).filter((m) => m.sessionId === sessionId);
    if (sessionMemories.length === 0) return "";
    return sessionMemories.map((m) => m.summary).join("; ");
  }
}

export const memoryService = new MemoryService();
