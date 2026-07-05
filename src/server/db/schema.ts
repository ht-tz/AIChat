// 数据库 Schema —— 业务核心表
// M3 阶段先用：agents / sessions / messages / agent_runs / agent_steps / tools
// M4 扩展：files / file_chunks / images / messages.attachments

import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
  uuid,
  boolean,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/* 枚举                                                                        */
/* -------------------------------------------------------------------------- */

export const messageRoleEnum = pgEnum("message_role", ["system", "user", "assistant", "tool"]);

export const agentStepKindEnum = pgEnum("agent_step_kind", [
  "plan",
  "thought",
  "tool_call",
  "tool_result",
  "reflection",
  "delta",
  "hitl_request",
  "done",
  "error",
]);

export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);

export const apiKeyStatusEnum = pgEnum("api_key_status", ["active", "revoked"]);

export const oauthProviderEnum = pgEnum("oauth_provider", ["github", "google"]);

export const maTeamTypeEnum = pgEnum("ma_team_type", ["research", "creative", "code", "custom"]);

export const maRunStatusEnum = pgEnum("ma_run_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const maStepStatusEnum = pgEnum("ma_step_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
]);

export const agentRunStatusEnum = pgEnum("agent_run_status", [
  "running",
  "success",
  "error",
  "aborted",
]);

export const toolCallStatusEnum = pgEnum("tool_call_status", [
  "pending",
  "running",
  "success",
  "error",
]);

export const fileTypeEnum = pgEnum("file_type", [
  "text",
  "image",
  "audio",
  "video",
  "pdf",
  "other",
]);

export const imageStatusEnum = pgEnum("image_status", [
  "pending",
  "generating",
  "success",
  "error",
]);

/* -------------------------------------------------------------------------- */
/* 智能体（多智能体协作 M8 预留）                                                */
/* -------------------------------------------------------------------------- */

export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  description: text("description").default(""),
  systemPrompt: text("system_prompt").default(""),
  enabledTools: jsonb("enabled_tools").$type<string[]>().default([]).notNull(),
  defaultModel: varchar("default_model", { length: 64 }).default("mock-default").notNull(),
  temperature: integer("temperature").default(7).notNull(),
  enablePlan: boolean("enable_plan").default(false).notNull(),
  enableReflection: boolean("enable_reflection").default(false).notNull(),
  requireHITL: jsonb("require_hitl").$type<string[]>().default([]).notNull(),
  avatar: varchar("avatar", { length: 8 }).default("🤖").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* -------------------------------------------------------------------------- */
/* 会话                                                                        */
/* -------------------------------------------------------------------------- */

export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).default("default").notNull(),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    title: varchar("title", { length: 200 }).default("新会话").notNull(),
    preview: text("preview").default(""),
    pinned: boolean("pinned").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    updatedIdx: index("sessions_updated_idx").on(t.updatedAt),
  }),
);

/* -------------------------------------------------------------------------- */
/* 消息 —— id/sessionId 用 varchar(64) 兼容 nanoid                           */
/* -------------------------------------------------------------------------- */

export const messages = pgTable(
  "messages",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    sessionId: varchar("session_id", { length: 64 })
      .references(() => sessions.id, { onDelete: "cascade" })
      .notNull(),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    name: varchar("name", { length: 64 }),
    runId: uuid("run_id"),
    thoughts: jsonb("thoughts").$type<string[]>().default([]),
    attachments: jsonb("attachments")
      .$type<
        Array<{
          id: string;
          type: "file" | "image";
          name: string;
          url: string;
          mimeType?: string;
          size?: number;
          fileId?: string;
        }>
      >()
      .default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    sessionIdx: index("messages_session_idx").on(t.sessionId, t.createdAt),
    runIdx: index("messages_run_idx").on(t.runId),
  }),
);

/* -------------------------------------------------------------------------- */
/* 文件存储 (M4)                                                               */
/* -------------------------------------------------------------------------- */

export const files = pgTable(
  "files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: varchar("session_id", { length: 64 })
      .references(() => sessions.id, { onDelete: "cascade" })
      .notNull(),
    filename: varchar("filename", { length: 255 }).notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 127 }).notNull(),
    fileType: fileTypeEnum("file_type").notNull(),
    size: integer("size").notNull(),
    path: text("path").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    sessionIdx: index("files_session_idx").on(t.sessionId, t.createdAt),
  }),
);

/* -------------------------------------------------------------------------- */
/* 文件分块 (M4 - 为 RAG 预留)                                                 */
/* -------------------------------------------------------------------------- */

export const fileChunks = pgTable(
  "file_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fileId: uuid("file_id")
      .references(() => files.id, { onDelete: "cascade" })
      .notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    fileIdx: index("file_chunks_file_idx").on(t.fileId, t.chunkIndex),
  }),
);

/* -------------------------------------------------------------------------- */
/* AI 生成图片 (M4)                                                            */
/* -------------------------------------------------------------------------- */

export const images = pgTable(
  "images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: varchar("session_id", { length: 64 })
      .references(() => sessions.id, { onDelete: "cascade" })
      .notNull(),
    runId: uuid("run_id"),
    prompt: text("prompt").notNull(),
    model: varchar("model", { length: 64 }).notNull(),
    status: imageStatusEnum("status").default("pending").notNull(),
    url: text("url"),
    error: text("error"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    sessionIdx: index("images_session_idx").on(t.sessionId, t.createdAt),
  }),
);

/* -------------------------------------------------------------------------- */
/* 工具调用明细 —— messageId 用 varchar(64) 兼容 messages.id                  */
/* -------------------------------------------------------------------------- */

export const toolCalls = pgTable("tool_calls", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id").notNull(),
  messageId: varchar("message_id", { length: 64 }).references(() => messages.id, {
    onDelete: "cascade",
  }),
  callId: varchar("call_id", { length: 64 }).notNull(),
  toolName: varchar("tool_name", { length: 64 }).notNull(),
  args: jsonb("args").$type<Record<string, unknown>>().notNull(),
  result: jsonb("result"),
  error: text("error"),
  status: toolCallStatusEnum("status").default("pending").notNull(),
  durationMs: integer("duration_ms"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
});

/* -------------------------------------------------------------------------- */
/* Agent Run（一次完整推理）—— sessionId 用 varchar(64)                        */
/* -------------------------------------------------------------------------- */

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: varchar("session_id", { length: 64 })
      .references(() => sessions.id, { onDelete: "cascade" })
      .notNull(),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    userMessage: text("user_message").notNull(),
    model: varchar("model", { length: 64 }).notNull(),
    status: agentRunStatusEnum("status").default("running").notNull(),
    totalRounds: integer("total_rounds").default(0).notNull(),
    plan: jsonb("plan").$type<
      Array<{ id: string; title: string; status: "pending" | "running" | "done" }>
    >(),
    reflectionScore: integer("reflection_score"),
    reflectionCritique: text("reflection_critique"),
    promptTokens: integer("prompt_tokens").default(0).notNull(),
    completionTokens: integer("completion_tokens").default(0).notNull(),
    totalTokens: integer("total_tokens").default(0).notNull(),
    estimatedCostUsd: integer("estimated_cost_usd_micros").default(0).notNull(),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
  },
  (t) => ({
    sessionIdx: index("agent_runs_session_idx").on(t.sessionId, t.startedAt),
    statusIdx: index("agent_runs_status_idx").on(t.status),
  }),
);

/* -------------------------------------------------------------------------- */
/* Agent Step（推理步骤全量审计）                                                */
/* -------------------------------------------------------------------------- */

export const agentSteps = pgTable(
  "agent_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .references(() => agentRuns.id, { onDelete: "cascade" })
      .notNull(),
    stepIndex: integer("step_index").notNull(),
    kind: agentStepKindEnum("kind").notNull(),
    toolCallId: varchar("tool_call_id", { length: 64 }),
    content: text("content"),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    runIdx: index("agent_steps_run_idx").on(t.runId, t.stepIndex),
  }),
);

/* -------------------------------------------------------------------------- */
/* 工具注册表（落库版，M3 接入）                                                */
/* -------------------------------------------------------------------------- */

export const tools = pgTable("tools", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  description: text("description").notNull(),
  definition: jsonb("definition").$type<Record<string, unknown>>().notNull(),
  impl: varchar("impl", { length: 16 }).default("builtin").notNull(),
  endpoint: text("endpoint"),
  callCount: integer("call_count").default(0).notNull(),
  avgDurationMs: integer("avg_duration_ms").default(0).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* -------------------------------------------------------------------------- */
/* 提示词模板 (M6)                                                             */
/* -------------------------------------------------------------------------- */

export const promptTemplates = pgTable(
  "prompt_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description").default(""),
    category: varchar("category", { length: 64 }).default("custom").notNull(),
    systemPrompt: text("system_prompt").notNull(),
    variables: jsonb("variables")
      .$type<
        Array<{
          name: string;
          description?: string;
          defaultValue?: string;
        }>
      >()
      .default([])
      .notNull(),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    isBuiltin: boolean("is_builtin").default(false).notNull(),
    currentVersion: integer("current_version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    categoryIdx: index("prompt_templates_category_idx").on(t.category),
  }),
);

/* -------------------------------------------------------------------------- */
/* 提示词版本历史 (M6)                                                         */
/* -------------------------------------------------------------------------- */

export const promptVersions = pgTable(
  "prompt_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templateId: uuid("template_id")
      .references(() => promptTemplates.id, { onDelete: "cascade" })
      .notNull(),
    version: integer("version").notNull(),
    systemPrompt: text("system_prompt").notNull(),
    variables: jsonb("variables")
      .$type<
        Array<{
          name: string;
          description?: string;
          defaultValue?: string;
        }>
      >()
      .default([])
      .notNull(),
    changelog: text("changelog").default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    templateIdx: index("prompt_versions_template_idx").on(t.templateId, t.version),
  }),
);

/* -------------------------------------------------------------------------- */
/* 记忆 (M7)                                                                    */
/* -------------------------------------------------------------------------- */

export const memoryKindEnum = pgEnum("memory_kind", ["short", "long", "episodic"]);

export const memoryStatusEnum = pgEnum("memory_status", ["active", "archived", "forgotten"]);

export const memories = pgTable(
  "memories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: varchar("session_id", { length: 64 }).references(() => sessions.id, {
      onDelete: "set null",
    }),
    kind: memoryKindEnum("kind").notNull(),
    content: text("content").notNull(),
    summary: text("summary").default(""),
    topics: jsonb("topics").$type<string[]>().default([]).notNull(),
    importance: integer("importance").default(50).notNull(),
    embedding: text("embedding").default(""),
    source: varchar("source", { length: 128 }).default("conversation").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    status: memoryStatusEnum("status").default("active").notNull(),
    referencedCount: integer("referenced_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    lastAccessedAt: timestamp("last_accessed_at").defaultNow().notNull(),
  },
  (t) => ({
    kindIdx: index("memories_kind_idx").on(t.kind),
    statusIdx: index("memories_status_idx").on(t.status),
    sessionIdx: index("memories_session_idx").on(t.sessionId),
  }),
);

export const memoryChunks = pgTable(
  "memory_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memoryId: uuid("memory_id")
      .references(() => memories.id, { onDelete: "cascade" })
      .notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: text("embedding").default(""),
    tokenCount: integer("token_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    memoryIdx: index("memory_chunks_memory_idx").on(t.memoryId, t.chunkIndex),
  }),
);

/* -------------------------------------------------------------------------- */
/* 经验案例 (M7)                                                                 */
/* -------------------------------------------------------------------------- */

export const experienceTypeEnum = pgEnum("experience_type", ["success", "failure", "insight"]);

export const experiences = pgTable(
  "experiences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: varchar("session_id", { length: 64 }).references(() => sessions.id, {
      onDelete: "set null",
    }),
    runId: uuid("run_id").references(() => agentRuns.id, { onDelete: "set null" }),
    type: experienceTypeEnum("type").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description").default(""),
    lesson: text("lesson").notNull(),
    context: jsonb("context").$type<Record<string, unknown>>().default({}).notNull(),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    rating: integer("rating").default(0).notNull(),
    referencedCount: integer("referenced_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    typeIdx: index("experiences_type_idx").on(t.type),
    sessionIdx: index("experiences_session_idx").on(t.sessionId),
  }),
);

/* -------------------------------------------------------------------------- */
/* 类型导出（供前端 / 服务端使用）                                              */
/* -------------------------------------------------------------------------- */

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type FileRecord = typeof files.$inferSelect;
export type NewFileRecord = typeof files.$inferInsert;
export type FileChunk = typeof fileChunks.$inferSelect;
export type NewFileChunk = typeof fileChunks.$inferInsert;
export type ImageRecord = typeof images.$inferSelect;
export type NewImageRecord = typeof images.$inferInsert;
export type AgentRun = typeof agentRuns.$inferSelect;
export type NewAgentRun = typeof agentRuns.$inferInsert;
export type AgentStep = typeof agentSteps.$inferSelect;
export type NewAgentStep = typeof agentSteps.$inferInsert;
export type ToolCall = typeof toolCalls.$inferSelect;
export type NewToolCall = typeof toolCalls.$inferInsert;
export type Tool = typeof tools.$inferSelect;
export type NewTool = typeof tools.$inferInsert;
export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type NewPromptTemplate = typeof promptTemplates.$inferInsert;
export type PromptVersion = typeof promptVersions.$inferSelect;
export type NewPromptVersion = typeof promptVersions.$inferInsert;
export type PromptVariable = { name: string; description?: string; defaultValue?: string };

export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;
export type MemoryChunk = typeof memoryChunks.$inferSelect;
export type NewMemoryChunk = typeof memoryChunks.$inferInsert;
export type Experience = typeof experiences.$inferSelect;
export type NewExperience = typeof experiences.$inferInsert;

export type PlanItem = { id: string; title: string; status: "pending" | "running" | "done" };

/* -------------------------------------------------------------------------- */
/* 用户 (M12)                                                                  */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: text("password_hash"),
    name: varchar("name", { length: 128 }).default(""),
    role: userRoleEnum("role").default("user").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    avatar: varchar("avatar", { length: 255 }),
    provider: varchar("provider", { length: 32 }),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: index("users_email_idx").on(t.email),
    roleIdx: index("users_role_idx").on(t.role),
  }),
);

/* -------------------------------------------------------------------------- */
/* API 密钥 (M12)                                                              */
/* -------------------------------------------------------------------------- */

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    keyHash: text("key_hash").notNull(),
    keyPrefix: varchar("key_prefix", { length: 16 }).notNull(),
    status: apiKeyStatusEnum("status").default("active").notNull(),
    lastUsedAt: timestamp("last_used_at"),
    usageCount: integer("usage_count").default(0).notNull(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("api_keys_user_idx").on(t.userId),
    keyHashIdx: index("api_keys_key_hash_idx").on(t.keyHash),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

/* -------------------------------------------------------------------------- */
/* OAuth 账号关联 (M13)                                                        */
/* -------------------------------------------------------------------------- */

export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    provider: oauthProviderEnum("provider").notNull(),
    providerUserId: varchar("provider_user_id", { length: 255 }).notNull(),
    providerEmail: varchar("provider_email", { length: 255 }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("oauth_accounts_user_idx").on(t.userId),
    providerIdx: index("oauth_accounts_provider_idx").on(t.provider, t.providerUserId),
  }),
);

/* -------------------------------------------------------------------------- */
/* 邮箱验证 Token (M13)                                                        */
/* -------------------------------------------------------------------------- */

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    token: varchar("token", { length: 128 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    verifiedAt: timestamp("verified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    tokenIdx: index("email_verification_tokens_token_idx").on(t.token),
    userIdx: index("email_verification_tokens_user_idx").on(t.userId),
  }),
);

export type OAuthAccount = typeof oauthAccounts.$inferSelect;
export type NewOAuthAccount = typeof oauthAccounts.$inferInsert;
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type NewEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;

/* -------------------------------------------------------------------------- */
/* 多智能体协作 (M14) — 团队 / 运行 / 步骤                                       */
/* -------------------------------------------------------------------------- */

export const maTeams = pgTable(
  "ma_teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description").default(""),
    teamType: maTeamTypeEnum("team_type").default("custom").notNull(),
    agents: jsonb("agents").notNull().default("[]"),
    workflow: jsonb("workflow").notNull().default("[]"),
    userId: uuid("user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("ma_teams_user_idx").on(t.userId),
    typeIdx: index("ma_teams_type_idx").on(t.teamType),
  }),
);

export const maRuns = pgTable(
  "ma_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id").references(() => maTeams.id, { onDelete: "set null" }),
    goal: text("goal").notNull(),
    status: maRunStatusEnum("status").default("pending").notNull(),
    totalStages: integer("total_stages").default(0).notNull(),
    completedStages: integer("completed_stages").default(0).notNull(),
    totalSteps: integer("total_steps").default(0).notNull(),
    completedSteps: integer("completed_steps").default(0).notNull(),
    finalAnswer: text("final_answer"),
    error: text("error"),
    durationMs: integer("duration_ms"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    teamIdx: index("ma_runs_team_idx").on(t.teamId),
    statusIdx: index("ma_runs_status_idx").on(t.status),
    createdAtIdx: index("ma_runs_created_at_idx").on(t.createdAt),
  }),
);

export const maSteps = pgTable(
  "ma_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .references(() => maRuns.id, { onDelete: "cascade" })
      .notNull(),
    stageIndex: integer("stage_index").notNull(),
    stepIndex: integer("step_index").notNull(),
    agentRole: varchar("agent_role", { length: 64 }).notNull(),
    agentName: varchar("agent_name", { length: 128 }).notNull(),
    status: maStepStatusEnum("status").default("pending").notNull(),
    input: text("input"),
    output: text("output"),
    durationMs: integer("duration_ms"),
    error: text("error"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    runIdx: index("ma_steps_run_idx").on(t.runId),
    stageIdx: index("ma_steps_stage_idx").on(t.runId, t.stageIndex),
  }),
);

export type MaTeam = typeof maTeams.$inferSelect;
export type NewMaTeam = typeof maTeams.$inferInsert;
export type MaRun = typeof maRuns.$inferSelect;
export type NewMaRun = typeof maRuns.$inferInsert;
export type MaStep = typeof maSteps.$inferSelect;
export type NewMaStep = typeof maSteps.$inferInsert;

/* -------------------------------------------------------------------------- */
/* 模型配置 (每模型独立 API Key，加密存储)                                        */
/* -------------------------------------------------------------------------- */

export const modelConfigs = pgTable(
  "model_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    modelId: varchar("model_id", { length: 64 }).notNull(),
    label: varchar("label", { length: 128 }).default(""),
    vendor: varchar("vendor", { length: 32 }).default(""),
    baseUrl: text("base_url").notNull(),
    apiKeyEncrypted: text("api_key_encrypted").notNull(),
    apiKeyPrefix: varchar("api_key_prefix", { length: 16 }).notNull(),
    temperature: integer("temperature").default(7).notNull(),
    isActive: boolean("is_active").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    userModelIdx: index("model_configs_user_model_idx").on(t.userId, t.modelId),
    userActiveIdx: index("model_configs_user_active_idx").on(t.userId, t.isActive),
  }),
);

export type ModelConfig = typeof modelConfigs.$inferSelect;
export type NewModelConfig = typeof modelConfigs.$inferInsert;
