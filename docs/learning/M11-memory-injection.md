# M11 记忆注入

## 基本信息

- **里程碑**：M11
- **标题**：记忆注入（Memory Injection）
- **完成日期**：2026-07-03
- **作者**：AI Agent Team
- **状态**：✅ 已完成

## 1. 需求回顾

M7 已经实现了完整的记忆系统，但记忆尚未与对话系统集成。M11 实现记忆注入功能，让 Agent 能够自动检索与当前对话相关的记忆并注入到上下文，实现上下文感知。参考需求文档：[`docs/requirements/M11-memory-injection.md`](../requirements/M11-memory-injection.md)

## 2. 思路与设计

### 2.1 关键决策

1. **注入时机**：对话开始时，根据用户最后一条消息检索相关记忆
2. **注入方式**：以 system message 形式插入到消息列表最前面
3. **记忆保存**：对话结束后，自动提取用户消息和助手回复存入记忆系统
4. **配置选项**：支持控制注入数量、相似度阈值、记忆类型过滤

### 2.2 数据流 / 调用链

**记忆注入流程**：
```
用户消息 → injectMemories(query) → 向量检索 → 匹配相关记忆 → 生成contextText → 插入system message
```

**记忆保存流程**：
```
对话结束 → extractAndSaveMemory(sessionId, messages) → 提取user/assistant消息 → 去重检查 → 存入短期/长期记忆
```

**Dispatcher 集成**：
```
runAgent → 检查enableMemoryInjection → injectMemories → 注入上下文 → 执行对话 → extractAndSaveMemory
```

### 2.3 异常 / 边界处理

- **记忆检索失败**：静默降级，不影响对话流程
- **无相关记忆**：不注入任何内容，正常对话
- **重复记忆**：通过相似度检测（>0.9）避免重复存储
- **短消息过滤**：内容少于5字符的用户消息不保存

## 3. 技术架构

### 3.1 模块划分

| 文件 | 职责 |
|------|------|
| `src/server/memory/memory-injection.ts` | 记忆注入服务：检索、格式化、保存 |
| `src/server/memory/memory-service.ts` | 记忆服务：存储、搜索、管理 |
| `src/server/agent/dispatcher.ts` | 调度器：集成记忆注入和保存逻辑 |
| `src/lib/types.ts` | 类型定义：新增 memory_injection AgentStep |
| `src/app/api/memory/injection/route.ts` | API 路由：手动触发注入/提取 |

### 3.2 关键类型 / 接口

```typescript
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

export type AgentStep =
  | { kind: "memory_injection"; memories: Array<{ id: string; summary: string; kind: "short" | "long" | "episodic"; similarity: number }> }
  | ...其他类型;
```

### 3.3 关键代码片段

**记忆注入核心逻辑**：
```typescript
export async function injectMemories(
  query: string,
  options: MemoryInjectionOptions = DEFAULT_INJECTION_OPTIONS,
): Promise<MemoryInjectionResult> {
  const kinds = [];
  if (options.includeShortTerm) kinds.push("short");
  if (options.includeLongTerm) kinds.push("long");
  if (options.includeEpisodic) kinds.push("episodic");

  const results = [];
  for (const kind of kinds) {
    const searchResults = await memoryService.search({
      query, kind, limit: options.maxMemories, minSimilarity: options.minSimilarity,
    });
    results.push(...searchResults);
  }

  results.sort((a, b) => b.similarity - a.similarity);
  const topMemories = results.slice(0, options.maxMemories);
  
  if (topMemories.length === 0) {
    return { injected: [], contextText: "", injectionCount: 0 };
  }

  const contextLines = topMemories.map(formatMemoryForContext);
  const contextText = `基于历史记忆，以下信息可能与当前对话相关：\n${contextLines.join("\n")}`;

  return { injected: topMemories.map(r => r.memory), contextText, injectionCount: topMemories.length };
}
```

**Dispatcher 集成**：
```typescript
if (opts.enableMemoryInjection !== false) {
  const lastUserMsg = [...currentMessages].reverse().find((m) => m.role === "user");
  if (lastUserMsg) {
    const injectionResult = await injectMemories(lastUserMsg.content);
    if (injectionResult.injectionCount > 0) {
      currentMessages = [
        { role: "system" as const, content: injectionResult.contextText },
        ...currentMessages,
      ];
      yield await persistAndYield({
        kind: "memory_injection",
        memories: injectionResult.injected.map((m) => ({
          id: m.id, summary: m.summary, kind: m.kind, similarity: 0,
        })),
      });
    }
  }
}
```

## 4. 技术拓展

- **记忆压缩**：定期压缩长期记忆，合并相似记忆
- **记忆遗忘**：实现基于重要性和时间的遗忘机制
- **记忆可视化**：展示记忆图谱，支持交互探索
- **多模态记忆**：支持图像、文件等多模态记忆的存储和检索
- **个性化记忆**：基于用户画像的记忆优先级排序

## 5. 示例

### 5.1 怎么用

**API 调用**：
```typescript
// 注入记忆
const result = await fetch("/api/memory/injection", {
  method: "POST",
  body: JSON.stringify({ action: "inject", query: "我的项目进展如何" }),
});

// 提取并保存记忆
await fetch("/api/memory/injection", {
  method: "POST",
  body: JSON.stringify({
    action: "extract",
    sessionId: "session-123",
    conversation: [{ role: "user", content: "你好" }, { role: "assistant", content: "你好！" }],
  }),
});

// 获取状态
const status = await fetch("/api/memory/injection");
```

**Dispatcher 配置**：
```typescript
const stream = runAgent({
  messages,
  dbSessionId: "session-123",
  enableMemoryInjection: true,
  getProvider,
});
```

### 5.2 最小可运行示例

**对话场景**：
```
用户：我叫张三，正在开发一个AI项目
助手：你好张三，很高兴认识你！

用户：我的项目进展如何？
助手：（自动注入记忆）基于历史记忆，以下信息可能与当前对话相关：
【短期记忆】我叫张三，正在开发一个AI项目
你的AI项目目前正在进行中。根据之前的对话，你提到正在开发一个AI项目...
```

## 6. 验证记录

- 跑了哪些命令 / 测试：
  - `pnpm run typecheck` ✅ 0 error
- 浏览器表现：记忆注入自动触发，memory_injection 事件通过 SSE 推送
- 已知遗留问题：
  - ISSUE-M11-001：记忆压缩算法
  - ISSUE-M11-002：记忆遗忘机制
  - ISSUE-M11-003：前端记忆注入效果展示

## 7. 收获与踩坑

- 学到了什么：
  - 如何将记忆系统与对话系统无缝集成
  - 向量检索在上下文感知中的应用
  - SSE 流式事件扩展的最佳实践
- 踩过的坑：
  - 在 dispatcher 中使用 `persistAndYield` 前必须先定义，否则 TypeScript 报错
  - `localStorage` 在服务器端不可用，需要移除相关代码
- 下次会怎么做：
  - 在添加新功能前先检查 TypeScript 类型定义
  - 在服务器端代码中避免使用浏览器 API