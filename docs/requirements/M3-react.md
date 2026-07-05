# M3: ReAct 多步推理 + 数据库持久化

> 需求文档，动手写代码前先填齐。

## 基本信息

- **里程碑**：M3
- **标题**：ReAct 多步推理 + 数据库持久化
- **负责人**：
- **创建日期**：2026-07-03
- **状态**：✅ 已完成

---

## 1. 背景与目标

M2 实现了单轮工具调用，但现实任务很少 1 步就能解决。同时浏览器关掉数据就丢失。本里程碑升级为多轮推理 + 自反思 + PostgreSQL 持久化。

## 2. 用户故事

- 作为用户，我希望 AI 能连续调用多个工具完成复杂任务
- 作为用户，我希望 AI 答错时能自动反思并重试
- 作为用户，我希望关闭浏览器后对话历史不丢失

## 3. 功能范围

### 3.1 包含（In Scope）

- 多轮工具调用（maxToolRounds=5）
- Plan-and-Execute 模式（plan 事件 + todo 列表）
- Reflexion 自反思（评分 < 0.6 自动重试）
- PostgreSQL 持久化（agent_runs / agent_steps / tool_calls 表）
- ThoughtPanel 可视化（计划清单 + 反思评分）

### 3.2 不包含（Out of Scope）

- 向量检索 / RAG（M9）
- 多智能体协作（M14）
- 真实 LLM 反思评分（使用 Mock）

## 4. 验收标准

- [x] maxToolRounds=5 工作（plan → tool_call → tool_result → reflection → delta）
- [x] 输入"计划 xxx"看到 Plan todo 列表
- [x] 反思评分 < 0.6 时自动重试
- [x] agent_runs / agent_steps / tool_calls 落 PostgreSQL

## 5. 技术约束

- 依赖的库：drizzle-orm、postgres（已引入）
- 影响的模块：src/server/agent/dispatcher.ts、src/server/db/schema.ts
- 兼容要求：每次工具调用必须落库

## 6. 拆分与排期

| # | 子任务 | 状态 |
|---|--------|------|
| 1 | DB schema 设计 | ✅ |
| 2 | dispatcher 多轮循环 | ✅ |
| 3 | Plan-and-Execute 事件流 | ✅ |
| 4 | Reflexion 自反思引擎 | ✅ |
| 5 | ThoughtPanel 可视化 | ✅ |

## 7. 关联文档

- 学习文档：docs/learning/M3-react.md
