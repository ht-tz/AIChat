# M22 补充：Claude Code Harness 最佳实践补齐

> 需求文档，M22 主文档的补充。

## 基本信息

- **里程碑**：M22 补充
- **标题**：Claude Code Harness 最佳实践补齐
- **负责人**：
- **创建日期**：2026-07-05
- **状态**：✅ 已完成

---

## 1. 背景与目标

M22 主需求完成了基础工程化工具链和 Claude Code Harness 架构搭建。对照 Anthropic 官方最佳实践（https://www.anthropic.com/engineering/claude-code-best-practices），仍有 6 项能力缺失。

**目标**：补齐 Claude Code Harness 至 13/13 最佳实践全覆盖。

---

## 2. 功能范围

### 2.1 包含（In Scope）

| # | 功能 | 描述 |
|---|------|------|
| 1 | Claude Code Hooks | `.claude/settings.json` 新增 hooks 配置：postToolUse（每次 Edit/Write 后自动 typecheck）、stop（轮次结束前强制 typecheck + test 门禁，连续 8 次失败自动停止） |
| 2 | CLAUDE.local.md | 个人开发配置文件，存放数据库连接、API Key、个人偏好等，加入 .gitignore 不提交 |
| 3 | ~/.claude/CLAUDE.md | 全局 Claude Code 配置，适用于所有项目（pnpm 规则、中文提交、编辑器偏好） |
| 4 | Skills 模块 (3个) | `.claude/skills/database.md`（数据库操作规范）、`.claude/skills/deployment.md`（部署规范）、`.claude/skills/debugging.md`（调试流程） |
| 5 | gh CLI 安装 | GitHub CLI v2.96.0 安装到 /usr/local/bin/gh，加入 settings.json allow 白名单 |
| 6 | @path 引用优化 | CLAUDE.md 新增项目参考（README/package.json/schema/.env.example/docs）和 Skills 引用 |

### 2.2 不包含（Out of Scope）

- GitHub MCP 服务器配置 — 归入 M23
- Git 仓库初始化与推送 — 归入 M23

---

## 3. 验收标准

- [x] `.claude/settings.json` 包含 hooks 配置（postToolUse + stop）
- [x] `CLAUDE.local.md` 存在且包含环境信息和个人偏好
- [x] `~/.claude/CLAUDE.md` 存在且包含全局配置
- [x] `.claude/skills/` 包含 3 个 .md 文件
- [x] `gh --version` 输出 v2.96.0+
- [x] `CLAUDE.md` 包含 @path 引用和 Skills 引用
- [x] `.gitignore` 包含 CLAUDE.local.md
- [x] `pnpm typecheck` 0 error
- [x] `pnpm test` 34/34 passed

---

## 4. 技术约束

- Skills 文件格式必须包含 YAML frontmatter（name + description）
- Hooks 的 timeout 不超过 60000ms
- CLAUDE.local.md 不得包含在 git 提交中

---

## 5. 关联文档

- M22 主需求：`docs/requirements/M22-engineering-harness.md`
- 学习文档：`docs/learning/M22-engineering-harness.md`
- Anthropic 最佳实践：https://www.anthropic.com/engineering/claude-code-best-practices
