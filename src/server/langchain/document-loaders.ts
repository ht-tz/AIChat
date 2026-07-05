// M17 补全：DocumentLoader 集成
// 学习目标：LangChain 的文档加载抽象 vs 自研 read_file/read_pdf 工具
// 对比自研：src/server/tools/builtin/read_file.ts + read_pdf.ts
//
// 核心差异：
// 1. 自研：两个独立工具，返回结构化 JSON（filename/content/size...）
// 2. LangChain：统一 DocumentLoader 抽象，load() → Document[]
// 3. LangChain 50+ Loader：TextLoader/PDFLoader/WebBaseLoader/...

import { Document } from "@langchain/core/documents";
import { readFile } from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { files } from "@/server/db/schema";

// ============================================================
// 0. TextLoader —— 手动实现（学习 LangChain 的 DocumentLoader 抽象）
// ============================================================
// 学习点：LangChain 1.x 移除了 langchain/document_loaders/fs/text 子路径
// 我们手动实现一个 TextLoader，学习 LangChain DocumentLoader 的设计思想
//
// LangChain DocumentLoader 设计模式：
// - 基类: TextLoader / DirectoryLoader / PDFLoader
// - 核心方法: load(): Promise<Document[]>
// - 输出: Document[]（pageContent + metadata）
// - 下游: 可直接 pipe TextSplitter / VectorStore

/**
 * 手动实现的 TextLoader（学习 LangChain 抽象）
 * 功能：从文件路径加载文本，返回 Document[]
 */
class TextLoader {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async load(): Promise<Document[]> {
    const content = await readFile(this.filePath, "utf-8");
    return [
      new Document({
        pageContent: content,
        metadata: {
          source: this.filePath,
          loader: "TextLoader",
        },
      }),
    ];
  }
}

/**
 * 手动实现的 MockPDFLoader（学习 LangChain PDFLoader 抽象）
 * 功能：模拟 PDF 加载，每页一个 Document
 * 真实环境可用 pdf-parse + @langchain/community/document_loaders/fs/pdf
 */
class MockPDFLoader {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async load(): Promise<Document[]> {
    const pages = [
      {
        page: 1,
        content:
          "人工智能（Artificial Intelligence，AI）是计算机科学的一个分支，致力于研究、开发用于模拟、延伸和扩展人的智能的理论、方法、技术及应用系统。人工智能领域的研究包括机器人、语言识别、图像识别、自然语言处理和专家系统等。",
      },
      {
        page: 2,
        content:
          "机器学习（Machine Learning）是人工智能的核心技术之一，它使计算机系统能够从数据中学习并改进性能，而无需进行明确编程。机器学习算法使用统计技术让计算机从数据中学习。",
      },
      {
        page: 3,
        content:
          "深度学习（Deep Learning）是机器学习的一个子集，使用多层神经网络来模拟人脑的学习过程。深度学习在图像识别、语音识别、自然语言处理等领域取得了突破性进展。",
      },
    ];

    return pages.map(
      (p) =>
        new Document({
          pageContent: p.content,
          metadata: {
            source: this.filePath,
            pdf: { pageNumber: p.page, totalPages: pages.length },
            loc: { pageNumber: p.page },
            loader: "MockPDFLoader",
          },
        }),
    );
  }
}

// ============================================================
// 1. 自研加载器（作为对比基准）
// ============================================================

/**
 * 自研文件读取 —— 从数据库查记录 + fs.readFile
 * 对应 read_file 工具的核心逻辑
 */
async function loadTextFileBuiltin(fileId: string): Promise<{
  content: string;
  metadata: { source: string; filename: string; size: number };
}> {
  if (!db) throw new Error("Database not available");

  const [fileRecord] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);

  if (!fileRecord) throw new Error(`File not found: ${fileId}`);

  const filePath = path.isAbsolute(fileRecord.path)
    ? fileRecord.path
    : path.join(process.cwd(), fileRecord.path);

  const content = await readFile(filePath, "utf-8");

  return {
    content,
    metadata: {
      source: fileId,
      filename: fileRecord.originalName,
      size: fileRecord.size,
    },
  };
}

/**
 * 自研 PDF 读取 —— Mock 实现（extractTextFromPdf）
 * 对应 read_pdf 工具的核心逻辑
 */
function loadPdfBuiltin(
  filePath: string,
  pageStart?: number,
  pageEnd?: number,
): {
  content: string;
  metadata: { source: string; pageStart: number; pageEnd: number | string; charCount: number };
} {
  const content = `这是一个模拟的 PDF 文档内容提取结果。

文件名：${filePath}
页码范围：${pageStart || 1} - ${pageEnd || "全部"}

文档内容：
----------

第 ${pageStart || 1} 页：
人工智能（Artificial Intelligence，AI）是计算机科学的一个分支，致力于研究、开发用于模拟、延伸和扩展人的智能的理论、方法、技术及应用系统。人工智能领域的研究包括机器人、语言识别、图像识别、自然语言处理和专家系统等。

第 ${(pageStart || 1) + 1} 页：
机器学习（Machine Learning）是人工智能的核心技术之一，它使计算机系统能够从数据中学习并改进性能，而无需进行明确编程。机器学习算法使用统计技术让计算机从数据中学习。

第 ${(pageStart || 1) + 2} 页：
深度学习（Deep Learning）是机器学习的一个子集，使用多层神经网络来模拟人脑的学习过程。深度学习在图像识别、语音识别、自然语言处理等领域取得了突破性进展。

----------
提取完成。实际应用中，此工具会使用 PDF 解析库（如 pdf-parse）来提取真实内容。`;

  return {
    content,
    metadata: {
      source: filePath,
      pageStart: pageStart || 1,
      pageEnd: pageEnd || "全部",
      charCount: content.length,
    },
  };
}

// ============================================================
// 2. LangChain DocumentLoader
// ============================================================

/**
 * LangChain 文本文件加载 —— TextLoader
 * 特点：
 * - 统一返回 Document[]（pageContent + metadata）
 * - 自动处理编码
 * - 可直接传给 TextSplitter / VectorStore
 */
async function loadTextFileLangChain(fileId: string): Promise<Document[]> {
  if (!db) throw new Error("Database not available");

  const [fileRecord] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);

  if (!fileRecord) throw new Error(`File not found: ${fileId}`);

  const filePath = path.isAbsolute(fileRecord.path)
    ? fileRecord.path
    : path.join(process.cwd(), fileRecord.path);

  const loader = new TextLoader(filePath);
  const docs = await loader.load();

  // 补充元数据
  docs.forEach((doc) => {
    doc.metadata.source = fileId;
    doc.metadata.filename = fileRecord.originalName;
    doc.metadata.size = fileRecord.size;
  });

  return docs;
}

/**
 * LangChain PDF 加载 —— 用 MockPDFLoader（学习演示）
 * 真实环境可用 @langchain/community/document_loaders/fs/pdf + pdf-parse
 */
async function loadPdfLangChain(filePath: string): Promise<Document[]> {
  const loader = new MockPDFLoader(filePath);
  return loader.load();
}

/**
 * 构建模拟 PDF Document 列表（用于学习演示）
 * 每页一个 Document，模拟真实 PDFLoader 的输出格式
 */
function buildMockPdfDocuments(filePath: string): Document[] {
  // 同步版本：直接构造 Document 数组（对比用）
  const pages = [
    { page: 1, content: "人工智能（Artificial Intelligence，AI）是计算机科学的一个分支..." },
    { page: 2, content: "机器学习（Machine Learning）是人工智能的核心技术之一..." },
    { page: 3, content: "深度学习（Deep Learning）是机器学习的一个子集..." },
  ];
  return pages.map(
    (p) =>
      new Document({
        pageContent: p.content,
        metadata: { source: filePath, pdf: { pageNumber: p.page }, loc: { pageNumber: p.page } },
      }),
  );
}

// ============================================================
// 3. 统一加载器 —— 根据文件类型自动选择 Loader
// ============================================================

export interface LoadResult {
  docs: Document[];
  loader: "builtin" | "langchain";
  fileType: "text" | "pdf" | "unknown";
  totalChars: number;
}

/**
 * 从字符串内容创建 Document（用于 API 直接传文本的场景）
 */
export function createDocumentsFromText(text: string, source: string = "inline"): Document[] {
  return [
    new Document({
      pageContent: text,
      metadata: { source },
    }),
  ];
}

/**
 * 对比加载器 —— 同一文件用两种方式加载，对比结果
 */
export async function compareLoaders(fileId: string): Promise<{
  builtin: { content: string; metadata: Record<string, unknown>; totalChars: number };
  langchain: { docCount: number; totalChars: number; sampleMetadata: Record<string, unknown> };
}> {
  // 自研加载
  const builtinResult = await loadTextFileBuiltin(fileId);

  // LangChain 加载
  const langchainDocs = await loadTextFileLangChain(fileId);
  const langchainTotal = langchainDocs.reduce((sum, d) => sum + d.pageContent.length, 0);

  return {
    builtin: {
      content: builtinResult.content.slice(0, 200) + "...",
      metadata: builtinResult.metadata,
      totalChars: builtinResult.content.length,
    },
    langchain: {
      docCount: langchainDocs.length,
      totalChars: langchainTotal,
      sampleMetadata: langchainDocs[0]?.metadata || {},
    },
  };
}

/**
 * 对比 PDF 加载器
 */
export function comparePdfLoaders(filePath: string): {
  builtin: { totalChars: number; pages: string };
  langchain: { docCount: number; totalChars: number; pageMetadata: unknown[] };
} {
  // 自研加载
  const builtinResult = loadPdfBuiltin(filePath);

  // LangChain 加载（Mock）
  const langchainDocs = buildMockPdfDocuments(filePath);
  const langchainTotal = langchainDocs.reduce((sum, d) => sum + d.pageContent.length, 0);

  return {
    builtin: {
      totalChars: builtinResult.metadata.charCount,
      pages: String(builtinResult.metadata.pageEnd),
    },
    langchain: {
      docCount: langchainDocs.length,
      totalChars: langchainTotal,
      pageMetadata: langchainDocs.map((d) => d.metadata),
    },
  };
}

// ============================================================
// 4. 学习辅助 —— Loader 对比
// ============================================================

export function getLoaderComparison() {
  return {
    textLoader: {
      selfBuilt: {
        name: "read_file 工具",
        file: "src/server/tools/builtin/read_file.ts",
        output: "{ filename, content, size, url }",
        metadata: "手动构造",
        downstream: "需手动转 Document 才能用 TextSplitter",
      },
      langchain: {
        name: "TextLoader",
        import: "langchain/document_loaders/fs/text",
        output: "Document[]（pageContent + metadata）",
        metadata: "自动补充（source、line 等）",
        downstream: "可直接 pipe TextSplitter / VectorStore",
      },
    },
    pdfLoader: {
      selfBuilt: {
        name: "read_pdf 工具（Mock）",
        file: "src/server/tools/builtin/read_pdf.ts",
        output: "{ content, pageStart, pageEnd, charCount }",
        pagination: "单字符串，无分页结构",
        realParsing: false,
      },
      langchain: {
        name: "PDFLoader",
        import: "@langchain/community/document_loaders/fs/pdf",
        output: "Document[]（每页一个 Document）",
        pagination: "metadata.loc.pageNumber",
        realParsing: true,
      },
    },
    loaderEcosystem: {
      total: "50+ 内置 Loader",
      categories: [
        "文件类：Text/PDF/CSV/JSON/Markdown/HTML/EPUB",
        "网页类：WebBaseLoader/CheerioWebBaseLoader",
        "数据库类：Postgres/MySQL/MongoDB/Redis",
        "云服务类：S3/GoogleCloud/Azure",
        "协作类：Notion/Confluence/Slack/Discord/GitHub",
        "音视频类：YouTube/Whisper",
      ],
    },
  };
}

// ============================================================
// 5. 导出加载函数（供其他模块调用）
// ============================================================

export {
  loadTextFileBuiltin,
  loadPdfBuiltin,
  loadTextFileLangChain,
  loadPdfLangChain,
  buildMockPdfDocuments,
};
