// 知识库模块 —— 统一导出

export { documentService, type KnowledgeDocument, type DocumentType } from "./document-service";
export { vectorStore, type VectorEntry } from "./vector-store";
export { ragService, type RAGResult } from "./rag-service";
export {
  multiAgentCoordinator,
  EXPERT_AGENTS,
  type ExpertAgent,
  type AgentRole,
  type CollaborationResult,
} from "./multi-agent";
