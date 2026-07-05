# M5: 报告与发布

> 需求文档，动手写代码前先填齐。

## 基本信息

- **里程碑**：M5
- **标题**：报告与发布
- **负责人**：
- **创建日期**：2026-07-03
- **状态**：✅ 已完成

---

## 1. 背景与目标

M4 实现了多模态交互，但对话结果无法沉淀为结构化报告，也没有生产部署配置。本里程碑补齐报告生成、主题切换和容器化部署。

## 2. 用户故事

- 作为用户，我希望将对话历史汇总为 Markdown 报告并下载
- 作为用户，我希望切换深色/浅色主题
- 作为开发者，我希望项目能通过 Docker 容器化部署

## 3. 功能范围

### 3.1 包含（In Scope）

- summarize_report 工具（生成 Markdown 报告：摘要 + 附件 + 完整对话）
- 报告一键下载 .md 文件
- 主题切换（cyber-dark / cyber-light）
- Dockerfile（多阶段构建）
- nginx.conf（反向代理 + SSE 支持）
- fly.toml（Fly.io 部署配置）

### 3.2 不包含（Out of Scope）

- PDF 导出（M10）
- 在线协作编辑
- CI/CD 流水线（M22）

## 4. 验收标准

- [x] summarize_report 工具生成完整 Markdown 报告
- [x] 报告下载为 .md 文件
- [x] 主题切换即时生效
- [x] Dockerfile 构建成功

## 5. 拆分与排期

| # | 子任务 | 状态 |
|---|--------|------|
| 1 | summarize_report 工具 | ✅ |
| 2 | 报告下载 API | ✅ |
| 3 | 主题切换（dark/light） | ✅ |
| 4 | Dockerfile + nginx.conf + fly.toml | ✅ |

## 6. 关联文档

- 学习文档：`docs/learning/M5-report-publish.md`
