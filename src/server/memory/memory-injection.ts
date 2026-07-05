// 记忆注入服务 —— 将记忆自动注入到对话上下文

import { memoryService, type MemoryEntry } from "./memory-service";

export interface MemoryInjectionOptions {
  maxMemories: number;
  minSimilarity: number;
  includeShortTerm: boolean;
  includeLongTerm: boolean;
  includeEpisodic: boolean;
}

export interface MemoryInjectionResult {
  injected: MemoryEntry[];
  contextText: string;
  injectionCount: number;
}

export const DEFAULT_INJECTION_OPTIONS: MemoryInjectionOptions = {
  maxMemories: 5,
  minSimilarity: 0.15,
  includeShortTerm: true,
  includeLongTerm: true,
  includeEpisodic: true,
};

function formatMemoryForContext(memory: MemoryEntry): string {
  const kindLabels = {
    short: "短期记忆",
    long: "长期记忆",
    episodic: "情景记忆",
  };
  return `【${kindLabels[memory.kind]}】${memory.summary}`;
}

export async function injectMemories(
  query: string,
  options: MemoryInjectionOptions = DEFAULT_INJECTION_OPTIONS,
): Promise<MemoryInjectionResult> {
  const kinds: Array<"short" | "long" | "episodic"> = [];
  if (options.includeShortTerm) kinds.push("short");
  if (options.includeLongTerm) kinds.push("long");
  if (options.includeEpisodic) kinds.push("episodic");

  const results: Array<{ memory: MemoryEntry; similarity: number }> = [];

  for (const kind of kinds) {
    const searchResults = await memoryService.search({
      query,
      kind,
      limit: options.maxMemories,
      minSimilarity: options.minSimilarity,
    });
    results.push(...searchResults);
  }

  results.sort((a, b) => b.similarity - a.similarity);

  const topMemories = results.slice(0, options.maxMemories);
  const injected = topMemories.map((r) => r.memory);

  if (injected.length === 0) {
    return { injected: [], contextText: "", injectionCount: 0 };
  }

  const contextLines = injected.map(formatMemoryForContext);
  const contextText = `基于历史记忆，以下信息可能与当前对话相关：\n${contextLines.join("\n")}`;

  return { injected, contextText, injectionCount: injected.length };
}

export async function extractAndSaveMemory(
  sessionId: string,
  conversation: Array<{ role: string; content: string }>,
): Promise<MemoryEntry[]> {
  const savedEntries: MemoryEntry[] = [];

  const userMessages = conversation.filter((m) => m.role === "user");
  const assistantMessages = conversation.filter((m) => m.role === "assistant");

  for (const msg of userMessages) {
    if (msg.content.length < 5) continue;

    const existing = await memoryService.search({
      query: msg.content,
      limit: 1,
      minSimilarity: 0.9,
    });
    if (existing.length > 0) {
      continue;
    }

    const entry = await memoryService.addShortTerm({
      sessionId,
      content: msg.content,
      source: "conversation",
      topics: extractTopics(msg.content),
    });
    savedEntries.push(entry);
  }

  for (const msg of assistantMessages) {
    if (msg.content.length < 10) continue;

    const existing = await memoryService.search({
      query: msg.content,
      limit: 1,
      minSimilarity: 0.9,
    });
    if (existing.length > 0) {
      continue;
    }

    const entry = await memoryService.addLongTerm({
      sessionId,
      content: msg.content,
      source: "assistant_response",
      topics: extractTopics(msg.content),
      importance: Math.min(100, Math.floor(msg.content.length / 10)),
    });
    savedEntries.push(entry);
  }

  return savedEntries;
}

function extractTopics(text: string): string[] {
  const keywords: string[] = [];
  const patterns = [
    /(人工智能|AI|机器学习|深度学习|大语言模型|LLM)/gi,
    /(前端|后端|数据库|API|框架)/gi,
    /(项目|需求|功能|开发|部署)/gi,
    /(问题|错误|修复|调试)/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      keywords.push(...matches.map((m) => m.toLowerCase()));
    }
  }

  return [...new Set(keywords)].slice(0, 5);
}

export async function getMemoryInjectionStatus(): Promise<{
  totalMemories: number;
  shortTermCount: number;
  longTermCount: number;
  episodicCount: number;
  lastInjectionTime?: number;
}> {
  const allMemories = memoryService.list();
  return {
    totalMemories: allMemories.length,
    shortTermCount: allMemories.filter((m) => m.kind === "short").length,
    longTermCount: allMemories.filter((m) => m.kind === "long").length,
    episodicCount: allMemories.filter((m) => m.kind === "episodic").length,
  };
}
