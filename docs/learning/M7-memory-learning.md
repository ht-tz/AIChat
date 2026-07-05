# M7 Agent 记忆与学习 · 学习文档

> M7 建立了记忆管理系统和经验积累机制，让 Agent 具备短期记忆、长期记忆和学习能力。配套需求文档：[M7-memory-learning.md](../requirements/M7-memory-learning.md)。

## 1. 需求思路

### 1.1 M6 的局限

M6 实现了提示词工程中心，但 Agent 没有"记忆"能力：
- 无法记住跨会话的长期知识
- 无法从历史对话中提取经验
- 无法基于过去经验优化回答

### 1.2 M7 要解决什么

| 能力 | 体现 |
|------|------|
| **短期记忆** | 当前会话内的上下文理解，自动总结关键信息 |
| **长期记忆** | 跨会话知识存储，支持相似度检索 |
| **记忆管理** | 查看、编辑、删除记忆条目 |
| **经验积累** | 从成功/失败案例中学习，构建案例库 |
| **记忆注入** | 对话时自动检索相关记忆并注入 prompt |
| **记忆图谱** | 可视化展示记忆节点和连接关系 |

## 2. 代码思路

### 2.1 关键文件

| 文件 | 职责 |
|------|------|
| `src/server/memory/vector-utils.ts` | 向量相似度计算（余弦相似度、欧氏距离） |
| `src/server/memory/memory-service.ts` | 记忆服务（短期/长期/情景记忆、检索、管理） |
| `src/server/memory/experience-service.ts` | 经验服务（经验提取、案例库、搜索） |
| `src/server/memory/index.ts` | 统一导出 |
| `src/app/api/memories/route.ts` | GET/POST/PUT/DELETE /api/memories |
| `src/app/api/memories/search/route.ts` | POST /api/memories/search |
| `src/app/api/experiences/route.ts` | GET/POST/PUT/DELETE /api/experiences |
| `src/app/api/experiences/search/route.ts` | POST /api/experiences/search |
| `src/stores/memory.ts` | Zustand store + localStorage 持久化 |
| `src/features/memory/memory-manager.tsx` | 记忆管理 UI（记忆库 + 经验案例 + 图谱） |
| `src/app/memory/page.tsx` | /memory 页面路由 |
| `src/server/db/schema.ts` | 新增 memories + memory_chunks + experiences 表 |
| `drizzle/0004_memory_learning.sql` | SQL 迁移文件 |

### 2.2 记忆类型划分

| 类型 | 说明 | 存储策略 | 检索方式 |
|------|------|----------|----------|
| **短期记忆（short）** | 当前会话内的上下文 | 保留最近 50 条 | 按时间顺序 |
| **长期记忆（long）** | 跨会话的持久知识 | 最多 1000 条 | 相似度检索 |
| **情景记忆（episodic）** | 特定时间/场景的记忆 | 最多 1000 条 | 相似度检索 |

### 2.3 记忆检索流程

```
用户输入: "我之前提到的那个项目..."
            ↓
调用 retrieveForContext(query)
            ↓
生成 query embedding（调用 Provider.embed()）
            ↓
遍历所有 active 记忆，计算余弦相似度
            ↓
返回相似度 > 0.15 的前 N 条记忆
            ↓
注入到 system prompt 中
```

### 2.4 经验提取规则

```
每次对话结束后，extractFromConversation()：
  1. 检查最后一条 AI 回复是否包含 "error" 或 "失败"
     - 是 → 创建 failure 经验
     - 否 → 创建 success 经验
  2. 检查对话长度（用户消息 > 3）
     - 是 → 创建 insight 经验
```

### 2.5 Mock Embedding 实现

```
MockProvider.embed(text):
  1. 创建 1536 维向量，初始化为 0
  2. 遍历文本每个字符，将 charCode % 97 / 100 累加到对应位置
  3. 归一化向量（除以 L2 范数）
  4. 返回向量

特点：相同文本产生相同向量，相似文本产生相似向量（基于字符分布）
```

## 3. 技术架构

### 3.1 页面结构

```
/memory (MemoryManager)
├── 顶部: 返回链接 + "记忆管理"标题
├── Tab: 记忆库 | 经验案例
├── 记忆库模式:
│   ├── 左侧: 记忆列表
│   │   ├── 搜索框
│   │   ├── 类型筛选（短期/长期/情景）
│   │   ├── 状态筛选（活跃/归档/遗忘）
│   │   └── 列表项（摘要、类型标签、重要度、时间）
│   ├── 右侧: 记忆详情
│   │   ├── 内容、摘要、主题标签
│   │   ├── 重要度滑块（0-100）
│   │   ├── 状态切换
│   │   └── 时间信息、访问次数
│   └── 底部: 记忆图谱（SVG 节点可视化）
└── 经验案例模式:
    ├── 左侧: 经验列表
    │   ├── 搜索框
    │   ├── 类型筛选（成功/失败/洞察）
    │   └── 列表项（标题、类型标签、评分）
    └── 右侧: 经验详情
        ├── 标题、描述、经验教训
        ├── 标签、星级评分
        └── 时间信息
```

### 3.2 数据流

```
记忆写入:
  对话结束 → 提取关键信息 → addShortTerm/addLongTerm → localStorage 持久化

记忆检索:
  用户输入 → searchMemories(query) → 计算相似度 → 返回匹配记忆 → 注入 prompt

经验提取:
  对话结束 → extractFromConversation() → 判断成功/失败/洞察 → 创建经验条目
```

### 3.3 数据库表设计

```
memories (记忆表)
├── id: uuid PK
├── session_id: varchar FK → sessions
├── kind: memory_kind (short/long/episodic)
├── content: text
├── summary: text
├── topics: jsonb[]
├── importance: int (0-100)
├── embedding: text (JSON serialized)
├── source: varchar
├── metadata: jsonb
├── status: memory_status (active/archived/forgotten)
├── referenced_count: int
└── created_at/updated_at/last_accessed_at: timestamp

memory_chunks (记忆切片) —— 为 M10 RAG 预留
├── id: uuid PK
├── memory_id: uuid FK → memories
├── chunk_index: int
├── content: text
├── embedding: text
├── token_count: int
└── created_at: timestamp

experiences (经验案例)
├── id: uuid PK
├── session_id: varchar FK → sessions
├── run_id: uuid FK → agent_runs
├── type: experience_type (success/failure/insight)
├── title: varchar(200)
├── description: text
├── lesson: text
├── context: jsonb
├── tags: jsonb[]
├── rating: int (0-5)
├── referenced_count: int
└── created_at/updated_at: timestamp
```

## 4. 技术拓展

### 4.1 真实 Embedding 模型（M8+）

当前使用 Mock Embedding，升级到真实模型：

```ts
// OpenAI Embedding
import { OpenAI } from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const result = await client.embeddings.create({
  model: "text-embedding-3-small",
  input: "Hello world",
});
const embedding = result.data[0].embedding;

// 或使用本地模型（Mistral/MiniLM）
import { SentenceTransformer } from "sentence-transformers";
const model = new SentenceTransformer("all-MiniLM-L6-v2");
const embedding = await model.encode("Hello world");
```

### 4.2 记忆压缩算法（M8+）

```ts
// 定期压缩低频访问的记忆
async function compressMemory(memoryId: string): Promise<void> {
  const memory = memoryService.get(memoryId);
  if (!memory || memory.referencedCount > 10) return;

  // 使用 LLM 生成更短的摘要
  const summary = await getProvider().complete({
    messages: [{ role: "user", content: `请将以下内容压缩为简短摘要（100字以内）：\n${memory.content}` }],
  });

  memoryService.update(memoryId, { summary: summary.content });
}
```

### 4.3 记忆遗忘机制（M8+）

```ts
// LRU + 重要度衰减
function forgetLowPriority(): void {
  const memories = memoryService.list();
  const now = Date.now();
  
  for (const m of memories) {
    // 计算遗忘分数：访问时间越久、重要度越低，分数越高
    const decay = Math.pow(0.95, (now - m.lastAccessedAt) / (24 * 60 * 60 * 1000));
    const forgetScore = (100 - m.importance) * (1 - decay);
    
    if (forgetScore > 80) {
      memoryService.update(m.id, { status: "forgotten" });
    }
  }
}
```

### 4.4 记忆注入到对话

```ts
// 在 dispatcher 中注入记忆
async function runAgentWithMemory(req: AgentRequest): Promise<AgentResponse> {
  const recentMemories = await memoryService.retrieveForContext(
    req.messages[req.messages.length - 1].content,
    5
  );
  
  if (recentMemories.length > 0) {
    const memoryContext = recentMemories.map((m) => 
      `- ${m.summary}（重要度：${m.importance}）`
    ).join("\n");
    
    const memoryPrompt = `\n\n参考历史记忆：\n${memoryContext}`;
    req.messages[0].content += memoryPrompt;
  }
  
  return runAgent(req);
}
```

## 5. 示例

### 5.1 创建记忆

```bash
curl -X POST http://localhost:3000/api/memories \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "long",
    "content": "用户喜欢使用 TypeScript 编写后端代码",
    "summary": "用户偏好 TypeScript",
    "topics": ["user-preference", "technology"],
    "importance": 80
  }'
```

### 5.2 搜索记忆

```bash
curl -X POST http://localhost:3000/api/memories/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "用户偏好",
    "kind": "long",
    "limit": 5
  }'
```

### 5.3 创建经验

```bash
curl -X POST http://localhost:3000/api/experiences \
  -H "Content-Type: application/json" \
  -d '{
    "type": "success",
    "title": "代码审查成功",
    "description": "用户提供了一段 TypeScript 代码",
    "lesson": "使用代码审查模板可以得到高质量的审查结果",
    "tags": ["code-review", "success"],
    "rating": 5
  }'
```

### 5.4 搜索经验

```bash
curl -X POST http://localhost:3000/api/experiences/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "代码审查",
    "limit": 10
  }'
```

## 6. 验证结果

| 验证项 | 结果 |
|--------|------|
| `npx tsc --noEmit` | ✅ 0 error |
| `/memory` 页面 | ✅ 记忆库 + 经验案例 + 图谱 |
| 记忆创建/编辑/删除 | ✅ localStorage 持久化 |
| 记忆搜索 | ✅ 相似度检索 API |
| 经验提取 | ✅ 成功/失败/洞察分类 |
| 经验评分 | ✅ 0-5 星级评分 |
| 记忆图谱 | ✅ SVG 节点可视化 |
| 导航入口 | ✅ sidebar 添加记忆管理链接 |

## 7. 待优化（M8+ 处理）

- **ISSUE-M7-001** 真实 Embedding 模型 → M8 接入 OpenAI Embedding / 本地模型
- **ISSUE-M7-002** 记忆压缩算法 → M8 定期压缩低频记忆
- **ISSUE-M7-003** 记忆遗忘机制 → M8 LRU + 重要度衰减
- **ISSUE-M7-004** 记忆注入到对话 → 在 dispatcher 中集成
- **ISSUE-M7-005** 记忆图谱交互 → 支持拖拽、缩放、过滤
- **ISSUE-M7-006** DB 持久化迁移 → 当前 localStorage，DB 表已就绪

## 8. 关联文档

- 需求文档：[M7-memory-learning.md](../requirements/M7-memory-learning.md)
- 架构总览：[00-architecture.md](./00-architecture.md)
