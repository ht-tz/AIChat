# NEXUS AI Agent — 项目交接文档

> 最后更新：2026-07-05 | 最新 Commit：fea73ff | 阶段：四阶段审计 83% 完成

---

## 一、项目概述

**NEXUS AI Agent** 是一个全栈 AI 智能体平台，支持单智能体/多智能体协作、LangChain 工具链、RAG 检索增强、Prompt 模板管理、记忆/经验学习系统。

- **仓库**：https://github.com/ht-tz/AIChat
- **线上地址**：https://ai-chat-ghtz.vercel.app
- **本地启动**：`pnpm dev` → http://localhost:8000
- **技术栈**：Next.js 15 + TypeScript + Tailwind CSS 4 + shadcn/ui + Drizzle ORM + Neon PostgreSQL + pino + Vercel

---

## 二、已完成里程碑（24/26）

| 阶段 | 里程碑 | 状态 |
|------|--------|------|
| 核心功能 | M1-M10（聊天/Agent/RAG/Multi-Agent/Tool/WebSearch/Prompt/Memory/Settings） | ✅ 全部完成 |
| 运维可观测 | M11 监控 + M12 CI/CD + M13 错误追踪 + M14 多用户隔离 + M15 工程化增强 | ✅ 全部完成 |
| Agent 增强 | M16 文件/图片 + M17 工作区优化 + M18 多模型 + M19 知识库 + M20 工具链 | ✅ 全部完成 |
| 审计质量 | M21 安全加固 + M22 工程化管理 + M23 多智能体增强 | ✅ 全部完成 |
| 审计质量 | M24 生产级加固（四阶段审计） | ✅ 83% 完成 |

**M24 剩余项**（未完成）：
- Sentry APM 集成（需 Sentry 账号）
- isolated-vm 代码沙箱（依赖 native 模块，Vercel 不支持）
- 测试覆盖率 30%+（需写更多测试）
- 多智能体运行状态控制完善

---

## 三、架构关键点

### 3.1 目录结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # 后端 API（约 48 个端点）
│   │   ├── auth/           # 注册/登录/OAuth/me
│   │   ├── chat/           # 流式对话（核心）
│   │   ├── agents/         # Agent CRUD + 运行
│   │   ├── multi-agent/    # 多智能体系统
│   │   ├── rag/            # 知识库/文件/检索
│   │   ├── prompts/        # Prompt 模板
│   │   ├── memory/         # 记忆系统
│   │   └── monitoring/     # 健康检查/指标
│   ├── (main)/             # 主布局（侧边栏+聊天）
│   ├── auth/               # 登录/注册页面
│   └── globals.css         # Tailwind + 主题变量
├── server/                 # 后端逻辑
│   ├── auth/               # JWT + OAuth + RBAC
│   ├── db/                 # Drizzle ORM + Schema（22 张表）
│   ├── redis/              # Redis 适配层（可降级为内存）
│   ├── logger.ts           # pino 结构化日志
│   ├── crypto.ts           # AES-256-GCM 加密
│   └── monitoring/         # 性能监控 + 错误聚合
├── components/             # UI 组件（shadcn/ui）
├── hooks/                  # React Hooks
├── lib/                    # 工具函数
└── store/                  # Zustand 状态管理
```

### 3.2 数据库（22 张表）

```
users, sessions, oauth_accounts, email_verification_tokens,
agents, agent_runs, agent_steps, tools, api_keys,
messages, tool_calls, files, file_chunks, images,
prompt_templates, prompt_versions, memories, memory_chunks,
ma_teams, ma_runs, ma_steps, experiences
```

ORM：`drizzle-orm/postgres-js`，Schema 定义在 [src/server/db/schema.ts](file:///Users/tizen/Desktop/AiLearning/AIChat/src/server/db/schema.ts)

### 3.3 认证系统

- JWT（access_token，15min）+ HttpOnly Cookie
- OAuth：GitHub、Google
- RBAC：user / admin
- API Key：AES-256-GCM 加密存储
- 所有 API 按用户隔离

### 3.4 AI 模型

- 当前配置：MiMo V2.5 Coding Plan（小米 MiMo）
- API 地址：`https://token-plan-cn.xiaomimimo.com/v1`
- 兼容 OpenAI Chat Completions 格式
- 支持多模型切换（OpenAI/Claude/Gemini/Ollama/自定义）

### 3.5 工程化

| 工具 | 用途 |
|------|------|
| pino | 结构化日志（JSON 格式，支持 prettyPrint） |
| bcryptjs | 密码哈希（纯 JS，兼容 Vercel） |
| crypto | AES-256-GCM 密钥加密 |
| rate-limiter-flexible | API 限流 |
| cookie-based auth | 无状态认证 |

---

## 四、已解决的关键问题

| 问题 | 解决方案 |
|------|----------|
| bcrypt 原生模块 Vercel Node24 不兼容 | → bcryptjs（纯 JS） |
| Neon `channel_binding` postgres.js 不兼容 | → URL 自动清理 |
| 部署端口 3000 不一致 | → 全局统一 8000 |
| console.log 无结构化 | → pino logger |
| 错误暴露内部堆栈 | → 统一错误边界 + 安全消息 |
| 健康检查暴露环境变量 | → 已移除 env 诊断 |
| `process.env` 直接使用 | → `@/lib/env` 统一校验 |

---

## 五、部署架构

```
用户浏览器
    ↓
Vercel Edge Network (CDN)
    ↓
Next.js Serverless Functions (Node 24)
    ↓
┌───────────────────────────────┐
│  Neon PostgreSQL (Serverless) │
│  MiMo V2.5 API                │
└───────────────────────────────┘
```

**环境变量（Vercel 已配置）**：

```
DATABASE_URL     = postgresql://neondb_owner:npg_...@ep-rough-breeze-at37ne0k-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require
JWT_SECRET       = nexus-ai-chat-jwt-secret-2026-prod
ENCRYPTION_KEY   = nexus-ai-encryption-key-32chars!
OPENAI_API_KEY   = <YOUR_MIMO_API_KEY>
OPENAI_BASE_URL  = https://token-plan-cn.xiaomimimo.com/v1
DEFAULT_MODEL    = mimo-v2.5
LLM_PROVIDER     = openai
```

**Vercel API Token**：`<YOUR_VERCEL_TOKEN>`

---

## 六、未完成事项（优先级排序）

| 优先级 | 项目 | 说明 |
|--------|------|------|
| P0 | 测试覆盖率 | 当前约 10%，目标 30%+，需补充 API 端点测试 |
| P1 | Sentry APM | 错误追踪 + 性能监控，需 Sentry 账号 |
| P1 | 多智能体运行控制 | 暂停/恢复/取消机制完善 |
| P2 | isolated-vm 沙箱 | 代码执行沙箱，Vercel 不支持 native 模块，需考虑替代方案 |
| P2 | WebSocket 支持 | 实时通信替代 SSE |
| P3 | 文档完善 | API 文档（OpenAPI/Swagger）|

---

## 七、开发规范

1. **语言**：所有文档、注释、提交信息使用**中文**
2. **Git**：每个里程碑单独提交，格式：`feat/fix/docs(里程碑): 描述`
3. **分支**：始终使用 main 分支
4. **发布前检查**：`pnpm lint && pnpm test && pnpm typecheck && pnpm build`
5. **更新顺序**：代码 → 需求文档 → 学习文档 → 进度文档 → 路线图 → backlog
6. **需求文档**：放在 `docs/requirements/`，编号+标题，包含三段式（目标/实现/自测）
7. **学习文档**：放在 `docs/learning/`，同上格式

---

## 八、文档索引

| 文档 | 路径 | 内容 |
|------|------|------|
| README | [README.md](file:///Users/tizen/Desktop/AiLearning/AIChat/README.md) | 项目全貌 |
| CLAUDE.md | [CLAUDE.md](file:///Users/tizen/Desktop/AiLearning/AIChat/CLAUDE.md) | AI 助手指令（必须遵循） |
| 生产审计 | [production-audit.md](file:///Users/tizen/Desktop/AiLearning/AIChat/docs/production-audit.md) | 37 项审计清单 |
| 路线图 | [roadmap.md](file:///Users/tizen/Desktop/AiLearning/AIChat/docs/roadmap.md) | 4 阶段总规划 |
| 进度 | [progress.md](file:///Users/tizen/Desktop/AiLearning/AIChat/docs/progress.md) | 24 个里程碑记录 |
| Backlog | [backlog.md](file:///Users/tizen/Desktop/AiLearning/AIChat/docs/backlog.md) | 37 项待办 |
| 需求文档 | [docs/requirements/](file:///Users/tizen/Desktop/AiLearning/AIChat/docs/requirements/) | 每个里程碑的需求说明 |
| 学习文档 | [docs/learning/](file:///Users/tizen/Desktop/AiLearning/AIChat/docs/learning/) | 每个里程碑的学习总结 |
