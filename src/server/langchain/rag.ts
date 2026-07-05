// M17: LangChain RAG 管线
// 学习目标：使用 LangChain 的 TextSplitter + VectorStore 基础类 + LCEL Chain
// 对比：自研 document-service.ts + vector-store.ts + rag-service.ts
//
// 核心差异：
// 1. 自研分块：固定 500 字符 + 句子/换行/空格回溯
// 2. LangChain 分块：RecursiveCharacterTextSplitter 递归分块
// 3. 自研检索：手写 cosine similarity 排序
// 4. LangChain：使用 VectorStore 基础类 + Embeddings 抽象
//
// 注意：LangChain 1.x 移除了 MemoryVectorStore 和 RetrievalQAChain
// 我们使用 @langchain/core 的 VectorStore 基类 + LCEL pipe 实现

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { VectorStore } from "@langchain/core/vectorstores";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { ChatOpenAI } from "@langchain/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { cosineSimilarity, parseEmbedding, stringifyEmbedding } from "@/server/memory";
import { documentService } from "@/server/knowledge/document-service";

/**
 * 1. TextSplitter 对比实验
 *
 * 自研方案（document-service.ts）：
 *   固定 CHUNK_SIZE=500，CHUNK_OVERLAP=100
 *   回溯找句号/换行/空格作为分割点
 *
 * LangChain 方案：
 *   RecursiveCharacterTextSplitter 递归分块
 *   按 ["\n\n", "\n", "。", ".", " ", ""] 递归尝试
 */
export function createTextSplitter(chunkSize: number = 500, chunkOverlap: number = 100) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
    separators: ["\n\n", "\n", "。", ".", " ", ""],
  });
  return splitter;
}

/**
 * 对比分块结果
 */
export async function compareChunking(text: string) {
  // 自研分块
  const builtinChunks: string[] = [];
  const CHUNK_SIZE = 500;
  const CHUNK_OVERLAP = 100;
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE, text.length);
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf(".", end);
      const lastNewline = text.lastIndexOf("\n", end);
      const lastSpace = text.lastIndexOf(" ", end);
      const bestSplit = Math.max(lastPeriod, lastNewline, lastSpace);
      if (bestSplit > start + CHUNK_SIZE / 2) end = bestSplit + 1;
    }
    builtinChunks.push(text.slice(start, end).trim());
    start = end - CHUNK_OVERLAP;
    if (start < 0) start = 0;
  }

  // LangChain 分块
  const splitter = createTextSplitter();
  const langchainChunks = await splitter.splitText(text);

  const builtinFiltered = builtinChunks.filter((c) => c.length > 50);

  return {
    builtin: {
      count: builtinFiltered.length,
      chunks: builtinFiltered,
      avgLength: Math.round(
        builtinFiltered.reduce((s, c) => s + c.length, 0) / Math.max(builtinFiltered.length, 1),
      ),
    },
    langchain: {
      count: langchainChunks.length,
      chunks: langchainChunks,
      avgLength: Math.round(
        langchainChunks.reduce((s, c) => s + c.length, 0) / Math.max(langchainChunks.length, 1),
      ),
    },
  };
}

/**
 * 2. InMemoryVectorStore —— 轻量向量存储
 *
 * 学习目的：继承 VectorStore 基类，实现 similaritySearchVectorWithScore
 * 对比自研 vectorStore.ts 的手写 cosine similarity 搜索
 *
 * LangChain 1.x 移除了 MemoryVectorStore，我们手动实现
 * 这正好帮助理解 VectorStore 抽象的设计
 */
class InMemoryVectorStore extends VectorStore {
  private docs: Array<{ document: Document; embedding: number[] }> = [];

  constructor(embeddings: OpenAIEmbeddings) {
    super(embeddings, {});
  }

  _vectorstoreType(): string {
    return "in-memory";
  }

  /**
   * 实现抽象方法 addDocuments —— 文档入库
   * LangChain 1.x 中 addDocuments 也是抽象方法
   * 流程：documents → 逐个 embedQuery → 存入内存
   */
  async addDocuments(documents: Document[]): Promise<void> {
    for (const doc of documents) {
      const embedding = await this.embeddings.embedQuery(doc.pageContent);
      this.docs.push({ document: doc, embedding });
    }
  }

  /**
   * 实现抽象方法 addVectors —— 批量存储已嵌入的向量
   * 注意：基类 VectorStore 1.x 要求同时实现 addDocuments 和 addVectors
   */
  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    for (let i = 0; i < vectors.length; i++) {
      this.docs.push({ document: documents[i], embedding: vectors[i] });
    }
  }

  async similaritySearchVectorWithScore(query: number[], k: number): Promise<[Document, number][]> {
    const results = this.docs
      .map(({ document, embedding }) => ({
        document,
        score: cosineSimilarity(query, embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);

    return results.map((r) => [r.document, r.score]);
  }

  static async fromDocuments(
    documents: Document[],
    embeddings: OpenAIEmbeddings,
  ): Promise<InMemoryVectorStore> {
    const store = new InMemoryVectorStore(embeddings);
    await store.addDocuments(documents);
    return store;
  }

  static async fromTexts(
    texts: string[],
    metadatas: object[],
    embeddings: OpenAIEmbeddings,
  ): Promise<InMemoryVectorStore> {
    const docs = texts.map(
      (text, i) => new Document({ pageContent: text, metadata: metadatas[i] ?? {} }),
    );
    return InMemoryVectorStore.fromDocuments(docs, embeddings);
  }
}

/**
 * 3. 创建 VectorStore（从已有知识库文档加载）
 *
 * 对比自研方案：documentService.listDocuments() → 手动遍历 chunks → cosine similarity
 */
export async function createVectorStoreFromDocuments(): Promise<InMemoryVectorStore> {
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY ?? "",
    configuration: {
      baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    },
    modelName: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
  });

  const docs = documentService.listDocuments();
  const langchainDocs: Document[] = [];

  for (const doc of docs) {
    for (const chunk of doc.chunks) {
      langchainDocs.push(
        new Document({
          pageContent: chunk.content,
          metadata: {
            documentId: doc.id,
            title: doc.title,
            chunkIndex: chunk.index,
          },
        }),
      );
    }
  }

  if (langchainDocs.length === 0) {
    // 没有文档时返回空 store
    return new InMemoryVectorStore(embeddings);
  }

  return InMemoryVectorStore.fromDocuments(langchainDocs, embeddings);
}

/**
 * 4. LCEL RAG Chain —— 端到端检索增强生成
 *
 * 自研方案（rag-service.ts）：
 *   1. getProvider().embed(query)
 *   2. vectorStore.search(queryEmbedding)
 *   3. 手动拼接 context
 *   4. getProvider().complete({ messages: [...] })
 *
 * LangChain LCEL 方案：
 *   RunnableSequence: retriever → formatContext → prompt → model → parser
 *
 * LCEL (LangChain Expression Language) 使用 pipe 语法串联组件
 */
export async function createRAGChain() {
  const model = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY ?? "",
    configuration: {
      baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    },
    modelName: process.env.DEFAULT_MODEL ?? "gpt-4o-mini",
    temperature: 0.3,
  });

  const vectorStore = await createVectorStoreFromDocuments();
  const retriever = vectorStore.asRetriever({ k: 5 });

  // RAG Prompt
  const ragPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `你是一个知识助手。基于以下检索到的上下文回答用户问题。
如果上下文中没有相关信息，请诚实说明。

上下文：
{context}`,
    ],
    ["human", "{question}"],
  ]);

  // LCEL Chain: 检索 → 格式化 → 提示词 → 模型 → 解析
  const chain = RunnableSequence.from([
    {
      // 步骤 1：检索相关文档
      context: async (input: { question: string }) => {
        const docs = await retriever.invoke(input.question);
        return docs.map((d) => d.pageContent).join("\n\n---\n\n");
      },
      question: (input: { question: string }) => input.question,
    },
    ragPrompt, // 步骤 2：填充提示词模板
    model, // 步骤 3：调用 LLM
    new StringOutputParser(), // 步骤 4：解析输出
  ]);

  return { chain, retriever };
}

/**
 * 5. 执行 RAG 查询
 */
export async function ragQuery(question: string) {
  const { chain, retriever } = await createRAGChain();

  const answer = await chain.invoke({ question });

  // 获取来源文档
  const sourceDocs = await retriever.invoke(question);
  const sources = sourceDocs.map((doc: Document) => ({
    content: doc.pageContent.slice(0, 150) + "...",
    metadata: doc.metadata,
  }));

  return { answer, sourceDocuments: sources };
}
