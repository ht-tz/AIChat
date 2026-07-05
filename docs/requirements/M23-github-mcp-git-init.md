# M23: GitHub MCP 集成 + Git 仓库初始化

> 需求文档，动手写代码前先填齐。

## 基本信息

- **里程碑**：M23
- **标题**：GitHub MCP 集成 + Git 仓库初始化与推送
- **负责人**：
- **创建日期**：2026-07-05
- **状态**：✅ 已完成

---

## 1. 背景与目标

项目已完成 M1-M22 全部里程碑开发，但代码未纳入版本控制，GitHub MCP 未配置，无法进行 Issue 管理、PR 工作流和远程协作。

**目标**：
1. 配置 GitHub MCP 服务器，让 Claude Code 可直接操作 GitHub
2. 初始化 Git 仓库并推送到 GitHub
3. 确保敏感信息不泄露

---

## 2. 用户故事

- 作为开发者，我希望 Claude Code 能直接搜索 GitHub 仓库和 Issue，以便快速获取参考信息
- 作为开发者，我希望 Claude Code 能创建 Issue 和 PR，以便在终端内完成完整工作流
- 作为开发者，我希望代码安全推送到 GitHub，以便备份和协作
- 作为开发者，我希望敏感文件（.env.local、API Key）不被提交，以便保障安全

---

## 3. 功能范围

### 3.1 包含（In Scope）

**GitHub MCP 集成**：
- GitHub MCP 服务器注册到 `~/.claude/settings.json`
- OAuth 认证流程（浏览器授权）
- 可用工具：search_repositories、search_code、list_issues、get_issue、create_issue、add_issue_comment、fork_repository、list_commits、search_users、get_file_contents、list_tags、list_branches
- gh CLI 安装（v2.96.0）+ auth login

**Git 仓库初始化**：
- `.gitignore` 安全检查（确认 .env.local、CLAUDE.local.md、.harness/ 已排除）
- 初始提交（268 文件 / 55,427 行代码）
- GitHub 仓库创建（ht-tz/AIChat，公开仓库）
- 推送到 origin/main

### 3.2 不包含（Out of Scope）

- GitHub Actions CI/CD 流水线 — 已在 M22 完成
- 分支保护规则 — 后续按需配置
- Issue/PR 模板 — 后续按需创建

---

## 4. 验收标准

- [x] `~/.claude/settings.json` 包含 mcpServers.github 配置
- [x] `gh auth status` 显示 Logged in to github.com account ht-tz
- [x] GitHub MCP 工具可正常调用（search_repositories 等）
- [x] `.env.local` 不在 git 跟踪列表中
- [x] `CLAUDE.local.md` 不在 git 跟踪列表中
- [x] `.harness/` 不在 git 跟踪列表中
- [x] `git remote -v` 显示 https://github.com/ht-tz/AIChat.git
- [x] `git log --oneline -1` 显示初始提交
- [x] GitHub 仓库页面可访问：https://github.com/ht-tz/AIChat

---

## 5. 安全要求

| 保护项 | 措施 |
|--------|------|
| .env.local | .gitignore 排除 |
| CLAUDE.local.md | .gitignore 排除 |
| .harness/ | .gitignore 排除（误创建目录） |
| GitHub Token | gh auth 管理，不硬编码 |
| 加密密钥 | ENCRYPTION_KEY 仅在 .env.local 中 |

---

## 6. 关联文档

- M22 需求：`docs/requirements/M22-engineering-harness.md`
- M22 补充：`docs/requirements/M22-supplement-harness-best-practices.md`
- GitHub 仓库：https://github.com/ht-tz/AIChat
