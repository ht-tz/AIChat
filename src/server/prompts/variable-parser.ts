// 提示词变量解析器 —— 提取 {{variable}} 并插值

import type { PromptVariable } from "@/server/db/schema";

const VAR_PATTERN = /\{\{(\w+)\}\}/g;

/** 从模板文本中提取所有变量名（去重） */
export function extractVariables(text: string): string[] {
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(VAR_PATTERN);
  while ((m = re.exec(text)) !== null) {
    names.add(m[1]);
  }
  return Array.from(names);
}

/** 将模板中的 {{variable}} 替换为实际值 */
export function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(VAR_PATTERN, (full, name: string) => {
    return values[name] ?? full;
  });
}

/** 合并变量定义与用户输入，返回最终值映射 */
export function resolveVariables(
  definitions: PromptVariable[],
  userInput: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const def of definitions) {
    result[def.name] = userInput[def.name] ?? def.defaultValue ?? "";
  }
  return result;
}

/** 校验必填变量是否已填 */
export function validateVariables(
  definitions: PromptVariable[],
  userInput: Record<string, string>,
): string[] {
  const missing: string[] = [];
  for (const def of definitions) {
    const val = userInput[def.name] ?? def.defaultValue ?? "";
    if (!val.trim()) {
      missing.push(def.name);
    }
  }
  return missing;
}
