// LangChain 模块统一导出
// 学习目的：对比自研 vs LangChain 的 LLM 抽象层

// M16: 基础
export { LangChainProvider } from "./provider";
export {
  createPromptExamples,
  createPlanParser,
  createReflectionParser,
  createRAGPrompt,
  createAgentRolePrompts,
  createPlanChain,
  createJsonParser,
} from "./prompts";

// M17: Tools + RAG
export { adaptToLangChainTools, listToolComparison } from "./tools-adapter";
export {
  createTextSplitter,
  compareChunking,
  createVectorStoreFromDocuments,
  createRAGChain,
  ragQuery,
} from "./rag";

// M17 补全: DocumentLoader
export {
  loadTextFileLangChain,
  loadPdfLangChain,
  createDocumentsFromText,
  compareLoaders,
  comparePdfLoaders,
  getLoaderComparison,
  buildMockPdfDocuments,
} from "./document-loaders";

// M18: LangGraph 状态图
export { LangGraphEngine, getGraphComparison } from "./graph";
export type { LangGraphEngineOptions } from "./graph";

// M18 补全: addConditionalEdges 条件路由
export {
  buildReviewLoopGraph,
  runReviewLoop,
  buildRouterGraph,
  runRouterGraph,
  getConditionalEdgeComparison,
} from "./conditional-edges";
export type { ReviewLoopOptions } from "./conditional-edges";

// M19: LangGraph HITL + Checkpoint
export { HITLWorkflowEngine, getHitlComparison } from "./checkpoint";
export type { HitlEngineOptions } from "./checkpoint";
