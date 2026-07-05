# M9 知识库增强 · 学习文档

> M9 在 M8 高级推理基础上建立知识库体系，实现多数据源接入、向量检索（RAG）和多 Agent 协作。配套需求文档：[M9-knowledge-base.md](../requirements/M9-knowledge-base.md)。

## 1. 需求思路

### 1.1 M8 的局限

M8 实现了高级推理框架，但推理完全基于实时输入和临时记忆，缺乏：
- 无法接入外部知识库（文档、网页、数据库）
- 无法进行语义检索（RAG）
- 无法多 Agent 协作完成复杂任务

### 1.2 M9 要解决什么

| 能力 | 体现 |
|------|------|
| **多数据源** | 支持文本、Markdown、URL、数据库四种类型文档 |
| **文档向量化** | 自动切分文档为 chunks，生成 Embedding |
| **向量检索** | 语义搜索，相似文档匹配 |
| **RAG** | 检索增强生成，基于知识库回答问题 |
| **多 Agent 协作** | 专家角色定义、协调器分发、结果汇总 |

## 2. 代码思路

### 2.1 关键文件

| 文件 | 职责 |
|------|------|
| `src/server/knowledge/document-service.ts` | 文档服务（创建、列表、删除、切分、向量化） |
| `src/server/knowledge/vector-store.ts` | 向量存储（添加、删除、搜索） |
| `src/server/knowledge/rag-service.ts` | RAG 服务（检索、生成回答、统计） |
| `src/server/knowledge/multi-agent.ts` | 多 Agent 协作（专家定义、协调器、任务分发） |
| `src/server/knowledge/index.ts` | 统一导出 |
| `src/app/api/knowledge/documents/route.ts` | CRUD 文档 API |
| `src/app/api/knowledge/search/route.ts` | 语义搜索 API |
| `src/app/api/knowledge/rag/route.ts` | RAG 问答 API |
| `src/features/knowledge/knowledge-manager.tsx` | 知识库管理 UI |
| `src/app/knowledge/page.tsx` | /knowledge 页面路由 |

### 2.2 文档处理流程

```
用户：上传文档（标题 + 类型 + 内容）
  ↓
documentService.createDocument():
  1. chunkText(content) → 切分为 500 字符 chunks（100 字符重叠）
  2. 每个 chunk 调用 getProvider().embed() → 生成 Embedding
  3. 保存到 localStorage
  ↓
ragService.addDocumentToStore():
  1. 遍历所有 chunks
  2. vectorStore.add(chunk.id, embedding, metadata, docId, content)
  ↓
知识库就绪，可进行语义搜索和 RAG 问答
```

### 2.3 RAG 工作流程

```
用户问题："什么是 TypeScript？"
  ↓
ragService.generateWithContext():
  1. getProvider().embed(query) → 生成查询向量
  2. vectorStore.search(queryEmbedding) → 检索相似 chunks
  3. 构建 context = 匹配 chunks 内容拼接
  4. 如果有 context，构建 RAG prompt：
     "基于以下知识库内容回答用户问题..."
     + context
     + "用户问题：${query}"
  5. 调用 getProvider().complete() → 生成回答
  6. 返回 { answer, sources }
```

### 2.4 多 Agent 协作流程

```
用户需求："分析 AI 最新进展并生成报告"
  ↓
multiAgentCoordinator.collaborate():
  1. 规划专家 → 分解任务：
     [{ title: "搜索 AI 进展", assignee: "researcher" },
      { title: "分析数据", assignee: "analyst" },
      { title: "生成报告", assignee: "writer" }]
  2. 研究专家 → 搜索信息
  3. 分析专家 → 分析数据
  4. 写作专家 → 生成报告
  5. 评审专家 → 检查质量
  6. 返回 { success, finalAnswer, steps }
```

## 3. 技术架构

### 3.1 专家 Agent 定义

| 角色 | 名称 | 职责 | 可用工具 |
|------|------|------|----------|
| planner | 规划专家 | 任务分解、分配 | - |
| researcher | 研究专家 | 信息搜索、数据收集 | web_search, read_file |
| analyst | 分析专家 | 数据分析、模式识别 | calculator, code_runner |
| writer | 写作专家 | 报告撰写、内容生成 | summarize_report |
| reviewer | 评审专家 | 质量检查、验证 | - |

### 3.2 文档切分策略

```
CHUNK_SIZE = 500 字符
CHUNK_OVERLAP = 100 字符

文本："人工智能（Artificial Intelligence，AI）是..."

Chunk 0: "人工智能（Artificial Intelligence，AI）是..." (500 chars)
Chunk 1: "...发展的一门技术。机器学习是 AI 的分支..." (重叠 100 chars)
```

### 3.3 向量检索算法

```
vectorStore.search(queryEmbedding, options):
  1. 遍历所有向量条目
  2. 计算余弦相似度 cosineSimilarity(query, entry)
  3. 过滤 similarity >= minSimilarity
  4. 按相似度降序排序
  5. 返回前 limit 条结果
```

## 4. 验证结果

| 验证项 | 结果 |
|--------|------|
| `npx tsc --noEmit` | ✅ 0 error |
| /knowledge 页面 | ✅ 文档管理 + 语义搜索 + RAG 问答 |
| 文档上传 | ✅ 自动切分 + 向量化 |
| 语义搜索 | ✅ 相似度排序 |
| RAG 问答 | ✅ 基于知识库回答 + 来源标注 |
| 多 Agent 协作 | ✅ 5 个专家角色 + 协调器模式 |
| 导航入口 | ✅ sidebar 添加知识库链接 |

## 5. 待优化（M10+ 处理）

- **ISSUE-M9-001** 真实向量数据库（Pinecone/Weaviate/Milvus）→ M10
- **ISSUE-M9-002** PDF/Word 文档解析 → M10
- **ISSUE-M9-003** 知识图谱构建 → M10
- **ISSUE-M9-004** 多 Agent 实时协作 → 后续迭代
- **ISSUE-M9-005** 知识库权限管理 → M10

## 6. 关联文档

- 需求文档：[M9-knowledge-base.md](../requirements/M9-knowledge-base.md)
- M8 学习文档：[M8-advanced-reasoning.md](../learning/M8-advanced-reasoning.md)
