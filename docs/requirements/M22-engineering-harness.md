# M22: 工程化能力补全 + Claude Code Harness

> 需求文档，动手写代码前先填齐。

## 基本信息

- **里程碑**：M22
- **标题**：工程化能力补全 + Claude Code Harness 架构搭建
- **负责人**：
- **创建日期**：2026-07-05
- **状态**：✅ 已完成

---

## 1. 背景与目标

项目 M1-M20 已完成全部业务功能开发，但工程化基础设施缺失：无 ESLint/Prettier 配置、无 Git Hooks、无 CI/CD、无测试框架、无 Bundle 分析。同时，Claude Code 的 Harness 架构（CLAUDE.md + .claude/ 配置）尚未搭建，导致 AI 编码助手无法感知项目规范。

**目标**：
1. 补全工程化工具链（lint/format/test/hooks/CI/bundle 分析）
2. 搭建 Claude Code Harness 架构，让 AI 成为"项目专属同事"
3. 所有配置通过验证，不影响现有功能

---

## 2. 用户故事

- 作为开发者，我希望提交代码前自动检查格式和类型错误，以便减少低级 bug
- 作为开发者，我希望 CI 流水线自动运行 lint + typecheck + test + build，以便保障代码质量
- 作为开发者，我希望 Claude Code 知道项目规范（pnpm/cyber 主题/类型安全），以便减少重复沟通
- 作为开发者，我希望一键分析 bundle 体积，以便发现优化机会
- 作为开发者，我希望有 /review /test /deploy 等快捷命令，以便标准化重复流程

---

## 3. 功能范围

### 3.1 包含（In Scope）

**工程化工具链**：
- ESLint 配置（.eslintrc.json）
- Prettier 配置（.prettierrc + .prettierignore）
- EditorConfig 配置（.editorconfig）
- Husky + lint-staged（pre-commit hooks）
- Vitest 测试框架（vitest.config.ts + 测试用例）
- GitHub Actions CI 流水线（.github/workflows/ci.yml）
- Next.js Bundle Analyzer（next.config.mjs + webpack chunk 拆分）
- Knip 未使用代码检测（knip.json）
- package.json scripts 补全（format/analyze/lint:unused 等）

**Claude Code Harness**：
- CLAUDE.md 入职手册（项目概述/技术栈/代码规范/目录结构/禁止事项）
- .claude/settings.json 安全红线（权限控制）
- .claude/commands/ 快捷命令（review/test/feature/deploy）
- .claude/agents/ 子智能体（code-reviewer/test-writer）

**MiMo 模型接入**：
- 添加 MiMo V2.5 Coding Plan 模型
- 更新 Coding Plan 专属 URL（token-plan-cn.xiaomimimo.com/v1）

### 3.2 不包含（Out of Scope）

- Docker 健康检查端点（/api/health）— 后续 M23
- docker-compose.yml — 后续 M23
- 容器安全扫描（Trivy）— 后续 M23
- Harness Secret Manager 集成 — 后续 M23
- Mermaid 渲染优化已在 M21 处理

---

## 4. 验收标准

- [x] `pnpm lint` 无 ESLint 错误
- [x] `pnpm typecheck` 无 TypeScript 错误
- [x] `pnpm test` 全部测试通过（34/34）
- [x] `pnpm format:check` 无格式问题
- [x] pre-commit hook 自动运行 lint-staged
- [x] `pnpm analyze` 生成 bundle 分析报告
- [x] CLAUDE.md 包含完整的项目规范
- [x] .claude/ 目录包含 4 个命令 + 2 个子智能体
- [x] MiMo V2.5 Coding Plan API 调用成功
- [x] 数据库中 model_configs 表 baseUrl 已更新

---

## 5. 交互 / UI 说明

无 UI 变更。本里程碑纯工程化，不影响用户界面。

---

## 6. 技术约束

- 依赖的库：prettier、prettier-plugin-tailwindcss、husky、lint-staged、@next/bundle-analyzer、knip、vitest（已有）
- 影响的模块：根目录配置文件、next.config.mjs、package.json、CLAUDE.md、.claude/*
- 兼容要求：不影响现有 pnpm dev/build/start 流程

---

## 7. 风险与备选

| 风险 | 影响 | 备选 |
|------|------|------|
| Prettier 格式化大面积改动 git diff | 中 | 首次 format 单独提交，不混入业务代码 |
| Husky pre-commit 阻塞提交 | 低 | 临时 `--no-verify` 跳过 |
| Bundle Analyzer 增加构建时间 | 低 | 仅 `ANALYZE=true` 时启用 |
| Vitest 与 jsdom ESM 兼容问题 | 中 | 测试环境改为 node |

---

## 8. 拆分与排期

| # | 子任务 | 状态 |
|---|--------|------|
| 1 | ESLint + Prettier 配置 | ✅ |
| 2 | EditorConfig 配置 | ✅ |
| 3 | Husky + lint-staged | ✅ |
| 4 | Vitest 测试框架 + 测试用例 | ✅ |
| 5 | GitHub Actions CI 流水线 | ✅ |
| 6 | Bundle Analyzer + Webpack chunk 拆分 | ✅ |
| 7 | Knip 未使用代码检测 | ✅ |
| 8 | package.json scripts 补全 | ✅ |
| 9 | CLAUDE.md 入职手册 | ✅ |
| 10 | .claude/settings.json 安全红线 | ✅ |
| 11 | .claude/commands/ 快捷命令 (4个) | ✅ |
| 12 | .claude/agents/ 子智能体 (2个) | ✅ |
| 13 | MiMo V2.5 Coding Plan 接入 | ✅ |
| 14 | TypeScript 编译 + 测试验证 | ✅ |

---

## 9. 自测计划

```bash
# 1. 类型检查
pnpm typecheck  # 期望: 0 error

# 2. 测试
pnpm test  # 期望: 6 files, 34 tests passed

# 3. Lint
pnpm lint  # 期望: 0 error

# 4. 格式检查
pnpm format:check  # 期望: 通过

# 5. 构建
pnpm build  # 期望: Compiled successfully

# 6. Bundle 分析
pnpm analyze  # 期望: 生成 .next/analyze/*.html

# 7. Claude Code Harness
cat CLAUDE.md  # 期望: 完整的项目规范
ls .claude/commands/  # 期望: review.md test.md feature.md deploy.md
ls .claude/agents/  # 期望: code-reviewer.md test-writer.md

# 8. MiMo API
curl https://token-plan-cn.xiaomimimo.com/v1/chat/completions \
  -H "Authorization: Bearer tp-cxtit..." \
  -d '{"model":"mimo-v2.5","messages":[{"role":"user","content":"hi"}]}' \
  # 期望: 200 OK, choices[0].message.content 非空
```

---

## 10. 关联文档

- 学习文档：`docs/learning/M22-engineering-harness.md`
- Claude Code Harness：`CLAUDE.md`
- Anthropic 最佳实践：https://www.anthropic.com/engineering/claude-code-best-practices
