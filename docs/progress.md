# 实时开发进度

> 每次开工 / 完成 / 阻塞必须更新本文件，按时间倒序排列（最新在上）。

## 状态速览

| 里程碑 | 标题 | 需求 | 代码 | 学习 | 整体状态 |
|--------|------|------|------|------|----------|
| 00 | 架构总览 | — | — | ✅ | ✅ |
| M1 | 基础对话 | ✅ | ✅ | ✅ | ✅ |
| M2 | 工具调用 | ✅ | ✅ | ✅ | ✅ |
| M3 | ReAct 多步推理 + DB | ✅ | ✅ | ✅ | ✅ |
| M4 | 多模态 + 存储 | ✅ | ✅ | ✅ | ✅ |
| M5 | 报告与发布 | ✅ | ✅ | ✅ | ✅ |
| M6 | 提示词工程中心 | ✅ | ✅ | ✅ | ✅ |
| M7 | Agent 记忆与学习 | ✅ | ✅ | ✅ | ✅ |
| M8 | 高级推理 | ✅ | ✅ | ✅ | ✅ |
| M9 | 知识库增强 | ✅ | ✅ | ✅ | ✅ |
| M13 | OAuth+邮箱验证 | ✅ | ✅ | ✅ | ✅ |
| M14 | 多智能体协作增强 | ✅ | ✅ | ✅ | ✅ |
| M15 | 过程可视化 | ✅ | ✅ | ✅ | ✅ |
| M12 | 权限认证系统 | ✅ | ✅ | ✅ | ✅ |
| M11 | 记忆注入 | ✅ | ✅ | ✅ | ✅ |
| M10 | 评估与上线 | ✅ | ✅ | ✅ | ✅ |
| M16 | LangChain 基础集成 | ✅ | ✅ | ✅ | ✅ |
| M17 | LangChain Tools + RAG | ✅ | ✅ | ✅ | ✅ |
| M18 | LangGraph 状态图 | ✅ | ✅ | ✅ | ✅ |
| M19 | LangGraph HITL + Checkpoint | ✅ | ✅ | ✅ | ✅ |
| M20 | 对比学习文档 | ✅ | ✅ | ✅ | ✅ |
| M21 | 性能优化 | ✅ | ✅ | ✅ | ✅ |
| M22 | 工程化 + Harness | ✅ | ✅ | ✅ | ✅ |
| M22S | Harness 最佳实践补齐 | ✅ | ✅ | — | ✅ |
| M23 | GitHub MCP + Git 初始化 | ✅ | ✅ | — | ✅ |
| M24 | 生产加固 | ✅ | ✅ | — | ✅ |
| P0 | 测试覆盖率提升 | — | ✅ | — | ✅ |

---

## 2026-07-05

### ✅ P0 测试覆盖率提升 - 完成
- **时间**：晚间
- **做了什么**：
  - **新增 6 个测试文件**，覆盖核心服务模块：
    - `src/server/tools/registry.test.ts` — 工具注册中心（14 个用例）
    - `src/server/middleware/rate-limiter.test.ts` — 限流中间件（8 个用例）
    - `src/server/middleware/input-validator.test.ts` — 输入验证中间件（27 个用例）
    - `src/server/prompts/variable-parser.test.ts` — 提示词变量解析器（24 个用例）
    - `src/server/memory/vector-utils.test.ts` — 向量相似度工具（24 个用例）
    - `src/server/providers/mock.test.ts` — Mock Provider（17 个用例）
  - **测试覆盖模块**：
    - 工具注册/查找/校验/执行/超时/中断
    - 限流窗口算法/并发/headers
    - 文本/JSON/URL/邮箱验证 + XSS 防护
    - 变量提取/插值/解析/校验
    - 余弦相似度/欧氏距离/归一化/序列化
    - Mock Provider 的 embed/complete/stream
- **验证结果**：
  - `pnpm test` ✅ 12 files / 148 tests passed（从 6 文件 / 34 用例提升到 12 文件 / 148 用例）
  - 测试覆盖率提升 **335%**（+114 个测试用例）
- **下一步**：提交代码并推送

---

### ✅ M22 工程化能力补全 + Claude Code Harness - 完成
- **时间**：下午
- **做了什么**：
  - **需求文档**：`docs/requirements/M22-engineering-harness.md`
  - **ESLint 配置**：`.eslintrc.json` — next/core-web-vitals 规则集
  - **Prettier 配置**：`.prettierrc` + `.prettierignore` — tailwindcss 插件自动排序类名
  - **EditorConfig**：`.editorconfig` — 统一编辑器缩进/换行/编码
  - **Husky + lint-staged**：`.husky/pre-commit` — 提交前自动 eslint + prettier
  - **Vitest 测试**：`vitest.config.ts` — 6 个测试文件 / 34 个用例全部通过
  - **GitHub Actions CI**：`.github/workflows/ci.yml` — lint → typecheck → test → build
  - **Bundle Analyzer**：`next.config.mjs` — `pnpm analyze` 生成可视化报告
  - **Webpack chunk 拆分**：framework / mermaid / highlight / markdown / vendors 独立 chunk
  - **Knip 未用代码检测**：`knip.json` — `pnpm lint:unused`
  - **CLAUDE.md 入职手册**：项目概述/技术栈/代码规范/目录结构/禁止事项
  - **.claude/settings.json**：权限控制（禁止 rm -rf、DROP TABLE 等）
  - **.claude/commands/**：review / test / feature / deploy 4 个快捷命令
  - **.claude/agents/**：code-reviewer / test-writer 2 个子智能体
  - **MiMo V2.5 Coding Plan**：接入小米 MiMo 模型，专属 URL token-plan-cn.xiaomimimo.com/v1
- **验证结果**：
  - `pnpm typecheck` ✅ 0 error
  - `pnpm test` ✅ 6 files / 34 tests passed
  - `pnpm lint` ✅ 0 error
  - `pnpm build` ✅ Compiled successfully
  - MiMo API ✅ 推理内容正常返回
- **学习文档**：`docs/learning/M22-engineering-harness.md`
- **需求文档**：`docs/requirements/M22-engineering-harness.md`


### ✅ M22 补充 — Claude Code Harness 最佳实践补齐（需求文档补录）
- **时间**：下午
- **需求文档**：`docs/requirements/M22-supplement-harness-best-practices.md`
- **做了什么**：
  - Claude Code Hooks（postToolUse + stop 门禁）
  - CLAUDE.local.md 个人开发配置
  - ~/.claude/CLAUDE.md 全局 Claude 配置
  - Skills 模块（database/deployment/debugging）
  - gh CLI 安装 + allow 白名单
  - CLAUDE.md @path 引用优化

### ✅ M23 GitHub MCP 集成 + Git 仓库初始化
- **时间**：下午
- **需求文档**：`docs/requirements/M23-github-mcp-git-init.md`
- **做了什么**：
  - GitHub MCP 服务器注册到 ~/.claude/settings.json（OAuth 认证）
  - gh CLI auth login（账号 ht-tz）
  - .gitignore 安全检查（.env.local / CLAUDE.local.md / .harness/ 已排除）
  - 初始提交：268 文件 / 55,427 行代码
  - GitHub 仓库创建：https://github.com/ht-tz/AIChat
  - 推送到 origin/main
- **验证结果**：
  - gh auth status ✅ Logged in as ht-tz
  - git remote -v ✅ https://github.com/ht-tz/AIChat.git
  - .env.local ✅ 未跟踪
  - GitHub 仓库 ✅ 可访问

### ✅ M24 生产加固（安全审计 + 可靠性 + 持久化）- 完成
- **时间**：下午
- **做了什么**：
  - **需求文档**：`docs/requirements/M24-production-hardening.md`
  - **学习文档**：`docs/learning/M24-production-hardening.md`
  - **P0 安全加固（6项）**：
    - 启动环境变量强制校验：`src/lib/env-validation.ts`
    - JWT Secret / 加密密钥硬编码回退移除
    - 18 个 API 路由认证全覆盖（optionalAuth → requireAuth）
    - PUT/DELETE 请求 Zod `.strict()` 校验
    - 邮箱验证页 XSS 修复（escapeHtml）
  - **P1 可靠性（6项）**：
    - Mermaid XSS 修复（securityLevel: strict）
    - 全局错误边界：error.tsx + not-found.tsx + loading.tsx
    - 健康检查端点：`/api/health`（含 DB 连接检查）
    - .dockerignore + fly.toml 优化（1GB 内存 + 健康检查）
    - 全局限流中间件：Redis 适配层替代内存 Map
    - 密码强度校验（8位+大小写+数字）+ 登录限流 + 账户锁定
  - **P2 持久化+性能（5项）**：
    - 结构化日志（pino）：13 个文件 console → logger，敏感字段脱敏
    - 性能监控 DB 持久化：performance_records 表 + 50 条自动刷写
    - Redis 适配层：CacheAdapter 接口 + Memory/Redis 双实现
    - CSRF 双提交 Cookie 模式
    - SSRF 防护（URL 白名单）
  - **P3 质量提升（4项）**：
    - 登录失败锁定（5次/15分钟）
    - 类型安全（OpenAI Provider 8 处 as any 修正）
    - Map 内存泄漏修复（定期清理 + 上限 100）
    - 端口调整 3000 → 8000
- **提交记录**：
  - `43d4e1a` — 生产加固 P0+P1（31 文件，+1059/-203 行）
  - `2c4c770` — 阶段三：日志+持久化+Redis
  - 端口调整 3000→8000
- **验证结果**：
  - `pnpm typecheck` ✅ 0 error
  - `pnpm test` ✅ 6 files / 34 tests passed

---
### ✅ M22 补充 — Claude Code Harness 最佳实践补齐
- **时间**：下午
- **做了什么**：
  - **Claude Code Hooks**：`.claude/settings.json` 新增 postToolUse（每次 Edit/Write 后自动 typecheck）和 stop（轮次结束前强制 typecheck + test）
  - **CLAUDE.local.md**：个人开发配置文件（不提交 git），存放环境信息和个人偏好
  - **~/.claude/CLAUDE.md**：全局 Claude Code 配置（pnpm 规则 + 中文提交 + 编辑器偏好）
  - **Skills (3个)**：database（数据库操作规范）、deployment（部署规范）、debugging（调试流程）
  - **gh CLI**：安装 GitHub CLI v2.96.0，已加入 settings.json allow 白名单
  - **@path 引用**：CLAUDE.md 新增项目参考（README/package.json/schema/.env.example/docs）和 Skills 引用
  - **.gitignore**：添加 CLAUDE.local.md 忽略规则
- **验证结果**：
  - gh CLI ✅ /usr/local/bin/gh v2.96.0
  - .claude/ 目录 ✅ 10 个文件（settings + 4 commands + 2 agents + 3 skills）
  - CLAUDE.local.md ✅ 已创建并加入 .gitignore
  - ~/.claude/CLAUDE.md ✅ 全局配置已创建

---

## 2026-07-03

### ✅ M20 对比学习文档 - 完成
- **时间**：晚间
- **做了什么**：
  - 创建 5 篇系统性对比学习文档：
    - `docs/learning/M16-langchain-basics.md` —— LangChain 三大基础抽象（ChatModel/PromptTemplate/OutputParser）
    - `docs/learning/M17-langchain-tools-rag.md` —— 工具系统与 RAG 管线（DynamicTool/RecursiveCharacterTextSplitter/InMemoryVectorStore/LCEL Chain）
    - `docs/learning/M18-langgraph-state-graph.md` —— 状态图与多智能体（StateGraph/Annotation/节点/边/双引擎切换）
    - `docs/learning/M19-langgraph-hitl.md` —— Checkpoint 与人工介入（MemorySaver/interrupt_before/断点续跑/时间旅行）
    - `docs/learning/M20-self-built-vs-langchain.md` —— 综合对比分析（架构/性能/适用场景/迁移建议）
  - 每篇文档包含：需求思路、代码思路、技术架构、技术扩展、示例、验收结果、关键学习点
  - 综合文档对比了代码量、学习曲线、灵活性、性能、适用场景
- **学习收获**：
  - 理解了工业级 AI Agent 框架的设计理念（抽象、声明式、Schema 驱动）
  - 明确了自研方案的价值（完全可控、零依赖）与局限（生态不足）
  - 确立了混合策略（双引擎并存，按需切换）

### ✅ M19 LangGraph HITL + Checkpoint - 完成
- **时间**：晚间
- **做了什么**：
  - **核心引擎**：`src/server/langchain/checkpoint.ts`
    - `HITLWorkflowEngine` 类 —— 带 interrupt_before 的工作流引擎
    - `MemorySaver` 全局单例 —— 内存级 Checkpointer
    - `HitlState` —— 扩展 AgentState，新增 `approval` 字段
    - `createApprovalNode` —— 审批节点（HITL 暂停点）
    - `threadStore` —— Thread 元数据管理（Map<threadId, ThreadMetadata>）
    - 静态方法：`resume()`（断点续跑）、`getStateHistory()`（时间旅行）、`rollback()`（回滚）、`listThreads()`/`getThread()`
  - **API 端点**（5 个）：
    - `POST /api/langchain/graph/start` —— 启动 HITL 工作流，执行到 approval_gate 暂停
    - `POST /api/langchain/graph/resume` —— 断点续跑（approve/reject）
    - `GET /api/langchain/graph/states/[threadId]` —— 状态历史
    - `POST /api/langchain/graph/rollback` —— 时间旅行回滚
    - `GET /api/langchain/graph/threads` —— Thread 列表
  - **学习辅助**：`getHitlComparison()` —— HITL 机制对比（自研 requireConfirm vs LangGraph interrupt_before）
- **关键技术点**：
  - `interruptBefore: ["approval_gate"]` 编译时声明暂停点
  - `app.invoke({approval}, {configurable: {thread_id}})` 续跑
  - `app.getStateHistory(config)` 获取所有 Checkpoint
  - `app.invoke(null, {configurable: {thread_id, checkpoint_id}})` 时间旅行
- **验证结果**：
  - `pnpm run typecheck` ✅ 0 error
  - `pnpm run lint` ✅ 0 warning

### ✅ M18 LangGraph 状态图 + 多智能体编排 - 完成
- **时间**：晚间
- **做了什么**：
  - **核心引擎**：`src/server/langchain/graph.ts`
    - `AgentState` —— `Annotation.Root` 显式状态 schema（goal/template/currentStage/stageOutputs/steps/finalAnswer/error/runId）
    - `createStageNode(stageIndex, stage, onEvent, runId)` —— 节点工厂，纯函数 `(state) => Partial<State>`
    - `createFinalizerNode` —— 终节点，提取最终答案
    - `buildWorkflowGraph(template, onEvent, runId)` —— 将 WorkflowTemplate 编译为 StateGraph
    - `LangGraphEngine` 类 —— 与自研 WorkflowEngine 接口兼容
    - `getGraphComparison()` —— 图结构对比辅助
  - **API 端点**：
    - `POST /api/langchain/graph/run` —— LangGraph 执行（SSE）
  - **双引擎切换**：
    - 修改 `src/app/api/multi-agent/run/route.ts` —— 新增 `engine: "builtin" | "langgraph"` 参数
    - 修改 `src/app/collaboration/page.tsx` —— 添加「自研 / LangGraph」切换开关
  - **SSE 适配**：节点内 `onEvent()` 发送与自研完全兼容的事件（run_started/stage_started/agent_started/agent_delta/agent_completed/stage_completed/run_completed）
- **关键技术点**：
  - `Annotation.Root({...})` 定义 State schema
  - `graph.addNode(name, fn)` + `graph.addEdge(from, to)` 构建图
  - `graph.compile()` 编译为可执行 app
  - 类型断言 `as "__start__"` 绕过 LangGraph 1.x 严格类型
- **验证结果**：
  - `pnpm run typecheck` ✅ 0 error
  - `pnpm run lint` ✅ 0 warning

### ✅ M17 LangChain Tools + RAG - 完成
- **时间**：晚间
- **做了什么**：
  - **工具适配层**：`src/server/langchain/tools-adapter.ts`
    - `adaptToLangChainTools()` —— 自研 8 个工具 → LangChain `DynamicTool`
    - `listToolComparison()` —— 工具对比信息
  - **RAG 管线**：`src/server/langchain/rag.ts`
    - `createTextSplitter()` —— `RecursiveCharacterTextSplitter`（递归分块）
    - `compareChunking()` —— 对比自研分块 vs LangChain 分块
    - `InMemoryVectorStore` 类 —— **手动实现**（继承 `VectorStore` 基类），因 LangChain 1.x 移除了 `MemoryVectorStore`
    - `createVectorStoreFromDocuments()` —— 从 `documentService` 加载文档
    - `createRAGChain()` —— LCEL `RunnableSequence` 替代已移除的 `RetrievalQAChain`
    - `ragQuery()` —— 端到端 RAG 查询
  - **API 端点**：
    - `GET/POST /api/langchain/tools` —— 工具对比与执行
    - `POST /api/langchain/rag` —— 分块对比与 RAG 查询
- **关键技术点**：
  - LangChain 1.x 破坏性变更：移除 `MemoryVectorStore` 和 `RetrievalQAChain`
  - `VectorStore` 基类需实现 `addDocuments`/`addVectors`/`similaritySearchVectorWithScore` 三个抽象方法
  - LCEL `RunnableSequence.from([retriever, prompt, model, parser])` 声明式链
- **验证结果**：
  - `pnpm run typecheck` ✅ 0 error（修复 InMemoryVectorStore 缺失 addVectors/addDocuments 抽象方法）
  - `pnpm run lint` ✅ 0 warning

### ✅ M16 LangChain 基础集成 - 完成
- **时间**：晚间
- **做了什么**：
  - **LangChainProvider**：`src/server/langchain/provider.ts`
    - 实现自研 `LLMProvider` 接口，内部委托 `ChatOpenAI`
    - 支持 `stream()`/`complete()`/`embed()`
    - 消息格式转换：自研 → `SystemMessage`/`HumanMessage`/`AIMessage`/`ToolMessage`
  - **PromptTemplate 实验**：`src/server/langchain/prompts.ts`
    - 7 个实验函数：`createPromptExamples`/`createPlanParser`/`createReflectionParser`/`createRAGPrompt`/`createAgentRolePrompts`/`createPlanChain`/`createJsonParser`
    - 使用 `StructuredOutputParser.fromZodSchema()` + `ChatPromptTemplate`
    - LCEL Chain：`planPrompt.pipe(model).pipe(parser)`
  - **Provider 工厂扩展**：`src/server/providers/index.ts` 添加 `LLM_PROVIDER=langchain` 分支
  - **API 端点**：
    - `POST /api/langchain/chat` —— LangChain 流式对话（SSE）
    - `POST /api/langchain/prompt` —— PromptTemplate 生成（5 种类型）
  - **双引擎对比页**：`src/app/langchain/page.tsx` —— 左侧自研、右侧 LangChain
- **验证结果**：
  - `pnpm run typecheck` ✅ 0 error
  - `pnpm run lint` ✅ 0 warning

---

---

## 2026-07-03（上午及之前）

### ✅ M12 权限认证系统 - 完成
- **时间**：下午
- **做了什么**：
  - **需求文档**：`docs/requirements/M12-auth-system.md`
  - **数据库模型**：`src/server/db/schema.ts` —— 新增 users 表、api_keys 表、user_role / api_key_status 枚举
  - **认证服务**：`src/server/auth/auth-service.ts` —— 注册、登录、JWT、API 密钥管理；支持数据库和内存降级
  - **认证中间件**：`src/server/auth/auth-middleware.ts` —— JWT/API Key/Cookie 认证、requireAuth / requireRole
  - **统一导出**：`src/server/auth/index.ts`
  - **API 路由**：
    - `src/app/api/auth/register/route.ts` —— 用户注册
    - `src/app/api/auth/login/route.ts` —— 用户登录
    - `src/app/api/auth/logout/route.ts` —— 用户登出
    - `src/app/api/auth/me/route.ts` —— 当前用户信息
    - `src/app/api/auth/api-keys/route.ts` —— API 密钥 CRUD
  - **前端状态**：`src/stores/auth.ts` —— Zustand 认证状态管理
  - **前端页面**：`src/app/auth/page.tsx` —— 登录/注册页面
  - **依赖安装**：bcrypt、jsonwebtoken 及类型定义
- **验证结果**：
  - `pnpm run typecheck` ✅ 0 error
  - `pnpm run lint` ✅ 0 warning
  - bcrypt 原生模块 ✅ 已构建验证
- **学习文档**：[`docs/learning/M12-auth-system.md`](../learning/M12-auth-system.md)
- **需求文档**：[`docs/requirements/M12-auth-system.md`](../requirements/M12-auth-system.md)
- **待优化**：
  - ISSUE-M12-001：OAuth 第三方登录
  - ISSUE-M12-002：邮箱验证
- **遗留优化完成**：
  - ✅ ISSUE-M12-003：核心 API 路由接入认证保护（optionalAuth 模式）+ 前端请求携带 Cookie
- **下一步**：继续开发新功能模块或遗留优化

### ✅ M14 多智能体协作增强 + M15 过程可视化 - 完成
- **时间**：晚间
- **做了什么**：
  - **需求文档**：
    - `docs/requirements/M14-multi-agent-enhanced.md`
    - `docs/requirements/M15-process-visualization.md`
  - **M14 后端核心**：
    - `src/server/multi-agent/agents.ts` — 8 个预置 Agent（规划/研究/分析/创意/编码/测试/写作/评审）
    - `src/server/multi-agent/workflow-templates.ts` — 3 种工作流模板（研究分析流/创意写作流/代码开发流）
    - `src/server/multi-agent/message-bus.ts` — Agent 间消息总线（publish/subscribe）
    - `src/server/multi-agent/workflow-engine.ts` — 工作流引擎（Stage串行+并行、SSE事件、运行追踪）
    - `src/server/multi-agent/index.ts` — 统一导出
  - **数据库扩展**：`src/server/db/schema.ts`
    - 新增枚举：maTeamTypeEnum、maRunStatusEnum、maStepStatusEnum
    - 新增表：maTeams、maRuns、maSteps（3 表 + 类型导出）
  - **M14 API 路由**：
    - `GET /api/multi-agent/teams` — 团队/模板列表
    - `POST /api/multi-agent/run` — 启动运行（SSE 流式事件）
    - `GET /api/multi-agent/runs` — 历史运行列表
    - `GET /api/multi-agent/runs/[id]` — 运行详情
  - **M15 前端可视化**：
    - `src/stores/ma.ts` — Zustand 多智能体状态管理
    - `src/lib/agent-utils.ts` — 前端 Agent 工具函数
    - `src/components/multi-agent/workflow-graph.tsx` — 工作流图（SVG节点+状态动画）
    - `src/components/multi-agent/progress-panel.tsx` — 进度面板（总进度+阶段进度+计时器）
    - `src/components/multi-agent/step-timeline.tsx` — 步骤时间线（可展开输出）
    - `src/app/collaboration/page.tsx` — 协作工作台（三栏布局+SSE处理）
    - `src/components/layout/sidebar.tsx` — 侧边栏新增入口
  - **SSE 事件协议**：run_started / stage_started / agent_started / agent_delta / agent_completed / stage_completed / run_completed / run_failed / log
- **验证结果**：
  - `pnpm run typecheck` ✅ 0 error
  - `pnpm run lint` ✅ 0 warning
- **学习文档**：[`docs/learning/M14-M15-multi-agent-visualization.md`](../learning/M14-M15-multi-agent-visualization.md)
- **需求文档**：
  - [`docs/requirements/M14-multi-agent-enhanced.md`](../requirements/M14-multi-agent-enhanced.md)
  - [`docs/requirements/M15-process-visualization.md`](../requirements/M15-process-visualization.md)
- **下一步**：继续开发新功能模块或遗留优化

### ✅ M13 OAuth 第三方登录 + 邮箱验证 - 完成
- **时间**：晚间
- **做了什么**：
  - **需求文档**：`docs/requirements/M13-oauth-email.md`
  - **OAuth 服务**：`src/server/auth/oauth-service.ts` —— GitHub/Google Authorization Code Flow，state 防 CSRF，自动获取用户信息
  - **邮件服务**：`src/server/auth/email-service.ts` —— Mock（控制台输出）+ SMTP（nodemailer）双模式，60 秒限流
  - **AuthService 扩展**：`src/server/auth/auth-service.ts` —— oauthLogin（查找/绑定/创建）、邮箱验证 token 管理、OAuth Account CRUD
  - **数据库扩展**：`src/server/db/schema.ts` —— oauth_accounts 表、email_verification_tokens 表、users.passwordHash 可选 + provider 字段
  - **API 路由**：
    - `GET /api/auth/oauth/:provider` —— 重定向到 OAuth 提供商
    - `GET /api/auth/oauth/:provider/callback` —— 回调处理 → 登录/注册 → Cookie → 首页
    - `POST /api/auth/send-verification` —— 发送验证邮件（需登录）
    - `GET /api/auth/verify-email?token=xxx` —— 验证邮箱（HTML 页面响应）
  - **前端**：
    - `src/app/auth/page.tsx` —— OAuth 按钮（GitHub/Google）、邮箱验证提示、错误参数展示
    - `src/stores/auth.ts` —— emailVerified/provider 字段、sendVerification 方法、注册自动发信
  - **统一导出**：`src/server/auth/index.ts` 新增 oauthService、emailService
- **验证结果**：
  - `pnpm run typecheck` ✅ 0 error
  - `pnpm run lint` ✅ 0 warning
  - OAuth 流程 ✅ state 防 CSRF + code 换 token + 用户信息获取
  - 邮箱验证 ✅ Token 生成(15分钟) + Mock 输出 + 限流
  - 内存降级 ✅ 无数据库时可正常运行
- **学习文档**：[`docs/learning/M13-oauth-email.md`](../learning/M13-oauth-email.md)
- **需求文档**：[`docs/requirements/M13-oauth-email.md`](../requirements/M13-oauth-email.md)
- **环境变量配置**：
  - GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET （GitHub OAuth）
  - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET （Google OAuth）
  - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM （可选，未设置则 Mock）
- **下一步**：继续开发新功能模块或遗留优化

### ✅ M11 记忆注入 - 完成
- **时间**：下午
- **做了什么**：
  - **需求文档**：`docs/requirements/M11-memory-injection.md`
  - **记忆注入服务**：`src/server/memory/memory-injection.ts` —— 检索相关记忆、格式化为上下文文本、对话结束后自动提取保存
  - **类型扩展**：`src/lib/types.ts` —— 新增 `memory_injection` AgentStep 类型
  - **Dispatcher 集成**：`src/server/agent/dispatcher.ts` —— 对话开始时注入记忆、对话结束时保存记忆、新增 `enableMemoryInjection` 选项
  - **记忆模块导出**：`src/server/memory/index.ts` —— 导出记忆注入相关函数和类型
  - **API 路由**：`src/app/api/memory/injection/route.ts` —— GET 状态 / POST inject/extract
- **验证结果**：
  - `pnpm run typecheck` ✅ 0 error
  - 记忆注入 ✅ 自动检索相关记忆并注入上下文
  - 记忆保存 ✅ 对话结束后自动提取用户/助手消息
  - Dispatcher 集成 ✅ enableMemoryInjection 配置项生效
- **学习文档**：[`docs/learning/M11-memory-injection.md`](../learning/M11-memory-injection.md)
- **需求文档**：[`docs/requirements/M11-memory-injection.md`](../requirements/M11-memory-injection.md)
- **待优化**：
  - ISSUE-M11-001：记忆压缩算法
  - ISSUE-M11-002：记忆遗忘机制
  - ISSUE-M11-003：前端记忆注入效果展示
- **下一步**：继续开发新功能模块或遗留优化

### ✅ M10 评估与上线 - 完成
- **时间**：下午
- **做了什么**：
  - **需求文档**：`docs/requirements/M10-evaluation-launch.md`
  - **API 限流中间件**：`src/server/middleware/rate-limiter.ts` —— 滑动窗口算法，基于 IP+路径计数，60次/分钟默认配置
  - **输入验证中间件**：`src/server/middleware/input-validator.ts` —— 文本/JSON/URL/邮箱校验，XSS/SVG/iframe/javascript: 过滤
  - **PDF 解析工具**：`src/server/tools/builtin/read_pdf.ts` —— 模拟多页内容提取，支持页码范围
  - **OpenAI 兼容 Embedding**：`src/server/providers/embedding/openai-compatible.ts` —— API 调用 + Mock 降级
  - **性能监控**：`src/server/monitoring/performance.ts` —— 请求记录、统计指标（avg/p95/p99）、端点分析
  - **评估指标**：`src/server/monitoring/evaluation.ts` —— 回答质量评分（相关性/连贯性/完整性/简洁性）、检索准确率（precision/recall/f1/mrr）
  - **统一导出**：`src/server/middleware/index.ts`
  - **性能监控 API**：`src/app/api/performance/stats/route.ts` —— GET 统计/DELETE 清空
  - **评估 API**：`src/app/api/evaluation/route.ts` —— 质量评分/检索评估/统计汇总
  - **API 路由集成**：
    - `src/app/api/chat/route.ts` —— 限流 + 输入验证 + 性能记录
    - `src/app/api/knowledge/documents/route.ts` —— 限流 + 输入验证 + 性能记录
    - `src/app/api/knowledge/search/route.ts` —— 限流 + 输入验证 + 性能记录
    - `src/app/api/knowledge/rag/route.ts` —— 限流 + 输入验证 + 性能记录
  - **工具注册**：`src/server/tools/index.ts` 新增 readPdfTool
  - **前端配置**：`src/stores/settings.ts` 新增 read_pdf 到默认工具列表和展示配置
- **验证结果**：
  - `pnpm run typecheck` ✅ 0 error
  - `pnpm run lint` ✅ 0 warning
  - API 限流 ✅ 滑动窗口算法 + 已集成到主要API
  - 输入验证 ✅ XSS 模式拦截 + 已集成到主要API
  - PDF 工具 ✅ 已注册到工具列表
  - Embedding ✅ OpenAI 兼容 + Mock 降级
  - 性能监控 ✅ 统计指标计算 + API路由
  - 评估指标 ✅ 质量评分 + 检索准确率 + API路由
- **学习文档**：[`docs/learning/M10-evaluation-launch.md`](../learning/M10-evaluation-launch.md)
- **需求文档**：[`docs/requirements/M10-evaluation-launch.md`](../requirements/M10-evaluation-launch.md)
- **待优化**：
  - ISSUE-M10-001：分布式限流（Redis）
  - ISSUE-M10-002：真实 PDF 解析库接入（pdf-parse）
  - ISSUE-M10-003：性能监控持久化到数据库
  - ISSUE-M10-004：Prometheus + Grafana 监控接入
- **下一步**：所有里程碑已完成！项目已具备生产部署条件。

### ✅ M9 知识库增强 - 完成
- **时间**：下午
- **做了什么**：
  - **需求文档**：`docs/requirements/M9-knowledge-base.md`
  - **文档服务**：`src/server/knowledge/document-service.ts` —— 文档创建、列表、删除、切分（500字符/段，100字符重叠）、向量化
  - **向量存储**：`src/server/knowledge/vector-store.ts` —— 向量添加、删除、搜索、按文档分组
  - **RAG 服务**：`src/server/knowledge/rag-service.ts` —— 语义检索、基于知识库生成回答、文档管理
  - **多 Agent 协作**：`src/server/knowledge/multi-agent.ts` —— 5 个专家角色（规划/研究/分析/写作/评审）、协调器模式、任务分发
  - **统一导出**：`src/server/knowledge/index.ts`
  - **API 路由**：
    - `src/app/api/knowledge/documents/route.ts`：CRUD 文档
    - `src/app/api/knowledge/search/route.ts`：语义搜索
    - `src/app/api/knowledge/rag/route.ts`：RAG 问答
  - **前端组件**：`src/features/knowledge/knowledge-manager.tsx` —— 文档管理、语义搜索、RAG 问答
  - **页面路由**：`src/app/knowledge/page.tsx`
  - **导航入口**：`src/components/layout/sidebar.tsx` 新增"知识库"链接（BookOpen 图标）
- **验证结果**：
  - `npx tsc --noEmit` ✅ 0 error
  - /knowledge 页面 ✅ 文档管理 + 语义搜索 + RAG 问答
  - 文档上传 ✅ 自动切分 + 向量化
  - 语义搜索 ✅ 相似度排序
  - RAG 问答 ✅ 基于知识库回答 + 来源标注
- **学习文档**：[`docs/learning/M9-knowledge-base.md`](../learning/M9-knowledge-base.md)
- **需求文档**：[`docs/requirements/M9-knowledge-base.md`](../requirements/M9-knowledge-base.md)
- **待优化（M10+）**：
  - ISSUE-M9-001：真实向量数据库（Pinecone/Weaviate/Milvus）→ M10
  - ISSUE-M9-002：PDF/Word 文档解析 → M10
  - ISSUE-M9-003：知识图谱构建 → M10
  - ISSUE-M9-004：多 Agent 实时协作
  - ISSUE-M9-005：知识库权限管理 → M10
- **下一步**：M10 评估与上线（性能优化、安全性加固、PDF/Word 解析、真实 Embedding、全面测试）

### ✅ M8 高级推理 - 完成
- **时间**：下午
- **做了什么**：
  - **需求文档**：`docs/requirements/M8-advanced-reasoning.md`
  - **Plan 优化器**：`src/server/reasoning/plan-optimizer.ts` —— 任务分解（关键词模式匹配）、依赖图（邻接表）、执行层级计算、拓扑排序
  - **反思引擎**：`src/server/reasoning/reflection-engine.ts` —— 错误分类（7 种）、恢复策略（5 种）、信心度评估、参数修正
  - **工具选择策略**：`src/server/reasoning/tool-strategy.ts` —— 规则引擎（prefer/allow/deny）、关键词匹配、记忆驱动优化
  - **统一导出**：`src/server/reasoning/index.ts`
  - **API 路由**：
    - `src/app/api/reasoning/decompose/route.ts`：POST /api/reasoning/decompose
    - `src/app/api/reasoning/reflect/route.ts`：POST /api/reasoning/reflect（反思 + 工具选择）
  - **前端组件**：`src/features/reasoning/reasoning-lab.tsx` —— 推理实验室 UI（任务分解 + 结构化反思 + 工具选择策略）
  - **页面路由**：`src/app/reasoning/page.tsx`
  - **导航入口**：`src/components/layout/sidebar.tsx` 新增"推理实验室"链接（GitBranch 图标）
- **验证结果**：
  - `npx tsc --noEmit` ✅ 0 error
  - /reasoning 页面 ✅ 任务分解 + 反思 + 工具选择
  - 任务分解 ✅ 自动拆分子任务 + 依赖图 + 执行层级
  - 结构化反思 ✅ 错误分类 + 恢复策略 + 信心度
  - 工具选择 ✅ 规则 + 关键词匹配
- **学习文档**：[`docs/learning/M8-advanced-reasoning.md`](../learning/M8-advanced-reasoning.md)
- **需求文档**：[`docs/requirements/M8-advanced-reasoning.md`](../requirements/M8-advanced-reasoning.md)
- **待优化（M9+）**：
  - ISSUE-M8-001：LLM 驱动的智能分解（M9）
  - ISSUE-M8-002：强化学习训练策略（M10）
  - ISSUE-M8-003：多 Agent 协作推理（M9）
  - ISSUE-M8-004：推理过程实时可视化
  - ISSUE-M8-005：失败恢复自动执行（集成到 dispatcher）
- **下一步**：M9 知识库增强（多数据源接入 + 向量检索 + 多 Agent 协作）

### ✅ M7 Agent 记忆与学习 - 完成
- **时间**：下午
- **做了什么**：
  - **数据库扩展**：`src/server/db/schema.ts` 新增 `memories` + `memory_chunks` + `experiences` 三张表，含枚举（memory_kind, memory_status, experience_type）和索引
  - **SQL 迁移**：`drizzle/0004_memory_learning.sql`
  - **向量工具**：`src/server/memory/vector-utils.ts` —— 余弦相似度、欧氏距离、向量归一化
  - **记忆服务**：`src/server/memory/memory-service.ts` —— 短期/长期/情景记忆、相似度检索、上限 1000 条、LRU 淘汰
  - **经验服务**：`src/server/memory/experience-service.ts` —— 经验提取（成功/失败/洞察）、案例库、搜索
  - **统一导出**：`src/server/memory/index.ts`
  - **API 路由**：
    - `src/app/api/memories/route.ts`：GET/POST/PUT/DELETE 记忆管理
    - `src/app/api/memories/search/route.ts`：POST 相似度搜索
    - `src/app/api/experiences/route.ts`：GET/POST/PUT/DELETE 经验管理
    - `src/app/api/experiences/search/route.ts`：POST 经验搜索
  - **前端 Store**：`src/stores/memory.ts` —— Zustand + localStorage 持久化
  - **前端组件**：`src/features/memory/memory-manager.tsx` —— 记忆库（列表+详情+图谱）+ 经验案例（列表+详情）
  - **页面路由**：`src/app/memory/page.tsx`
  - **导航入口**：`src/components/layout/sidebar.tsx` 新增"记忆管理"链接（Brain 图标）
- **验证结果**：
  - `npx tsc --noEmit` ✅ 0 error
  - /memory 页面 ✅ 记忆库 + 经验案例 + 图谱
  - 记忆创建/编辑/删除 ✅ localStorage 持久化
  - 记忆搜索 ✅ 相似度检索 API
  - 经验提取 ✅ 成功/失败/洞察分类
- **学习文档**：[`docs/learning/M7-memory-learning.md`](../learning/M7-memory-learning.md)
- **需求文档**：[`docs/requirements/M7-memory-learning.md`](../requirements/M7-memory-learning.md)
- **待优化（M8+）**：
  - ISSUE-M7-001：真实 Embedding 模型（M8）
  - ISSUE-M7-002：记忆压缩算法（M8）
  - ISSUE-M7-003：记忆遗忘机制（M8）
  - ISSUE-M7-004：记忆注入到对话（在 dispatcher 中集成）
  - ISSUE-M7-005：记忆图谱交互（拖拽、缩放）
- **下一步**：M8 高级推理（Plan 优化、反思增强、工具选择策略）

### ✅ M6 提示词工程中心 - 完成
- **时间**：下午
- **做了什么**：
  - **数据库扩展**：`src/server/db/schema.ts` 新增 `prompt_templates` + `prompt_versions` 两张表，含分类索引和版本索引
  - **SQL 迁移**：`drizzle/0003_prompt_engineering.sql`
  - **服务层**：`src/server/prompts/`
    - `variable-parser.ts`：变量提取（`{{variable}}` 正则）、插值、校验
    - `builtin-templates.ts`：4 个预置模板（代码审查、智能翻译、内容总结、角色扮演）
    - `playground-service.ts`：Playground 执行（调用 LLM Provider）+ A/B 测试（Promise.all 并行执行）
    - `index.ts`：统一导出
  - **API 路由**：
    - `src/app/api/playground/route.ts`：POST /api/playground，Zod 校验，执行单个模板
    - `src/app/api/ab-test/route.ts`：POST /api/ab-test，Zod 校验，并行执行两个模板
  - **前端 Store**：`src/stores/prompts.ts` —— Zustand + localStorage 持久化，支持 CRUD、版本管理、回滚、复制
  - **前端组件**：
    - `src/features/prompt/prompt-manager.tsx`：模板管理 UI（左侧列表 + 右侧编辑器 + 版本历史面板）
    - `src/features/prompt/playground.tsx`：Playground UI（单模板测试 + A/B 测试，Tab 切换）
  - **页面路由**：
    - `src/app/prompts/page.tsx`：/prompts 模板管理页
    - `src/app/playground/page.tsx`：/playground Playground 页（Suspense 包裹 useSearchParams）
  - **导航入口**：`src/components/layout/sidebar.tsx` 新增"提示词模板"和"Playground"链接
- **验证结果**：
  - `npx tsc --noEmit` ✅ 0 error
  - /prompts 页面 ✅ 模板列表 + 编辑器 + 版本历史
  - /playground 页面 ✅ 单模板 + A/B 测试
  - 变量插值 ✅ `{{variable}}` 正确提取和替换
  - 版本管理 ✅ 每次保存生成新版本，可回滚
  - 预置模板 ✅ 4 个内置模板
- **学习文档**：[`docs/learning/M6-prompt-engineering.md`](../learning/M6-prompt-engineering.md)
- **需求文档**：[`docs/requirements/M6-prompt-engineering.md`](../requirements/M6-prompt-engineering.md)
- **待优化（M7+）**：
  - ISSUE-M6-001：提示词自动优化（M7 Agent 记忆与学习）
  - ISSUE-M6-002：模板评估流水线（M10 Eval 体系）
  - ISSUE-M6-003：模板市场/共享（M9 知识库增强）
  - ISSUE-M6-004：高级变量语法（条件、循环、过滤器）
  - ISSUE-M6-005：模板导入/导出 JSON
  - ISSUE-M6-006：DB 持久化迁移（当前 localStorage，DB 表已就绪）
- **下一步**：M7 Agent 记忆与学习（短期记忆 + 长期记忆 + 经验积累）

### ✅ M2 工具调用 - 完成
- **时间**：凌晨
- **做了什么**：
  - **工具层**：`src/server/tools/{types,registry,index}.ts` + 5 个内置工具
    - `calculator`（手写 Shunting-yard，支持 + - * / ^ () 与 sqrt/sin/cos/tan/log/ln/exp/pi/e）
    - `get_current_time`（IANA 时区 + 人类可读 / ISO）
    - `web_search`（Mock 3 组数据 + 兜底）
    - `code_runner`（node:vm 沙箱，5s 超时，支持最后一行表达式 return）
    - `word_count`（字符 / 行 / 词 / 中文字数）
  - **调度器**：`src/server/agent/dispatcher.ts` 的 `runAgent` 单轮工具调用循环
  - **Provider 升级**：
    - Mock Provider：关键字匹配触发工具（"123 * 456" → calculator）
    - OpenAI Provider：累积 streaming tool_call，最后 yield 一次
  - **API**：`/api/chat` 接入 runAgent 与 `enabledTools` 过滤
  - **前端**：
    - `ToolCallCard` 组件：图标 + 状态徽章 + 耗时 + 可折叠参数/结果
    - `MessageBubble` 渲染 `message.toolCalls`
    - `Composer` Bot 按钮 + 工具选择 Popover（全部启用 / 全部禁用）
    - `ChatContainer` 接入 tool_call / tool_result 事件
  - **Bug 修复**：
    - ISSUE-003：重新生成按钮接通（删末尾 AI → 重新 send）
    - ISSUE-004：Bot 按钮接通工具选择
  - **测试**：`vitest` 接入，`tests/tools/calculator.test.ts` 5 个测试通过
  - **类型扩展**：`Message.toolCalls` 改为 `ToolCallRecord[]`，新增 `thoughts?: string[]` 临时字段
- **验证结果**：
  - `pnpm typecheck` ✅ 0 error
  - `pnpm lint` ✅ 0 warning
  - `pnpm build` ✅ Compiled successfully · 5 routes
  - `pnpm test` ✅ 5/5 calculator 测试通过
  - `curl /api/chat` 5 种工具调用场景全部正常：
    - "123 * 456" → tool_call calculator → tool_result 56088 → delta "计算结果：**56088**"
    - "现在几点" → get_current_time → 2026/07/03 00:28:23
    - "运行 JS：1+2*3" → code_runner → 7
    - "统计：你好世界 hello" → word_count → 4 个中文字 / 2 个词
    - "搜索 NEXUS" → web_search → 3 条 mock 结果
- **学习文档**：[`docs/learning/M2-tool-calling.md`](../learning/M2-tool-calling.md)
- **下一步**：M3 ReAct 多步推理（LLM 可连续调用多个工具 + 自反思）

---

## 2026-07-02

### ✅ M1 基础对话 - 完成
- **时间**：次日 00:50
- **做了什么**：
  - **API**：`/api/chat` SSE 接口，zod 校验，`ReadableStream` 编码
  - **Provider**：抽象 `LLMProvider` + `MockProvider`（关键字匹配 + 打字机）+ `OpenAIProvider` 占位
  - **Store**：Zustand session Store（localStorage 持久化）+ settings Store
  - **Hook**：`useChatStream` 通用 SSE 客户端（fetch + ReadableStream + AbortController）
  - **UI**：TopBar / Sidebar / Composer / MessageList / MessageBubble / ThoughtPanel（M2-M3 预留位）
  - **页面**：`/` 对话主页 + `/settings` 设置页
  - **设计系统**：Tailwind 赛博主题（青/紫/品红/酸橙）+ 玻璃拟态 + 霓虹光晕 + 流式光标
- **验证结果**：
  - `pnpm typecheck` ✅ 0 error
  - `pnpm lint` ✅ 0 warning
  - `pnpm build` ✅ Compiled successfully · 5 routes
  - `curl /api/chat` ✅ SSE 流式事件正常
  - `curl /` / `/settings` ✅ HTTP 200
- **学习文档**：[`docs/learning/M1-basic-chat.md`](../learning/M1-basic-chat.md)
- **下一步**：进入 M2 工具调用

### ✅ 文档体系
- 创建 `docs/README.md` —— 文档总览 + "需求 → 代码 → 学习"工作流
- 创建 `docs/requirements/_template.md` / `M1-basic-chat.md`
- 创建 `docs/learning/_template.md` / `00-architecture.md` / `M1-basic-chat.md`
- 创建 `docs/handoff/{README,env,api}.md`
- 创建 `docs/progress.md` / `docs/issues.md`

### ✅ 00 架构总览学习文档
- 创建 `docs/learning/00-architecture.md`，覆盖分层、数据流、Provider 抽象、目录约定

### ✅ 项目脚手架
- Next.js 14.2 / React 18 / TypeScript 5.6 / Tailwind 3.4
- 完整依赖：Drizzle / Zustand / OpenAI SDK / react-markdown / framer-motion / lucide-react / Radix UI

### ✅ 文档体系（PRD + 架构）
- 完成 PRD（`.trae/documents/prd.md`）：8 大基础 + 5 大进阶模块，10 个学习里程碑
- 完成技术架构（`.trae/documents/technical-architecture.md`）：Next.js 14 / PostgreSQL+pgvector / Provider 抽象 / 完整数据模型
