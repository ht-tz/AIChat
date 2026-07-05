// 工具选择策略 —— 基于规则 + 记忆驱动的工具选择

/** 策略规则 */
export interface ToolRule {
  toolName: string;
  action: "prefer" | "allow" | "deny";
  condition?: string; // 触发条件描述
  priority?: number; // 优先级，数值越高越优先
}

/** 工具选择结果 */
export interface ToolSelection {
  selectedTools: string[];
  rejectedTools: string[];
  reasoning: string;
}

/** 默认策略规则 */
export const DEFAULT_TOOL_RULES: ToolRule[] = [
  { toolName: "calculator", action: "prefer", condition: "包含数学表达式", priority: 10 },
  { toolName: "web_search", action: "prefer", condition: "需要搜索信息", priority: 8 },
  { toolName: "code_runner", action: "prefer", condition: "需要执行代码", priority: 8 },
  { toolName: "get_current_time", action: "allow", condition: "询问时间", priority: 5 },
  { toolName: "word_count", action: "allow", condition: "统计字数", priority: 5 },
  { toolName: "read_file", action: "allow", condition: "读取文件", priority: 6 },
  { toolName: "generate_image", action: "allow", condition: "生成图片", priority: 7 },
  { toolName: "summarize_report", action: "allow", condition: "生成报告", priority: 6 },
];

/** 基于规则选择工具 */
export function selectToolsByRules(
  availableTools: string[],
  rules: ToolRule[],
  userMessage: string,
): ToolSelection {
  const selected: string[] = [];
  const rejected: string[] = [];
  const reasons: string[] = [];
  const lower = userMessage.toLowerCase();

  // 构建规则映射
  const ruleMap = new Map<string, ToolRule>();
  for (const rule of rules) {
    ruleMap.set(rule.toolName, rule);
  }

  // 关键词匹配选择工具
  const keywordMap: Record<string, string[]> = {
    calculator: ["计算", "算", "加", "减", "乘", "除", "math", "calc", "+"],
    web_search: ["搜索", "查找", "查询", "search", "find", "了解"],
    code_runner: ["运行", "执行代码", "run", "code", "js", "python"],
    get_current_time: ["时间", "几点", "time", "date", "日期"],
    word_count: ["统计", "字数", "count", "字符"],
    read_file: ["读取", "文件", "read", "file"],
    generate_image: ["画", "生成图片", "image", "图", "图片"],
    summarize_report: ["报告", "导出", "report", "总结"],
  };

  for (const tool of availableTools) {
    const rule = ruleMap.get(tool);
    const keywords = keywordMap[tool] || [];

    // 检查是否被禁止
    if (rule?.action === "deny") {
      rejected.push(tool);
      reasons.push(`${tool}: 策略禁止`);
      continue;
    }

    // 检查关键词匹配
    const matched = keywords.some((kw) => lower.includes(kw));

    if (matched) {
      selected.push(tool);
      reasons.push(`${tool}: 关键词匹配 + 策略${rule?.action || "allow"}`);
    }
  }

  // 按优先级排序
  selected.sort((a, b) => {
    const prioA = ruleMap.get(a)?.priority ?? 0;
    const prioB = ruleMap.get(b)?.priority ?? 0;
    return prioB - prioA;
  });

  return {
    selectedTools: selected,
    rejectedTools: rejected,
    reasoning: reasons.join("; "),
  };
}

/** 记忆驱动的工具选择优化 */
export function optimizeWithMemory(
  selection: ToolSelection,
  successHistory: Array<{ toolName: string; success: boolean }>,
): ToolSelection {
  // 统计各工具的成功率
  const stats = new Map<string, { success: number; total: number }>();
  for (const record of successHistory) {
    const s = stats.get(record.toolName) || { success: 0, total: 0 };
    s.total++;
    if (record.success) s.success++;
    stats.set(record.toolName, s);
  }

  // 降低成功率低的工具优先级
  const optimized = selection.selectedTools.filter((tool) => {
    const s = stats.get(tool);
    if (!s || s.total < 3) return true; // 数据不足，保留
    const successRate = s.success / s.total;
    return successRate > 0.3; // 成功率低于 30% 则移除
  });

  // 添加记忆驱动的建议
  const memoryReasons: string[] = [];
  for (const tool of selection.selectedTools) {
    const s = stats.get(tool);
    if (s && s.total >= 3) {
      const rate = Math.round((s.success / s.total) * 100);
      memoryReasons.push(`${tool}: 历史成功率 ${rate}%`);
    }
  }

  return {
    selectedTools: optimized,
    rejectedTools: selection.rejectedTools,
    reasoning:
      selection.reasoning + (memoryReasons.length > 0 ? `; 记忆: ${memoryReasons.join(", ")}` : ""),
  };
}
