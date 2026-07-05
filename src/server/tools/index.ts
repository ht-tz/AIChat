// 工具入口：注册所有内置工具

import { toolRegistry } from "./registry";
import { calculatorTool } from "./builtin/calculator";
import { getCurrentTimeTool } from "./builtin/get_current_time";
import { webSearchTool } from "./builtin/web_search";
import { codeRunnerTool } from "./builtin/code_runner";
import { wordCountTool } from "./builtin/word_count";
import { readFileTool } from "./builtin/read_file";
import { generateImageTool } from "./builtin/generate_image";
import { readPdfTool } from "./builtin/read_pdf";

let registered = false;

/** 注册全部内置工具（幂等） */
export function registerBuiltinTools() {
  if (registered) return;
  toolRegistry.register(calculatorTool);
  toolRegistry.register(getCurrentTimeTool);
  toolRegistry.register(webSearchTool);
  toolRegistry.register(codeRunnerTool);
  toolRegistry.register(wordCountTool);
  toolRegistry.register(readFileTool);
  toolRegistry.register(generateImageTool);
  toolRegistry.register(readPdfTool);
  registered = true;
}

// 默认就注册（Next.js 单进程无需延迟）
registerBuiltinTools();

export { toolRegistry };
export * from "./types";
