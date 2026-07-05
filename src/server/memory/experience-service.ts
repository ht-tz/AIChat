// 经验服务 —— 经验提取与案例库

export type ExperienceType = "success" | "failure" | "insight";

export interface ExperienceEntry {
  id: string;
  sessionId?: string;
  runId?: string;
  type: ExperienceType;
  title: string;
  description: string;
  lesson: string;
  context: Record<string, unknown>;
  tags: string[];
  rating: number;
  referencedCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateExperienceInput {
  sessionId?: string;
  runId?: string;
  type: ExperienceType;
  title: string;
  description?: string;
  lesson: string;
  context?: Record<string, unknown>;
  tags?: string[];
  rating?: number;
}

const EXPERIENCE_LIMIT = 500;

export class ExperienceService {
  private experiences: Map<string, ExperienceEntry> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem("nexus-experiences");
      if (data) {
        const parsed = JSON.parse(data) as ExperienceEntry[];
        parsed.forEach((e) => this.experiences.set(e.id, e));
      }
    } catch {}
  }

  private saveToStorage(): void {
    try {
      const data = JSON.stringify(Array.from(this.experiences.values()));
      localStorage.setItem("nexus-experiences", data);
    } catch {}
  }

  create(input: CreateExperienceInput): ExperienceEntry {
    const now = Date.now();
    const entry: ExperienceEntry = {
      id: `exp-${now}-${Math.random().toString(36).slice(2, 8)}`,
      sessionId: input.sessionId,
      runId: input.runId,
      type: input.type,
      title: input.title,
      description: input.description || "",
      lesson: input.lesson,
      context: input.context || {},
      tags: input.tags || [],
      rating: input.rating ?? 0,
      referencedCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    if (this.experiences.size >= EXPERIENCE_LIMIT) {
      const oldest = Array.from(this.experiences.values()).sort(
        (a, b) => a.createdAt - b.createdAt,
      )[0];
      if (oldest) {
        this.experiences.delete(oldest.id);
      }
    }

    this.experiences.set(entry.id, entry);
    this.saveToStorage();
    return entry;
  }

  get(id: string): ExperienceEntry | undefined {
    const entry = this.experiences.get(id);
    if (entry) {
      entry.referencedCount++;
      this.saveToStorage();
    }
    return entry;
  }

  update(
    id: string,
    updates: Partial<
      Pick<ExperienceEntry, "title" | "description" | "lesson" | "tags" | "rating" | "context">
    >,
  ): ExperienceEntry | undefined {
    const entry = this.experiences.get(id);
    if (!entry) return undefined;
    if (updates.title) entry.title = updates.title;
    if (updates.description) entry.description = updates.description;
    if (updates.lesson) entry.lesson = updates.lesson;
    if (updates.tags) entry.tags = updates.tags;
    if (updates.rating !== undefined) entry.rating = updates.rating;
    if (updates.context) entry.context = updates.context;
    entry.updatedAt = Date.now();
    this.saveToStorage();
    return entry;
  }

  delete(id: string): boolean {
    const removed = this.experiences.delete(id);
    if (removed) this.saveToStorage();
    return removed;
  }

  list(options?: { type?: ExperienceType }): ExperienceEntry[] {
    return Array.from(this.experiences.values())
      .filter((e) => {
        if (options?.type && e.type !== options.type) return false;
        return true;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  search(query: string, limit: number = 10): ExperienceEntry[] {
    const lower = query.toLowerCase();
    return Array.from(this.experiences.values())
      .filter(
        (e) =>
          e.title.toLowerCase().includes(lower) ||
          e.description.toLowerCase().includes(lower) ||
          e.lesson.toLowerCase().includes(lower) ||
          e.tags.some((t) => t.toLowerCase().includes(lower)),
      )
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
  }

  getByType(type: ExperienceType): ExperienceEntry[] {
    return this.list({ type });
  }

  getSuccessCases(): ExperienceEntry[] {
    return this.list({ type: "success" }).slice(0, 20);
  }

  getFailureCases(): ExperienceEntry[] {
    return this.list({ type: "failure" }).slice(0, 20);
  }

  getInsights(): ExperienceEntry[] {
    return this.list({ type: "insight" }).slice(0, 20);
  }

  async extractFromConversation(
    sessionId: string,
    messages: Array<{ role: string; content: string }>,
  ): Promise<ExperienceEntry[]> {
    const results: ExperienceEntry[] = [];

    const lastMessage = messages[messages.length - 1];
    const userMessages = messages.filter((m) => m.role === "user");
    const assistantMessages = messages.filter((m) => m.role === "assistant");

    if (assistantMessages.length > 0) {
      const lastAssistant = assistantMessages[assistantMessages.length - 1];
      if (lastAssistant.content.includes("error") || lastAssistant.content.includes("失败")) {
        results.push(
          this.create({
            sessionId,
            type: "failure",
            title: "对话失败",
            description: `用户：${userMessages[userMessages.length - 1]?.content}`,
            lesson: "对话中出现错误，需要改进提示词或工具调用",
            tags: ["error", "conversation"],
          }),
        );
      } else {
        results.push(
          this.create({
            sessionId,
            type: "success",
            title: "成功回答",
            description: `用户：${userMessages[userMessages.length - 1]?.content}`,
            lesson: "成功完成对话，可以总结关键知识点",
            tags: ["success", "conversation"],
          }),
        );
      }
    }

    if (userMessages.length > 3) {
      results.push(
        this.create({
          sessionId,
          type: "insight",
          title: "长对话洞察",
          description: `包含 ${messages.length} 条消息的对话`,
          lesson: "用户进行了多轮对话，可能有持续的学习需求",
          tags: ["long-conversation", "insight"],
        }),
      );
    }

    return results;
  }
}

export const experienceService = new ExperienceService();
