// 提示词工程中心 —— 统一导出

export {
  extractVariables,
  interpolate,
  resolveVariables,
  validateVariables,
} from "./variable-parser";
export { BUILTIN_TEMPLATES, type BuiltinTemplate } from "./builtin-templates";
export {
  executePlayground,
  executeABTest,
  type PlaygroundRequest,
  type PlaygroundResult,
  type ABTestRequest,
  type ABTestResult,
} from "./playground-service";
