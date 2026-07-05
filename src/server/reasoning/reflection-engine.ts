// 反思增强 —— 结构化自省 + 自我修正 + 失败恢复

/** 错误类型分类 */
export type ErrorCategory =
  | "tool_not_found" // 工具不存在
  | "tool_execution" // 工具执行失败
  | "invalid_input" // 输入参数错误
  | "timeout" // 超时
  | "context_overflow" // 上下文溢出
  | "model_error" // 模型错误
  | "unknown"; // 未知错误

/** 恢复策略 */
export type RecoveryStrategy =
  | "retry" // 重试（相同参数）
  | "retry_modified" // 重试（修改参数）
  | "skip" // 跳过
  | "degrade" // 降级（使用替代方案）
  | "abort"; // 中止

/** 反思结果 */
export interface ReflectionResult {
  success: boolean;
  errorCategory: ErrorCategory;
  errorAnalysis: string;
  recoveryStrategy: RecoveryStrategy;
  modifiedArgs?: Record<string, unknown>;
  suggestion: string;
  confidence: number; // 0-1，对恢复策略的信心
}

/** 分析错误类型 */
export function categorizeError(error: string): ErrorCategory {
  const lower = error.toLowerCase();

  if (lower.includes("not found") || lower.includes("不存在") || lower.includes("no such tool")) {
    return "tool_not_found";
  }
  if (lower.includes("execution") || lower.includes("执行失败") || lower.includes("runtime")) {
    return "tool_execution";
  }
  if (lower.includes("invalid") || lower.includes("参数错误") || lower.includes("validation")) {
    return "invalid_input";
  }
  if (lower.includes("timeout") || lower.includes("超时") || lower.includes("timed out")) {
    return "timeout";
  }
  if (lower.includes("overflow") || lower.includes("too long") || lower.includes("超出")) {
    return "context_overflow";
  }
  if (lower.includes("model") || lower.includes("api") || lower.includes("rate limit")) {
    return "model_error";
  }

  return "unknown";
}

/** 根据错误类型选择恢复策略 */
export function selectRecoveryStrategy(
  category: ErrorCategory,
  retryCount: number,
  maxRetries: number,
): RecoveryStrategy {
  if (retryCount >= maxRetries) {
    return category === "tool_not_found" ? "degrade" : "abort";
  }

  switch (category) {
    case "tool_not_found":
      return "degrade"; // 尝试替代方案
    case "tool_execution":
      return "retry"; // 重试可能解决临时问题
    case "invalid_input":
      return "retry_modified"; // 修改参数后重试
    case "timeout":
      return "retry"; // 重试可能成功
    case "context_overflow":
      return "degrade"; // 降级处理
    case "model_error":
      return retryCount < 1 ? "retry" : "abort";
    case "unknown":
    default:
      return retryCount < 1 ? "retry" : "abort";
  }
}

/** 执行结构化反思 */
export function reflect(
  error: string,
  toolName: string | undefined,
  toolArgs: Record<string, unknown> | undefined,
  retryCount: number,
  maxRetries: number,
): ReflectionResult {
  const category = categorizeError(error);
  const strategy = selectRecoveryStrategy(category, retryCount, maxRetries);

  let analysis = "";
  let suggestion = "";
  let modifiedArgs: Record<string, unknown> | undefined;
  let confidence = 0.5;

  switch (category) {
    case "tool_not_found":
      analysis = `工具 "${toolName}" 不存在或未启用`;
      suggestion = "尝试使用可用的替代工具，或检查工具是否已启用";
      confidence = 0.7;
      break;
    case "tool_execution":
      analysis = `工具 "${toolName}" 执行过程中发生错误`;
      suggestion = "可能是临时问题，建议重试";
      confidence = 0.6;
      break;
    case "invalid_input":
      analysis = `工具 "${toolName}" 收到无效参数`;
      suggestion = "检查并修正输入参数";
      if (toolArgs) {
        modifiedArgs = { ...toolArgs };
        // 尝试修正常见参数问题
        for (const [key, val] of Object.entries(modifiedArgs)) {
          if (typeof val === "string" && val.trim() === "") {
            modifiedArgs[key] = "0"; // 空字符串替换为默认值
          }
        }
      }
      confidence = 0.8;
      break;
    case "timeout":
      analysis = `工具 "${toolName}" 执行超时`;
      suggestion = "可能是网络或计算资源问题，建议重试";
      confidence = 0.5;
      break;
    case "context_overflow":
      analysis = "上下文长度超出限制";
      suggestion = "尝试缩短输入或使用摘要";
      confidence = 0.4;
      break;
    case "model_error":
      analysis = "模型调用出错";
      suggestion = "可能是 API 限流，等待后重试";
      confidence = 0.3;
      break;
    default:
      analysis = `未知错误: ${error}`;
      suggestion = "建议重试或跳过当前步骤";
      confidence = 0.2;
  }

  return {
    success: false,
    errorCategory: category,
    errorAnalysis: analysis,
    recoveryStrategy: strategy,
    modifiedArgs,
    suggestion,
    confidence,
  };
}

/** 成功反思 —— 从成功经验中学习 */
export function reflectSuccess(
  toolName: string,
  result: string,
): { success: true; insight: string } {
  return {
    success: true,
    insight: `工具 "${toolName}" 成功执行。结果长度: ${result.length} 字符。`,
  };
}
