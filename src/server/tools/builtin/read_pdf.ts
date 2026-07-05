// read_pdf —— PDF 文档解析工具

import { z } from "zod";
import type { Tool } from "../types";

const Params = z.object({
  filePath: z.string().describe("PDF 文件路径"),
  pageStart: z.number().min(1).optional().describe("起始页码，从1开始"),
  pageEnd: z.number().optional().describe("结束页码"),
});

export const readPdfTool: Tool<typeof Params> = {
  name: "read_pdf",
  description: "读取 PDF 文档内容。支持指定页码范围。",
  parameters: Params,
  execute: async (args) => {
    const text = extractTextFromPdf(args.filePath, args.pageStart, args.pageEnd);
    return {
      content: text,
      pageStart: args.pageStart || 1,
      pageEnd: args.pageEnd || "全部",
      charCount: text.length,
    };
  },
  toDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "PDF 文件路径" },
          pageStart: { type: "number", description: "起始页码" },
          pageEnd: { type: "number", description: "结束页码" },
        },
        required: ["filePath"],
      },
    };
  },
};

function extractTextFromPdf(filePath: string, pageStart?: number, pageEnd?: number): string {
  const samplePdfContent = `这是一个模拟的 PDF 文档内容提取结果。

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
提取完成。实际应用中，此工具会使用 PDF 解析库（如 pdf-parse）来提取真实内容。
`;

  return samplePdfContent;
}
