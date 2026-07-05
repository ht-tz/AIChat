# M16-M20: LangChain + LangGraph 集成（学习导向）

## 背景

本项目已自研了完整的 LLM Agent 链路（Provider、Tool、RAG、Memory、WorkflowEngine），目的是学习 AI Agent 全栈开发。现引入业界主流框架 LangChain + LangGraph，通过**自研 → 框架对比**的学习路径，深入理解工业级 AI Agent 架构。

## 学习目标

| 里程碑 | 学习重点 | 对比自研模块 |
|--------|---------|-------------|
| M16 | LangChain LLM 抽象层、Prompt Template、Output Parser | `src/server/providers/` |
| M17 | LangChain Tools + RAG（DocumentLoader、TextSplitter、Retriever） | `src/server/tools/` + `src/server/knowledge/` |
| M18 | LangGraph StateGraph、节点、边、多智能体编排 | `src/server/multi-agent/workflow-engine.ts` |
| M19 | LangGraph Checkpoint、HITL、断点续跑、时间旅行 | `src/app/api/reasoning/` |
| M20 | 对比学习文档：自研 vs LangChain/LangGraph 架构分析 | 全项目 |

## 设计原则

1. **不替换现有代码** — 新增 `src/server/langchain/` 目录，与自研模块并存
2. **双引擎模式** — API 和 UI 支持切换「自研引擎」和「LangChain 引擎」
3. **学习优先** — 每个模块包含详细注释，标注与自研方案的对比

---

## M16: LangChain 基础集成

### 需求思路

学习 LangChain 的三大基础抽象：
- **ChatModel** — 统一 LLM 调用接口（对比自研 `LLMProvider` 接口）
- **PromptTemplate** — 参数化提示词模板（对比自研 `prompt-templates.ts`）
- **OutputParser** — 结构化输出解析（对比自研 Zod 验证 + JSON.parse）

### 功能范围

1. **LangChain Provider 适配器**
   - 新建 `src/server/langchain/provider.ts`
   - 使用 `@langchain/openai` 的 `ChatOpenAI`，支持 OpenAI/DeepSeek/通义/Kimi 等兼容 API
   - 适配现有 `LLMProvider` 接口，使 `getProvider()` 可返回 LangChain 实现
   - 环境变量 `LLM_PROVIDER=langchain` 切换

2. **PromptTemplate 实验室**
   - 新建 `src/server/langchain/prompts.ts`
   - 使用 `ChatPromptTemplate` 重写关键提示词（规划、推理、RAG）
   - 与 `src/server/db/schema.ts` 中 `promptTemplates` 表联动

3. **OutputParser 实验**
   - 使用 `StructuredOutputParser` + Zod 替代手写 JSON.parse
   - 对比 `auth-service.ts` 中的 `JSON.parse(planResult.content)` 方案

4. **API 端点**
   - `POST /api/langchain/chat` — 使用 LangChain ChatModel 对话
   - `POST /api/langchain/prompt` — 使用 PromptTemplate 生成

5. **学习对比页**
   - 新增 `/langchain` 页面，左侧自研引擎、右侧 LangChain 引擎
   - 同一输入双引擎对比输出

### 数据库扩展
- 无（复用现有 `promptTemplates` 表）

### 验收标准
- `LLM_PROVIDER=langchain` 可正常对话
- PromptTemplate 可动态渲染变量
- StructuredOutputParser 可解析 JSON 输出
- 双引擎对比页可正常展示

---

## M17: LangChain Tools + RAG 集成

### 需求思路

学习 LangChain 的工具系统和 RAG 管线：
- **DynamicTool** — 动态创建工具（对比自研 `Tool` 接口 + `toolRegistry`）
- **DocumentLoader** — 文档加载（对比自研 `documentService` 手动解析）
- **TextSplitter** — 文本分块（对比自研固定 500 字符分块）
- **VectorStore** — 向量存储（对比自研 `vectorStore` + pgvector）
- **Retriever** — 检索器（对比自研 `ragService.retrieve()`）

### 功能范围

1. **Tool 适配层**
   - 新建 `src/server/langchain/tools-adapter.ts`
   - 将现有 8 个内置工具（calculator/web_search/code_runner 等）适配为 LangChain `DynamicTool`
   - 使用 `@langchain/core/tools` 的 `tool()` 函数
   - 支持 `ToolCallingAgent` 自动选择和调用工具

2. **RAG 管线**
   - 新建 `src/server/langchain/rag.ts`
   - `RecursiveCharacterTextSplitter` 替代固定分块
   - `MemoryVectorStore` 或对接现有 pgvector
   - `RetrievalQAChain` 端到端 RAG 问答

3. **DocumentLoader 集成**
   - 使用 `TextLoader` / `PDFLoader` 替代手写文件解析
   - 对比 `read_file.ts` 和 `read_pdf.ts` 的实现

4. **API 端点**
   - `POST /api/langchain/tools/run` — LangChain 工具调用
   - `POST /api/langchain/rag/query` — LangChain RAG 问答

5. **学习对比**
   - 对比自研分块策略（500 字符）vs RecursiveCharacterTextSplitter（递归分块）
   - 对比自研检索（cosine similarity）vs LangChain Retriever

### 验收标准
- 现有 8 个工具可通过 LangChain `DynamicTool` 调用
- RecursiveCharacterTextSplitter 可正确分块
- RetrievalQAChain 可端到端 RAG 问答
- 对比文档记录两种方案差异

---

## M18: LangGraph 状态图 + 多智能体编排

### 需求思路

学习 LangGraph 的图编排模型：
- **StateGraph** — 状态图（对比自研 `WorkflowEngine` 的 Stage 串行+并行）
- **Node** — 节点函数（对比自研 `ExpertAgent`）
- **Edge** — 边和条件路由（对比自研固定阶段顺序）
- **Multi-Agent** — 多智能体协作（对比自研 `MultiAgentCoordinator`）

### 功能范围

1. **StateGraph 基础**
   - 新建 `src/server/langchain/graph.ts`
   - 定义 `AgentState`（messages、current_agent、results、shared_context）
   - 为 8 个预置 Agent 各创建一个节点函数
   - 使用条件边实现阶段路由

2. **多智能体编排**
   - 使用 LangGraph 实现 M14 的 3 种工作流模板
   - 研究分析流：planner → researcher → analyst → writer → reviewer
   - 创意写作流：planner → creative → writer → reviewer → writer
   - 代码开发流：planner → coder → tester → reviewer → writer
   - 支持 Stage 内并行（`addConditionalEdges`）

3. **SSE 事件集成**
   - LangGraph 执行过程映射为现有 SSE 事件协议
   - `on_run_start` → `run_started`
   - 节点开始 → `agent_started`
   - 节点完成 → `agent_completed`
   - 图完成 → `run_completed`

4. **双引擎切换**
   - `POST /api/multi-agent/run` 新增 `engine` 参数：`"builtin"` | `"langgraph"`
   - 前端 `/collaboration` 页面添加引擎切换开关

5. **API 端点**
   - `POST /api/langchain/graph/run` — LangGraph 执行（SSE）

### 验收标准
- LangGraph 可执行 3 种工作流模板
- SSE 事件与现有前端可视化兼容
- 引擎切换开关可正常工作
- 对比自研 WorkflowEngine 的差异

---

## M19: LangGraph HITL + Checkpoint

### 需求思路

学习 LangGraph 的高级特性：
- **Checkpoint** — 状态持久化（对比自研内存 Map 存储）
- **HITL (Human-in-the-Loop)** — 人工介入（对比自研 `requireConfirm` 机制）
- **断点续跑** — 从 Checkpoint 恢复执行
- **时间旅行** — 回滚到历史状态

### 功能范围

1. **Checkpoint 持久化**
   - 新建 `src/server/langchain/checkpoint.ts`
   - 使用 `MemorySaver` 或自定义 Postgres Checkpointer
   - 每次节点执行后自动保存 Checkpoint
   - 支持按 `thread_id` 查询历史

2. **HITL 人工审批**
   - 在工具调用前插入人工审批节点
   - 使用 `interrupt_before` 暂停执行
   - 前端展示审批请求，用户 approve/reject 后继续
   - 对比自研 `Tool.requireConfirm` 机制

3. **断点续跑**
   - API: `POST /api/langchain/graph/resume` — 从 Checkpoint 恢复
   - API: `GET /api/langchain/graph/states/:threadId` — 查看状态历史
   - 前端展示状态时间线，支持回滚

4. **时间旅行**
   - 可选择任意历史 Checkpoint 作为起点重新执行
   - 对比自研推理实验室的反思重试机制

5. **API 端点**
   - `POST /api/langchain/graph/resume` — 断点续跑
   - `GET /api/langchain/graph/states/:threadId` — 状态历史
   - `POST /api/langchain/graph/rollback` — 回滚到指定状态

### 验收标准
- Checkpoint 可正确保存和恢复
- HITL 审批流程可正常工作
- 断点续跑可从中断点继续
- 状态历史可查看和回滚

---

## M20: 对比学习文档

### 需求思路

编写系统性的对比学习文档，覆盖：
- 架构设计对比
- 代码复杂度对比
- 性能对比
- 适用场景分析
- 学习收获总结

### 文档清单

1. **`docs/learning/M16-langchain-basics.md`** — LangChain 三大基础抽象
2. **`docs/learning/M17-langchain-tools-rag.md`** — 工具系统与 RAG 管线
3. **`docs/learning/M18-langgraph-state-graph.md`** — 状态图与多智能体
4. **`docs/learning/M19-langgraph-hitl.md`** — Checkpoint 与人工介入
5. **`docs/learning/M20-self-built-vs-langchain.md`** — 综合对比分析

### 对比维度

| 维度 | 自研方案 | LangChain/LangGraph |
|------|---------|-------------------|
| 代码量 | 少（~2000 行） | 少（适配层 ~500 行）+ 框架（~50000 行） |
| 学习曲线 | 低（全部自己写） | 中（需学抽象层） |
| 灵活性 | 高（完全可控） | 中（受框架约束） |
| 生态 | 无 | 50+ Provider、100+ Tool |
| 可维护性 | 中（需自己维护） | 高（社区维护） |
| 调试 | 容易（代码透明） | 较难（框架黑盒） |

---

## 执行计划

```
M16 LangChain 基础     ────→  安装依赖 + Provider 适配 + PromptTemplate + OutputParser + API + 对比页
M17 Tools + RAG       ────→  工具适配层 + DocumentLoader + TextSplitter + Retriever + RAG Chain
M18 LangGraph 状态图   ────→  StateGraph + 8 节点 + 3 模板 + SSE 适配 + 双引擎切换
M19 HITL + Checkpoint  ────→  Checkpoint + 人工审批 + 断点续跑 + 时间旅行
M20 对比学习文档       ────→  5 篇对比文档 + 架构图 + 总结
```

## 环境变量

```env
# LangChain
LLM_PROVIDER=langchain          # 切换到 LangChain 引擎
LANGCHAIN_API_KEY=              # LangSmith 追踪（可选）
LANGCHAIN_PROJECT=nexus-ai      # LangSmith 项目名

# 复用现有
OPENAI_BASE_URL=
OPENAI_API_KEY=
DEFAULT_MODEL=
EMBEDDING_MODEL=
```

## 风险与备选

| 风险 | 备选方案 |
|------|---------|
| LangChain 版本更新 breaking changes | 锁定版本，逐步升级 |
| LangChain.js 生态不如 Python 版完善 | 重点关注 JS 版特有能力 |
| 框架抽象层增加理解难度 | 先跑通示例再深入源码 |
| 双引擎增加代码复杂度 | 使用 Feature Flag 控制 |
