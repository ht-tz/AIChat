# M17: LangChain Tools + RAG 集成 —— 学习文档

> 里程碑：LangChain 工具系统 + RAG 管线
> 对比自研模块：`src/server/tools/` + `src/server/knowledge/`
> 学习目标：理解工具抽象、文本分块、向量检索的工业级实现

---

## 一、需求思路

### 1.1 学习动机

自研已实现：
- `Tool` 接口（`name`/`description`/`parameters`/`execute`/`toDefinition`）
- `ToolRegistry`（register/list/get/parseArgs/execute）
- 8 个内置工具（calculator/web_search/code_runner 等）
- `DocumentService`（固定 500 字符分块 + 句子回溯）
- `RagService`（手写 cosine similarity 检索）

LangChain 对应：
- `DynamicTool` / `tool()` 函数
- `RecursiveCharacterTextSplitter`（递归分块）
- `VectorStore` 基类 + `Retriever` 接口
- LCEL RAG Chain

### 1.2 关键发现：LangChain 1.x 破坏性变更

实施过程中发现 LangChain 1.x 移除了多个常用模块：
- ❌ `langchain/vectorstores/memory`（`MemoryVectorStore`）
- ❌ `langchain/chains`（`RetrievalQAChain`）
- ❌ `@langchain/community/vectorstores/memory`

**应对策略**：
1. 手动实现 `InMemoryVectorStore`（继承 `VectorStore` 基类）
2. 用 `RunnableSequence`（LCEL）替代 `RetrievalQAChain`

这反而成了学习机会 —— 通过手动实现，深入理解了 `VectorStore` 抽象的设计。

---

## 二、代码思路

### 2.1 工具适配层

**自研 Tool 接口**：
```typescript
interface Tool<T extends z.ZodType> {
  name: string;
  description: string;
  parameters: T;
  execute: (args: z.infer<T>) => Promise<unknown>;
  toDefinition(): ToolDefinition;
}
```

**LangChain DynamicTool**：
```typescript
import { DynamicTool } from "@langchain/core/tools";

const tool = new DynamicTool({
  name: "calculator",
  description: "计算数学表达式",
  func: async (input: string) => {
    const args = JSON.parse(input);
    const result = await selfBuiltTool.execute(args);
    return JSON.stringify(result);
  },
});
```

**适配策略**：`DynamicTool.func` 接收 JSON 字符串，内部调用 `toolRegistry.execute()`：

```typescript
export function adaptToLangChainTools(): DynamicTool[] {
  const tools = toolRegistry.list();
  return tools.map(tool => new DynamicTool({
    name: tool.name,
    description: tool.description,
    func: async (jsonArgs: string) => {
      const args = JSON.parse(jsonArgs);
      const result = await toolRegistry.execute(tool.name, args);
      return JSON.stringify(result);
    },
  }));
}
```

**核心差异**：
| 维度 | 自研 | LangChain |
|------|------|-----------|
| 参数格式 | Zod schema 强类型 | JSON 字符串 |
| 调用方式 | `toolRegistry.execute(name, args)` | `tool.invoke(input)` |
| Schema 暴露 | `toDefinition()` → OpenAPI 格式 | `Tool` 基类自带 |
| Agent 集成 | 手写 tool_call 协议 | `ToolCallingAgent` 自动 |

### 2.2 文本分块对比

**自研方案**（`document-service.ts`）：
```typescript
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100;

function chunkText(text: string): string[] {
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE, text.length);
    // 回溯找句号/换行/空格
    const lastPeriod = text.lastIndexOf(".", end);
    const lastNewline = text.lastIndexOf("\n", end);
    const bestSplit = Math.max(lastPeriod, lastNewline);
    if (bestSplit > start + CHUNK_SIZE / 2) end = bestSplit + 1;
    chunks.push(text.slice(start, end));
    start = end - CHUNK_OVERLAP;
  }
}
```

**LangChain 方案**：
```typescript
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 100,
  separators: ["\n\n", "\n", "。", ".", " ", ""],
});
const chunks = await splitter.splitText(text);
```

**核心差异**：
- 自研：单层回溯（只找一次最佳分割点）
- LangChain：**递归**尝试多个分隔符，从结构化（段落）到字符级

`RecursiveCharacterTextSplitter` 算法：
1. 尝试用 `"\n\n"`（段落）分割
2. 如果块仍太大，用 `"\n"`（行）分割
3. 继续用 `"。"`（中文句号）、`"."`（英文句号）
4. 最后用 `" "`（空格）、`""`（字符）兜底

这保证了语义完整性优先（段落 > 句子 > 词 > 字符）。

### 2.3 InMemoryVectorStore 手动实现

**自研方案**（`vector-store.ts`）：
```typescript
class VectorStore {
  private items: Array<{id, embedding, metadata}> = [];
  
  async search(query: number[], k: number) {
    return this.items
      .map(item => ({...item, score: cosineSimilarity(query, item.embedding)}))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}
```

**LangChain 1.x 手动实现**（因 `MemoryVectorStore` 被移除）：
```typescript
class InMemoryVectorStore extends VectorStore {
  private docs: Array<{document: Document, embedding: number[]}> = [];

  // 必须实现的抽象方法 1：文档入库
  async addDocuments(documents: Document[]): Promise<void> {
    for (const doc of documents) {
      const embedding = await this.embeddings.embedQuery(doc.pageContent);
      this.docs.push({document, embedding});
    }
  }

  // 必须实现的抽象方法 2：批量向量入库
  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    for (let i = 0; i < vectors.length; i++) {
      this.docs.push({document: documents[i], embedding: vectors[i]});
    }
  }

  // 必须实现的抽象方法 3：向量搜索
  async similaritySearchVectorWithScore(query, k): Promise<[Document, number][]> {
    return this.docs
      .map(({document, embedding}) => ({document, score: cosineSimilarity(query, embedding)}))
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(r => [r.document, r.score]);
  }
}
```

**学习收获**：通过实现 `VectorStore` 基类，理解了 LangChain 的抽象设计：
- `addDocuments` vs `addVectors` 分离 —— 支持批量嵌入优化
- `similaritySearchVectorWithScore` —— 统一接口，子类只关心相似度算法
- `asRetriever()` —— 适配器模式，将 VectorStore 转为 Retriever

### 2.4 LCEL RAG Chain

**自研方案**（`rag-service.ts`）：
```typescript
async function ragAnswer(question: string) {
  // 1. 嵌入查询
  const queryEmbedding = await getProvider().embed(question);
  // 2. 检索
  const docs = await vectorStore.search(queryEmbedding, 5);
  // 3. 手动拼接 context
  const context = docs.map(d => d.content).join("\n\n");
  // 4. 调用 LLM
  const result = await getProvider().complete({
    messages: [
      {role: "system", content: `基于以下上下文回答：\n${context}`},
      {role: "user", content: question},
    ],
  });
  return result.content;
}
```

**LangChain LCEL 方案**：
```typescript
const chain = RunnableSequence.from([
  {
    context: async (input) => {
      const docs = await retriever.invoke(input.question);
      return docs.map(d => d.pageContent).join("\n\n---\n\n");
    },
    question: (input) => input.question,
  },
  ragPrompt,           // ChatPromptTemplate
  model,               // ChatOpenAI
  new StringOutputParser(),
]);

const answer = await chain.invoke({question: "..."});
```

**核心差异**：
- 自研：4 步命令式，每步手动串联
- LangChain：声明式 `RunnableSequence`，每步是独立 Runnable，可单独测试/替换

---

## 三、技术架构

### 3.1 文件结构

```
src/server/langchain/
├── tools-adapter.ts   # 自研 Tool → DynamicTool 适配
└── rag.ts            # TextSplitter + InMemoryVectorStore + RAG Chain

src/app/api/langchain/
├── tools/route.ts    # GET 工具对比 / POST 工具执行
└── rag/route.ts      # POST 分块对比 / RAG 查询
```

### 3.2 数据流

```
自研 RAG 流程：
  documentService.createDocument() → chunkText(500字) → embed() → 存储
  ragService.retrieve() → embed(query) → cosine → 排序

LangChain RAG 流程：
  RecursiveCharacterTextSplitter → InMemoryVectorStore.addDocuments()
  → embedDocuments() → 存储
  retriever.invoke() → similaritySearchVectorWithScore() → 排序
  → LCEL Chain: retriever → prompt → model → parser
```

---

## 四、技术扩展

### 4.1 多种 VectorStore 后端

LangChain 支持多种向量数据库，切换只需改 import：
```typescript
// 内存（学习用）
import { InMemoryVectorStore } from "./rag";

// Pinecone（生产）
import { PineconeStore } from "@langchain/pinecone";

// Chroma（自部署）
import { Chroma } from "@langchain/community/vectorstores/chroma";

// pgvector（与自研一致）
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
```

所有 VectorStore 实现相同接口，RAG Chain 无需修改。

### 4.2 Advanced Retrieval 策略

LangChain 提供多种检索策略（自研只有 cosine）：
- **MMR (Maximum Marginal Relevance)** —— 多样性优化
- **Parent Document Retriever** —— 小块检索，大块返回
- **Multi-Query Retriever** —— LLM 生成多个查询变体
- **Ensemble Retriever** —— 混合检索（向量 + 关键词）

### 4.3 DocumentLoader 生态

LangChain 内置 50+ DocumentLoader：
- `TextLoader` / `PDFLoader` / `CSVLoader`
- `WebBaseLoader`（网页抓取）
- `GitLoader`（代码仓库）
- `NotionDBLoader` / `ConfluenceLoader`

对比自研：`read_file.ts` 和 `read_pdf.ts` 手写解析，功能有限。

---

## 五、示例

### 5.1 分块对比实验

```bash
curl -X POST http://localhost:3000/api/langchain/rag \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "compare-chunking",
    "text": "这是第一段很长的文本...\n\n这是第二段..."
  }'
```

返回：
```json
{
  "builtin": {"count": 3, "avgLength": 480},
  "langchain": {"count": 4, "avgLength": 350}
}
```

### 5.2 工具对比查询

```bash
curl http://localhost:3000/api/langchain/tools
```

返回 8 个工具的自研/LangChain 适配信息。

### 5.3 RAG 查询

```bash
curl -X POST http://localhost:3000/api/langchain/rag \
  -H "Content-Type: application/json" \
  -d '{"question": "什么是 LRU 缓存？"}'
```

---

## 六、验收结果

- 8 个自研工具可通过 `DynamicTool` 调用
- `RecursiveCharacterTextSplitter` 正确分块
- 手动实现的 `InMemoryVectorStore` 通过 `VectorStore` 基类抽象
- LCEL RAG Chain 端到端问答
- 分块对比 API 可视化两种方案差异
- `pnpm run typecheck` 0 错误
- `pnpm run lint` 0 警告

## 七、关键学习点

1. **LangChain 1.x 的破坏性变更** —— 移除了 `MemoryVectorStore` 和 `RetrievalQAChain`，需要手动实现
2. **VectorStore 抽象设计** —— `addDocuments`/`addVectors`/`similaritySearchVectorWithScore` 三方法分离
3. **递归分块 vs 固定分块** —— 语义完整性优先
4. **LCEL 声明式链** —— 每步独立可测试，优于命令式串联
5. **适配器模式** —— `asRetriever()` 将 VectorStore 转为 Retriever
