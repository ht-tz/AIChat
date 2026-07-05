# M14: 多智能体协作增强

> 需求文档，动手写代码前先填齐。

## 基本信息

- **里程碑**：M14
- **标题**：多智能体协作增强
- **负责人**：
- **创建日期**：2026-07-03
- **状态**：🚧 进行中

---

## 1. 背景与目标

### 项目背景

AI Agent 平台 NEXUS 基于 Next.js 14 App Router + TypeScript + Drizzle ORM + PostgreSQL 构建。目前已有基础多智能体实现（`src/server/knowledge/multi-agent.ts`），包含 5 个专家角色（planner/researcher/analyst/writer/reviewer）和简单协调器模式，采用串行执行方式。

### 存在问题

- 当前协调器仅支持简单串行执行，无法表达复杂的并行/分支工作流
- Agent 角色硬编码，用户无法自定义或扩展
- Agent 之间缺乏结构化的消息传递机制和共享上下文
- 运行过程缺乏可观测性，无法追踪每一步的状态和耗时
- 没有数据库持久化，运行历史无法回溯

### 核心目标

将简单串行协调器升级为完整的多智能体协作框架，支持工作流编排、自定义角色、消息总线、运行追踪和数据持久化。

### 业务价值

- 提升复杂任务的处理效率（并行执行缩短总耗时）
- 增强系统灵活性（用户可按需配置 Agent 团队）
- 提高可调试性和可观测性（完整的运行追踪）
- 为后续 M15 过程可视化提供后端支撑

---

## 2. 用户故事

- 作为研究人员，我想配置一个"研究分析流"工作流，让研究和分析并行执行，以便更快获得洞察
- 作为团队管理员，我想创建自定义 Agent 角色，以便适配特定业务场景
- 作为开发者，我想查看每次多智能体运行的详细步骤和耗时，以便调试和优化
- 作为产品经理，我想通过 API 启动多智能体任务并实时接收进度事件，以便集成到业务系统

---

## 3. 功能范围

### 3.1 包含（In Scope）

#### 3.1.1 工作流引擎

- **Stage（阶段）概念**：每个 Stage 包含多个可并行的 Agent
- **执行模式**：Stage 间串行，Stage 内并行
- **依赖声明**：上一阶段输出可作为下一阶段输入
- **内置 3 种工作流模板**：
  - 研究分析流（Research → Analysis → Review）
  - 创意写作流（Creative → Writer → Reviewer）
  - 代码开发流（Planner → Coder → Tester）

#### 3.1.2 自定义 Agent 角色

- 每个 Agent 配置项：角色名、名称、系统提示词、可用工具列表、温度参数
- 预置 8 个 Agent：
  - 规划师（Planner）
  - 研究员（Researcher）
  - 分析师（Analyst）
  - 写作者（Writer）
  - 评审员（Reviewer）
  - 创意师（Creative）
  - 编码员（Coder）
  - 测试员（Tester）
- 支持新增/编辑/删除自定义 Agent
- Agent 配置持久化到数据库

#### 3.1.3 Agent 间消息总线

- `sharedContext` 共享上下文对象
- 每个 Agent 可发布消息到总线
- 阶段结束时自动汇总输出到上下文
- 消息支持类型标签（info / result / error / log）

#### 3.1.4 运行追踪 + SSE 事件流

- 运行 ID 唯一标识
- 状态管理（pending / running / completed / failed / cancelled）
- 步骤记录（每步的 Agent、输入、输出、耗时、状态）
- 整体耗时统计
- SSE 实时推送事件：
  - `agent_started` — Agent 开始执行
  - `agent_completed` — Agent 执行完成
  - `stage_completed` — 阶段完成
  - `run_completed` — 整个运行完成

#### 3.1.5 数据库扩展

三张新表：

- **`agent_teams`** — Agent 团队配置
  - id, name, description, workflow_config, created_at, updated_at

- **`agent_runs`** — 运行记录
  - id, team_id, status, started_at, completed_at, total_duration_ms, error, input, output

- **`agent_steps`** — 步骤明细
  - id, run_id, stage_index, agent_name, status, started_at, completed_at, duration_ms, input, output, error

#### 3.1.6 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/multi-agent/teams` | 团队列表 |
| POST | `/api/multi-agent/teams` | 创建团队 |
| POST | `/api/multi-agent/run` | 启动运行（SSE 流） |
| GET | `/api/multi-agent/runs` | 历史运行列表 |
| GET | `/api/multi-agent/runs/[id]` | 运行详情 |

### 3.2 不包含（Out of Scope）

- 可视化编辑器（M15 覆盖）
- 条件分支的动态决策（下一版本）
- Agent 间直接对话（当前仅通过共享上下文间接通信）
- 分布式执行（所有 Agent 在同一进程内执行）
- 运行暂停/恢复（M15 部分覆盖）

---

## 4. 验收标准

- [ ] 工作流引擎能正确执行串行 Stage，Stage 内多 Agent 并行
- [ ] 内置 3 种工作流模板可直接使用，输出符合预期
- [ ] 可通过 API 创建自定义 Agent 角色，并持久化到数据库
- [ ] Agent 执行时可读取 sharedContext，也可发布消息到总线
- [ ] 每次运行生成唯一 runId，步骤和状态完整记录
- [ ] SSE 事件按顺序推送，前端可实时接收
- [ ] `agent_teams`、`agent_runs`、`agent_steps` 三张表 DDL 正确，Drizzle schema 已定义
- [ ] 5 个 API 端点全部可用，返回格式符合 REST 规范
- [ ] 错误场景有合理处理（Agent 失败不影响同 Stage 其他 Agent，标记为 failed）
- [ ] 单元测试覆盖核心工作流逻辑（并行执行、上下文传递、状态流转）

---

## 5. 交互 / UI 说明

本里程碑主要是后端能力建设，UI 层面仅需：

- **API 测试可用**：通过 curl 或 API 客户端可验证所有端点
- **数据库可查询**：运行历史可通过数据库直接查询验证

完整的可视化 UI 在 M15 实现。

---

## 6. 技术约束

### 依赖的库 / 服务

- `drizzle-orm` — 数据库 ORM（已存在）
- `postgres` — PostgreSQL 驱动（已存在）
- `zod` — 数据验证（已存在）
- `ai` — Vercel AI SDK，用于 LLM 调用（已存在）

### 影响的模块

- `src/server/knowledge/multi-agent.ts` — 重构现有多智能体实现
- `src/server/db/schema.ts` — 新增 3 张表定义
- `src/server/db/migrations/` — 新增迁移脚本
- `src/app/api/multi-agent/` — 新增 5 个 API 路由
- `src/lib/types/multi-agent.ts` — 新增类型定义

### 性能 / 安全 / 兼容要求

- 并行执行需控制并发数（默认同 Stage 最多 5 个 Agent 同时执行）
- SSE 连接需处理异常断开和重连
- API 端点需做输入验证（zod）
- 运行数据需关联用户（多租户隔离）
- 大文本输出需考虑存储优化（output 字段用 text 类型）

---

## 7. 风险与备选

| 风险 | 可能性 | 影响 | 应对方案 |
|------|--------|------|----------|
| 并行执行导致 LLM API 限流 | 中 | 高 | 实现简单的令牌桶限流，同 Stage 并发数可配置 |
| SSE 连接不稳定导致事件丢失 | 中 | 中 | 前端可通过 runId 轮询补全状态，事件带序号 |
| 共享上下文过大导致 token 超限 | 高 | 高 | 上下文摘要机制，仅传递关键信息而非完整输出 |
| 数据库写入频繁影响性能 | 低 | 中 | 步骤状态更新可批量写入，或使用异步队列 |
| 工作流配置复杂度高，难以调试 | 中 | 中 | 提供 dry-run 模式，输出执行计划而不实际调用 LLM |

### 备选方案

- **备选 1**：若并行执行实现复杂，先做 Stage 串行 + Stage 内串行，预留并行接口
- **备选 2**：若 SSE 实现有问题，先用轮询（polling）方式，后续再升级 SSE

---

## 8. 拆分与排期

### 第 1 天：数据模型 + 基础类型

- [ ] 设计并定义 `agent_teams`、`agent_runs`、`agent_steps` 表的 Drizzle schema
- [ ] 编写数据库迁移脚本
- [ ] 定义 TypeScript 类型（Workflow、Stage、AgentConfig、RunStatus 等）

### 第 2 天：工作流引擎核心

- [ ] 实现 Stage 串行执行逻辑
- [ ] 实现 Stage 内并行执行（Promise.all）
- [ ] 实现 sharedContext 消息总线
- [ ] 实现依赖传递（上阶段输出 → 下阶段输入）

### 第 3 天：Agent 角色 + 模板

- [ ] 定义 8 个预置 Agent 的系统提示词和配置
- [ ] 实现 3 种内置工作流模板
- [ ] 实现 Agent 执行器（调用 LLM + 工具）
- [ ] 单元测试：工作流执行逻辑

### 第 4 天：运行追踪 + 状态管理

- [ ] 实现运行状态机（pending → running → completed/failed/cancelled）
- [ ] 实现步骤记录和耗时统计
- [ ] 实现数据库持久化（运行开始/完成/步骤更新）
- [ ] 错误处理和降级策略

### 第 5 天：SSE 事件流

- [ ] 实现 SSE 事件生成器
- [ ] 定义 4 种事件类型的 payload 格式
- [ ] 在工作流执行各节点埋点发射事件
- [ ] 测试 SSE 连接稳定性和事件顺序

### 第 6 天：API 端点

- [ ] `GET /api/multi-agent/teams` — 团队列表
- [ ] `POST /api/multi-agent/teams` — 创建团队
- [ ] `POST /api/multi-agent/run` — 启动运行（SSE）
- [ ] `GET /api/multi-agent/runs` — 历史列表
- [ ] `GET /api/multi-agent/runs/[id]` — 详情

### 第 7 天：集成测试 + 文档

- [ ] 端到端测试：从创建团队到运行完成的完整流程
- [ ] 错误场景测试（Agent 失败、网络超时等）
- [ ] 编写 API 文档
- [ ] Code Review + 修复

**总计：7 人天**

---

## 9. 自测计划

### 数据库验证

```bash
# 执行迁移
npm run db:migrate

# 检查表是否创建成功
psql -d nexus -c "\dt agent_*"
```

### API 测试

```bash
# 1. 创建团队
curl -X POST http://localhost:3000/api/multi-agent/teams \
  -H "Content-Type: application/json" \
  -d '{"name":"测试团队","workflowConfig":{...}}'

# 2. 启动运行（观察 SSE 流）
curl -N -X POST http://localhost:3000/api/multi-agent/run \
  -H "Content-Type: application/json" \
  -d '{"teamId":"xxx","input":"测试任务"}'

# 3. 查询历史
curl http://localhost:3000/api/multi-agent/runs

# 4. 查询详情
curl http://localhost:3000/api/multi-agent/runs/[id]
```

### 单元测试

```bash
npm test -- --grep "multi-agent"
```

### 验证清单

- [ ] 工作流模板能正确执行并产出结果
- [ ] 并行执行确实缩短了总耗时（对比串行）
- [ ] SSE 事件按预期顺序到达
- [ ] 数据库记录完整，步骤明细可追溯
- [ ] 错误发生时状态正确标记，不阻塞其他 Agent

---

## 10. 关联文档

- 对应学习文档：待补充
- 对应 PRD 章节：多智能体协作模块
- 对应技术架构章节：Agent 编排层
- 前置依赖：M9 知识库（知识库工具集成）
- 后续依赖：M15 过程可视化
