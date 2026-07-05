# 项目文档中心

本目录是 **NEXUS · AI Agent** 项目的"开发日志 + 学习笔记"中枢，配合 `.trae/documents/` 下的 PRD 与技术架构使用。

## 目录结构

```
docs/
├── README.md             ← 本文件：文档总览与工作流
├── progress.md           ← 实时开发进度（按时间倒序）
├── issues.md             ← 开发过程中遇到的问题与解决方案
├── requirements/         ← 需求文档（先于代码产出）
│   └── MN-xxx.md         ← 每个里程碑/功能的需求
├── learning/             ← 学习文档（每个功能完成后产出）
│   ├── 00-architecture.md ← 项目架构总览（先写）
│   └── MN-xxx.md         ← 每个功能的学习笔记
└── handoff/              ← 交接文档
    ├── README.md         ← 交接说明
    ├── env.md            ← 环境与启动说明
    └── api.md            ← API 接口文档
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

| 里程碑 | 标题 | 需求 | 学习 | 状态 |
|--------|------|------|------|------|
| 00 | 项目架构总览 | — | [learning/00-architecture.md](learning/00-architecture.md) | ✅ |
| M1 | 基础对话 | [requirements/M1-basic-chat.md](requirements/M1-basic-chat.md) | 待写 | 🚧 |
| M2 | 工具调用 | 待写 | 待写 | ⏳ |
| M3 | ReAct 推理 | 待写 | 待写 | ⏳ |
| M4 | 多模态 + 存储 | 待写 | 待写 | ⏳ |
| M5 | 报告与发布 | 待写 | 待写 | ⏳ |
| M6 | 提示词工程 | 待写 | 待写 | ⏳ |
| M7 | Plan + Reflexion + HITL | 待写 | 待写 | ⏳ |
| M8 | 多智能体协作 | 待写 | 待写 | ⏳ |
| M9 | 评估与可观测 | 待写 | 待写 | ⏳ |
| M10 | 进阶 RAG + Agent 形态 | 待写 | 待写 | ⏳ |

> 状态图例：⏳ 待开始 / 🚧 进行中 / ✅ 已完成 / ⚠️ 阻塞
