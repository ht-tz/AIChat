# 项目文档中心

本目录是 **NEXUS · AI Agent** 项目的"开发日志 + 学习笔记"中枢，配合 `.trae/documents/` 下的 PRD 与技术架构使用。

## 目录结构

```
docs/
├── README.md                 ← 本文件：文档总览与工作流
├── progress.md               ← 实时开发进度（按时间倒序）
├── issues.md                 ← 开发过程中遇到的问题与解决方案
├── backlog.md                ← 需求待办池（各里程碑遗留优化项）
├── production-audit.md       ← 生产级审计报告（37 项差距分析）
├── requirements/             ← 需求文档（24 份）
│   ├── M1-basic-chat.md ~ M24-production-hardening.md
│   └── _template.md
├── learning/                 ← 学习文档
│   ├── 00-architecture.md    ← 项目架构总览
│   ├── M1 ~ M24 学习笔记
│   └── _template.md
└── handoff/                  ← 交接文档
    ├── README.md             ← 交接说明
    ├── env.md                ← 环境与启动说明
    └── api.md                ← API 接口文档
```

## 工作流（强约束）

> **需求先行**：任何功能在动手写代码前，必须先有 `requirements/MN-xxx.md`。
> **学习收尾**：每个功能完成后，必须产出 `learning/MN-xxx.md`。
> **进度同步**：每个关键节点（开工 / 完成 / 阻塞）必须更新 `progress.md`。
> **问题留痕**：踩到的坑、临时方案、待重构项必须写进 `issues.md`。

### 标准流程

```
1. 收到新功能任务
        ↓
2. 在 requirements/ 写需求文档（功能、范围、验收）
        ↓
3. 等待用户 / 自己确认需求
        ↓
4. 更新 progress.md（开始开发）
        ↓
5. 写代码
        ↓
6. 写自测 / 跑通
        ↓
7. 在 learning/ 写学习文档（思路 / 架构 / 拓展 / 示例）
        ↓
8. 更新 progress.md（完成）+ issues.md（如有）
```

## 模板

- 需求模板：[requirements/_template.md](requirements/_template.md)
- 学习模板：[learning/_template.md](learning/_template.md)

## 里程碑索引

### 基础能力

| 里程碑 | 标题 | 需求 | 学习 | 状态 |
|--------|------|------|------|------|
| 00 | 项目架构总览 | — | [learning/00-architecture.md](learning/00-architecture.md) | ✅ |
| M1 | 基础对话 | [requirements/M1-basic-chat.md](requirements/M1-basic-chat.md) | [learning/M1-basic-chat.md](learning/M1-basic-chat.md) | ✅ |
| M2 | 工具调用 | [requirements/M2-tool-calling.md](requirements/M2-tool-calling.md) | [learning/M2-tool-calling.md](learning/M2-tool-calling.md) | ✅ |
| M3 | ReAct 多步推理 + DB | [requirements/M3-react.md](requirements/M3-react.md) | [learning/M3-react.md](learning/M3-react.md) | ✅ |
| M4 | 多模态 + 存储 | [requirements/M4-multimodal-storage.md](requirements/M4-multimodal-storage.md) | [learning/M4-multimodal-storage.md](learning/M4-multimodal-storage.md) | ✅ |
| M5 | 报告与发布 | [requirements/M5-report-publish.md](requirements/M5-report-publish.md) | [learning/M5-report-publish.md](learning/M5-report-publish.md) | ✅ |

### 进阶能力

| 里程碑 | 标题 | 需求 | 学习 | 状态 |
|--------|------|------|------|------|
| M6 | 提示词工程中心 | [requirements/M6-prompt-engineering.md](requirements/M6-prompt-engineering.md) | [learning/M6-prompt-engineering.md](learning/M6-prompt-engineering.md) | ✅ |
| M7 | Agent 记忆与学习 | [requirements/M7-memory-learning.md](requirements/M7-memory-learning.md) | [learning/M7-memory-learning.md](learning/M7-memory-learning.md) | ✅ |
| M8 | 高级推理 | [requirements/M8-advanced-reasoning.md](requirements/M8-advanced-reasoning.md) | [learning/M8-advanced-reasoning.md](learning/M8-advanced-reasoning.md) | ✅ |
| M9 | 知识库增强 | [requirements/M9-knowledge-base.md](requirements/M9-knowledge-base.md) | [learning/M9-knowledge-base.md](learning/M9-knowledge-base.md) | ✅ |
| M10 | 评估与上线 | [requirements/M10-evaluation-launch.md](requirements/M10-evaluation-launch.md) | [learning/M10-evaluation-launch.md](learning/M10-evaluation-launch.md) | ✅ |
| M11 | 记忆注入 | [requirements/M11-memory-injection.md](requirements/M11-memory-injection.md) | [learning/M11-memory-injection.md](learning/M11-memory-injection.md) | ✅ |

### 安全认证

| 里程碑 | 标题 | 需求 | 学习 | 状态 |
|--------|------|------|------|------|
| M12 | 权限认证系统 | [requirements/M12-auth-system.md](requirements/M12-auth-system.md) | [learning/M12-auth-system.md](learning/M12-auth-system.md) | ✅ |
| M13 | OAuth + 邮箱验证 | [requirements/M13-oauth-email.md](requirements/M13-oauth-email.md) | [learning/M13-oauth-email.md](learning/M13-oauth-email.md) | ✅ |

### 多智能体

| 里程碑 | 标题 | 需求 | 学习 | 状态 |
|--------|------|------|------|------|
| M14 | 多智能体协作增强 | [requirements/M14-multi-agent-enhanced.md](requirements/M14-multi-agent-enhanced.md) | [learning/M14-M15-multi-agent-visualization.md](learning/M14-M15-multi-agent-visualization.md) | ✅ |
| M15 | 过程可视化 | [requirements/M15-process-visualization.md](requirements/M15-process-visualization.md) | [learning/M14-M15-multi-agent-visualization.md](learning/M14-M15-multi-agent-visualization.md) | ✅ |

### LangChain/LangGraph

| 里程碑 | 标题 | 需求 | 学习 | 状态 |
|--------|------|------|------|------|
| M16 | LangChain 基础集成 | [requirements/M16-langchain-basics.md](requirements/M16-langchain-basics.md) | [learning/M16-langchain-basics.md](learning/M16-langchain-basics.md) | ✅ |
| M17 | LangChain Tools + RAG | [requirements/M17-langchain-tools-rag.md](requirements/M17-langchain-tools-rag.md) | [learning/M17-langchain-tools-rag.md](learning/M17-langchain-tools-rag.md) | ✅ |
| M18 | LangGraph 状态图 | [requirements/M18-langgraph-state-graph.md](requirements/M18-langgraph-state-graph.md) | [learning/M18-langgraph-state-graph.md](learning/M18-langgraph-state-graph.md) | ✅ |
| M19 | LangGraph HITL + Checkpoint | [requirements/M19-langgraph-hitl.md](requirements/M19-langgraph-hitl.md) | [learning/M19-langgraph-hitl.md](learning/M19-langgraph-hitl.md) | ✅ |
| M20 | 对比学习文档 | — | [learning/M20-self-built-vs-langchain.md](learning/M20-self-built-vs-langchain.md) | ✅ |

### 工程化

| 里程碑 | 标题 | 需求 | 学习 | 状态 |
|--------|------|------|------|------|
| M21 | 性能优化 | [requirements/M21-performance-optimization.md](requirements/M21-performance-optimization.md) | [learning/M21-performance-optimization.md](learning/M21-performance-optimization.md) | ✅ |
| M22 | 工程化 + Harness | [requirements/M22-engineering-harness.md](requirements/M22-engineering-harness.md) | [learning/M22-engineering-harness.md](learning/M22-engineering-harness.md) | ✅ |
| M22S | Harness 最佳实践补齐 | [requirements/M22-supplement-harness-best-practices.md](requirements/M22-supplement-harness-best-practices.md) | — | ✅ |
| M23 | GitHub MCP + Git 初始化 | [requirements/M23-github-mcp-git-init.md](requirements/M23-github-mcp-git-init.md) | — | ✅ |
| M24 | 生产加固 | [requirements/M24-production-hardening.md](requirements/M24-production-hardening.md) | [learning/M24-production-hardening.md](learning/M24-production-hardening.md) | ✅ |

> 状态图例：⏳ 待开始 / 🚧 进行中 / ✅ 已完成 / ⚠️ 阻塞
>
> 详细进度：[progress.md](progress.md) | 待办池：[backlog.md](backlog.md) | 审计报告：[production-audit.md](production-audit.md)
