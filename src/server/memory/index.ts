// 记忆与学习模块 —— 统一导出

export {
  memoryService,
  type MemoryEntry,
  type MemoryKind,
  type MemoryStatus,
} from "./memory-service";
export { experienceService, type ExperienceEntry, type ExperienceType } from "./experience-service";
export {
  cosineSimilarity,
  euclideanDistance,
  parseEmbedding,
  stringifyEmbedding,
  type Embedding,
} from "./vector-utils";
export {
  injectMemories,
  extractAndSaveMemory,
  getMemoryInjectionStatus,
  type MemoryInjectionOptions,
  type MemoryInjectionResult,
} from "./memory-injection";
