# NEXUS AI Agent — Claude Code Harness

## 项目概述
NEXUS 是一个面向开发者的 AI Agent 学习项目，基于 Next.js 14 App Router + TypeScript + Tailwind CSS 构建。
支持多模型对话（OpenAI/DeepSeek/通义千问/豆包/智谱/Kimi/文心/小米 MiMo/MiniMax）、工具调用、ReAct 推理、多智能体协作。

## 技术栈
- **框架**: Next.js 14.2.18 (App Router, standalone output)
- **语言**: TypeScript 5.6 (strict mode)
- **样式**: Tailwind CSS 3.4 + 赛博朋克主题 (cyber-*)
- **状态管理**: Zustand 4.5 (client) + Drizzle ORM 0.36 (server)
- **数据库**: PostgreSQL 17 (本地 tizen:root@localhost:5432/postgres)
- **测试**: Vitest + Testing Library
- **包管理**: pnpm (禁止使用 npm/yarn)

## 构建命令
- `pnpm dev` — 开发服务器 (localhost:8000)
- `pnpm build` — 生产构建
- `pnpm typecheck` — TypeScript 类型检查 (改完代码必须跑)
- `pnpm test` — 运行测试

### Logging

```bash
# 结构化日志（pino），自动脱敏敏感字段
pnpm dev     # DEBUG 级别，控制台输出
# 生产环境 INFO 级别，JSON 格式
# 修改 LOG_LEVEL 环境变量可调整日志级别
```

### Redis（可选）

```bash
# 配置 REDIS_URL 启用 Redis（限流/OAuth 缓存）
# 未配置时自动降级为内存模式
REDIS_URL=redis://localhost:6379
```
- `pnpm lint` — ESLint 检查
- `pnpm format` — Prettier 格式化
- `pnpm db:push` — 数据库迁移
- `pnpm analyze` — Bundle 分析

## 代码规范
- 使用 ES Modules (import/export)，禁止 CommonJS (require)
- 解构导入: `import { foo } from 'bar'`
- 组件用 PascalCase，工具函数用 camelCase，常量用 UPPER_SNAKE_CASE
- 文件名用 kebab-case (如 message-bubble.tsx)
- 客户端组件必须加 `"use client"` 指令
- 服务端组件默认不加，仅在需要浏览器 API 时标记
- Tailwind 类名用 `cn()` 工具 (来自 @/lib/utils) 合并条件类名
- 主题色使用 cyber-* 前缀 (cyber-cyan, cyber-purple, cyber-bg, cyber-surface, cyber-border, cyber-text, cyber-muted, cyber-lime)
- API 路由统一返回 `{ data?, error? }` 格式
- 错误处理: 服务端 try/catch + console.warn，客户端 toast 提示

## 目录结构
```
src/
  app/              — Next.js App Router 路由
    api/            — API 路由 (REST)
    settings/       — 设置页
  components/
    chat/           — 聊天组件 (message-bubble, message-list, chat-input, thought-panel)
    docs/           — 文档渲染 (markdown-viewer)
    layout/         — 布局组件 (sidebar, top-bar)
    ui/             — 基础 UI 组件 (button, card, mermaid-diagram)
  features/
    chat/           — 聊天功能 (chat-container, use-chat-stream)
  hooks/            — 自定义 Hooks
  lib/              — 工具函数和类型定义
  server/
    agent/          — Agent 调度 (dispatcher.ts)
    auth/           — 认证系统 (JWT + bcrypt)
    db/             — 数据库 (Drizzle schema + 连接)
    memory/         — 记忆系统 (短期/长期/情景记忆)
    providers/      — LLM Provider (OpenAI 兼容协议)
    tools/          — 工具注册表
  stores/           — Zustand 状态管理
```

## 关键架构决策
- Provider 层: 所有 LLM 厂商通过 OpenAI 兼容协议统一接入 (src/server/providers/openai.ts)
- 记忆系统: 向量嵌入 + 余弦相似度检索，自动注入对话上下文
- 流式响应: SSE (Server-Sent Events) 实现打字机效果
- 工具调用: dispatcher.ts 解析 function_call → 并行执行 → 汇总结果
- 推理过程: 支持 reasoning_content (DeepSeek-R1, MiMo 等模型)

## 测试规范
- 测试文件放在 `src/__tests__/` 或与源文件同目录
- 命名: `*.test.ts` 或 `*.test.tsx`
- 使用 Vitest 的 describe/it/expect
- 纯函数必须有单元测试
- 修改 crypto/vector-utils/settings 后必须跑对应测试

## 数据库
- Schema: src/server/db/schema.ts (Drizzle ORM)
- 迁移文件: drizzle/*.sql
- 连接: postgres-js driver, DATABASE_URL 环境变量
- 降级: DATABASE_URL 未设置时使用内存存储 (开发模式)

## 环境变量
- `DATABASE_URL` — PostgreSQL 连接串
- `ENCRYPTION_KEY` — API Key 加密密钥 (AES-256-GCM)
- `JWT_SECRET` — JWT 签名密钥
- 其他见 .env.example

## Git 规范
- 分支: main (生产), feat/* (功能), fix/* (修复)
- 提交信息: 简洁中文描述，如 "修复 Mermaid 渲染失败"
- pre-commit hook 自动运行 lint-staged (eslint + prettier)

## 禁止事项
- 禁止使用 npm install / yarn install，只用 pnpm
- 禁止直接修改 .env.local 文件内容
- `CLAUDE.local.md` — 个人开发配置，不提交
- 禁止删除数据库表或执行 DROP 语句
- 禁止在客户端组件中导入服务端模块 (src/server/*)
- 禁止使用 any 类型，除非有充分理由并加注释
- 禁止添加未使用的 import
- 禁止在生产代码中使用 console.log (用 console.warn 或 console.error)

## 项目参考
- 项目概述: @README.md
- 依赖和脚本: @package.json
- 数据库 Schema: @src/server/db/schema.ts
- 环境变量: @.env.example
- 需求文档: @docs/requirements/
- 学习文档: @docs/learning/
- 待办池: @docs/backlog.md
- 结构化日志: @src/server/logger.ts
- Redis 适配层: @src/server/redis/adapter.ts
- 性能监控: @src/server/monitoring/performance.ts
- 环境校验: @src/lib/env-validation.ts
- 全局限流: @src/server/middleware/rate-limiter.ts

## .claude/ 引用
- 自定义命令: @.claude/commands/review.md @.claude/commands/test.md
- 子智能体: @.claude/agents/code-reviewer.md @.claude/agents/test-writer.md
- Skills: @.claude/skills/database.md @.claude/skills/deployment.md @.claude/skills/debugging.md

## MCP 服务器
- GitHub: 全局配置 (mcp-github) — 搜索仓库/代码/Issue，读写 Issue/PR
- 位置: ~/.claude/settings.json
