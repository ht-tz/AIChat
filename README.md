# NEXUS · AI Agent

> 全栈 AI Agent 学习平台 — 从零到一构建生产级 AI Agent 系统

基于 Next.js 14 + PostgreSQL + LangChain/LangGraph 的全栈 AI Agent 平台，覆盖对话、工具调用、多步推理、多智能体协作、知识库 RAG、记忆系统、提示词工程等完整能力。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | Next.js 14 (App Router) · React 18 · TypeScript 5.6 · Tailwind CSS 3.4 |
| **状态管理** | Zustand (持久化) · @tanstack/react-query |
| **UI 组件** | Radix UI · Lucide Icons · Framer Motion · Mermaid · highlight.js |
| **后端** | Next.js API Routes · SSE 流式传输 |
| **数据库** | PostgreSQL · Drizzle ORM · pgvector |
| **AI 框架** | LangChain 1.x · LangGraph 1.x · OpenAI SDK |
| **认证** | JWT · bcrypt · OAuth (GitHub/Google) · CSRF 双提交 Cookie |
| **工程化** | Vitest · ESLint · Prettier · Husky · GitHub Actions CI · pino 日志 |
| **部署** | Docker · Fly.io · Redis (可选) |

---

## 核心功能

### AI Agent 能力

- **基础对话** — SSE 流式传输，Markdown 渲染，代码高亮，Mermaid 图表
- **工具调用** — 9 个内置工具（计算器/时间/搜索/代码执行/文件/PDF/图片生成/报告/字数统计）
- **ReAct 多步推理** — Thought → Plan → Tool → Reflection 循环，最多 5 轮
- **可观测推理** — 思考面板、执行计划、工具卡片、反思评分，实时 SSE 推送
- **记忆系统** — 短期/长期/情景记忆，向量相似度检索，自动注入上下文
- **提示词工程** — 模板管理、版本控制、A/B 测试、Playground
- **高级推理** — 任务分解、依赖图、结构化反思、工具选择策略
- **知识库 RAG** — 文档上传、自动切分、向量化、语义搜索、RAG 问答

### 多智能体协作

- **8 个预置 Agent** — 规划/研究/分析/创意/编码/测试/写作/评审
- **3 种工作流模板** — 研究分析流/创意写作流/代码开发流
- **工作流引擎** — Stage 串行+并行、SSE 实时事件、运行追踪
- **双引擎切换** — 自研引擎 / LangGraph 引擎一键切换
- **HITL 人工介入** — Checkpoint + interrupt_before + 断点续跑 + 时间旅行

### LangChain/LangGraph 集成

- **Provider 适配** — 自研 LLMProvider 接口，内部委托 ChatOpenAI
- **工具适配层** — 自研工具 → LangChain DynamicTool 自动转换
- **RAG 管线** — RecursiveCharacterTextSplitter + InMemoryVectorStore + LCEL Chain
- **状态图** — Annotation.Root 状态 schema + StateGraph 编排
- **PromptTemplate** — StructuredOutputParser + ChatPromptTemplate + LCEL Chain

### 安全与认证

- **JWT 认证** — 注册/登录/Cookie 会话
- **OAuth** — GitHub / Google 第三方登录
- **邮箱验证** — Mock + SMTP 双模式
- **API Key 管理** — 创建/激活/停用/删除
- **RBAC** — user / admin 角色
- **CSRF 保护** — 双提交 Cookie 模式
- **全局限流** — Redis 适配层 + 滑动窗口算法
- **输入校验** — XSS/SQL 注入/SVG/iframe 过滤

### 生产级工程化

- **结构化日志** — pino，敏感字段自动脱敏（authorization/cookie/password/token）
- **健康检查** — `/api/health` 端点，含 DB 连接检查
- **性能监控** — 请求记录 + p95/p99 统计 + DB 持久化（缓冲 50 条自动刷写）
- **Redis 适配层** — CacheAdapter 接口，有 REDIS_URL 用 Redis，否则降级内存
- **环境变量校验** — 启动时强制校验关键变量，生产环境缺失即抛异常
- **全局错误边界** — error.tsx + not-found.tsx + loading.tsx
- **Claude Code Harness** — CLAUDE.md 入职手册 + Hooks 门禁 + Skills + Commands

---

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8
- PostgreSQL >= 14（可选，支持内存降级）

### 安装

```bash
git clone https://github.com/ht-tz/AIChat.git
cd AIChat
pnpm install
```

### 环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```bash
# 必填
DATABASE_URL=postgres://postgres:postgres@localhost:5432/ai_agent

# 模型配置
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-xxx
DEFAULT_MODEL=gpt-4o-mini

# 可选
REDIS_URL=                    # 配置后启用 Redis（限流/缓存）
LOG_LEVEL=info                # debug/info/warn/error
JWT_SECRET=your-secret        # 生产环境必须配置
ENCRYPTION_KEY=32-char-key    # 生产环境必须配置
```

### 数据库

```bash
pnpm db:push    # 推送 schema 到数据库
pnpm db:studio  # 打开 Drizzle Studio（数据库管理 UI）
```

### 启动

```bash
pnpm dev    # http://localhost:8000
```

> 不配置数据库也能运行 — 自动降级为内存模式（Mock Provider + 内存存储）

---

## 脚本命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 开发服务器（localhost:8000） |
| `pnpm build` | 生产构建 |
| `pnpm start` | 生产启动 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm test` | 运行测试（Vitest） |
| `pnpm test:watch` | 测试监听模式 |
| `pnpm lint` | ESLint 检查 |
| `pnpm lint:fix` | ESLint 自动修复 |
| `pnpm format` | Prettier 格式化 |
| `pnpm format:check` | Prettier 格式检查 |
| `pnpm lint:unused` | Knip 未使用代码检测 |
| `pnpm analyze` | Bundle 体积分析 |
| `pnpm db:push` | 推送数据库 schema |
| `pnpm db:generate` | 生成迁移文件 |
| `pnpm db:studio` | Drizzle Studio |

---

## 项目结构

```
AIChat/
├── .claude/                    # Claude Code Harness
│   ├── settings.json           # 权限控制 + Hooks 门禁
│   ├── commands/               # review / test / feature / deploy
│   ├── agents/                 # code-reviewer / test-writer
│   └── skills/                 # database / deployment / debugging
├── .github/workflows/ci.yml   # GitHub Actions CI
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API 路由（48 个端点）
│   │   │   ├── auth/           # 认证（注册/登录/OAuth/API Key）
│   │   │   ├── chat/           # AI 对话（SSE 流式）
│   │   │   ├── knowledge/      # 知识库（文档/搜索/RAG）
│   │   │   ├── langchain/      # LangChain 集成（chat/tools/rag/graph）
│   │   │   ├── memories/       # 记忆管理
│   │   │   ├── multi-agent/    # 多智能体协作
│   │   │   ├── reasoning/      # 高级推理
│   │   │   ├── evaluation/     # 评估指标
│   │   │   └── health/         # 健康检查
│   │   ├── auth/               # 登录/注册页
│   │   ├── collaboration/      # 多智能体协作工作台
│   │   ├── knowledge/          # 知识库管理页
│   │   ├── langchain/          # LangChain 双引擎对比页
│   │   ├── memory/             # 记忆管理页
│   │   ├── playground/         # Prompt Playground
│   │   ├── prompts/            # 提示词模板管理
│   │   ├── reasoning/          # 推理实验室
│   │   ├── settings/           # 设置页
│   │   └── page.tsx            # 对话主页
│   ├── components/             # UI 组件
│   │   ├── agent/              # Agent 相关（plan-todo, reflection-card）
│   │   ├── chat/               # 对话组件（bubble, composer, tool-call-card）
│   │   ├── layout/             # 布局（sidebar, topbar）
│   │   ├── multi-agent/        # 多智能体可视化（workflow-graph, progress-panel）
│   │   └── ui/                 # 通用 UI（mermaid, markdown, code-block）
│   ├── features/               # 业务功能模块
│   │   ├── knowledge/          # 知识库管理
│   │   ├── memory/             # 记忆管理
│   │   ├── prompt/             # 提示词工程
│   │   └── reasoning/          # 推理实验室
│   ├── hooks/                  # 自定义 Hooks
│   ├── lib/                    # 工具函数
│   │   ├── env-validation.ts   # 环境变量启动校验
│   │   └── types.ts            # 全局类型定义
│   ├── stores/                 # Zustand 状态管理
│   └── server/                 # 后端核心
│       ├── agent/              # Agent 调度器（dispatcher + persistence）
│       ├── auth/               # 认证服务（JWT + OAuth + Email）
│       ├── db/                 # 数据库（Drizzle schema + 连接）
│       ├── knowledge/          # 知识库（文档/向量/RAG/多 Agent）
│       ├── langchain/          # LangChain/LangGraph 集成
│       ├── memory/             # 记忆系统（服务/注入/向量/经验）
│       ├── middleware/          # 中间件（限流/输入校验/CSRF）
│       ├── monitoring/         # 监控（性能/评估）
│       ├── multi-agent/        # 多智能体引擎
│       ├── prompts/            # 提示词工程
│       ├── providers/          # LLM Provider（OpenAI/Mock/Embedding）
│       ├── reasoning/          # 推理引擎（Plan/Reflection/ToolStrategy）
│       ├── redis/              # Redis 适配层
│       ├── tools/              # 工具系统（9 个内置工具）
│       ├── crypto.ts           # 加密服务
│       ├── logger.ts           # 结构化日志（pino）
│       └── model-config-service.ts
├── tests/                      # 测试文件
├── drizzle/                    # 数据库迁移
├── docs/                       # 项目文档
│   ├── requirements/           # 需求文档（24 份）
│   ├── learning/               # 学习文档
│   ├── progress.md             # 开发进度
│   ├── issues.md               # 问题追踪
│   ├── backlog.md              # 待办池
│   └── production-audit.md     # 生产级审计报告
├── CLAUDE.md                   # Claude Code 入职手册
├── Dockerfile                  # Docker 构建
├── fly.toml                    # Fly.io 部署配置
├── .dockerignore               # Docker 忽略
├── .eslintrc.json              # ESLint 配置
├── .prettierrc                 # Prettier 配置
├── vitest.config.ts            # Vitest 配置
├── knip.json                   # Knip 未使用代码检测
└── next.config.mjs             # Next.js 配置
```

---

## 里程碑总览

24 个里程碑，覆盖从基础对话到生产加固的完整链路：

| 阶段 | 里程碑 | 标题 | 状态 |
|------|--------|------|------|
| **基础** | M1 | 基础对话（SSE 流式 + Zustand） | ✅ |
| | M2 | 工具调用（9 个内置工具） | ✅ |
| | M3 | ReAct 多步推理 + DB 持久化 | ✅ |
| | M4 | 多模态 + 存储 | ✅ |
| | M5 | 报告与发布 | ✅ |
| **进阶** | M6 | 提示词工程中心（模板/A/B/Playground） | ✅ |
| | M7 | Agent 记忆与学习（短期/长期/情景） | ✅ |
| | M8 | 高级推理（Plan/Reflection/ToolStrategy） | ✅ |
| | M9 | 知识库增强（文档/向量/RAG/多 Agent） | ✅ |
| | M10 | 评估与上线（限流/监控/评估指标） | ✅ |
| | M11 | 记忆注入（自动检索 + 上下文注入） | ✅ |
| **安全** | M12 | 权限认证系统（JWT + RBAC） | ✅ |
| | M13 | OAuth + 邮箱验证 | ✅ |
| **多智能体** | M14 | 多智能体协作增强 | ✅ |
| | M15 | 过程可视化（工作流图/进度面板/时间线） | ✅ |
| **LangChain** | M16 | LangChain 基础集成 | ✅ |
| | M17 | LangChain Tools + RAG | ✅ |
| | M18 | LangGraph 状态图 + 多智能体编排 | ✅ |
| | M19 | LangGraph HITL + Checkpoint | ✅ |
| | M20 | 对比学习文档（5 篇系统性分析） | ✅ |
| **工程化** | M21 | 性能优化（Bundle 拆分 + 代码分割） | ✅ |
| | M22 | 工程化 + Claude Code Harness | ✅ |
| | M22S | Harness 最佳实践补齐（Hooks/Skills/MCP） | ✅ |
| | M23 | GitHub MCP + Git 仓库初始化 | ✅ |
| | M24 | 生产加固（安全审计 + 可靠性 + 持久化） | ✅ |

---

## API 端点

48 个 API 端点，覆盖完整 AI Agent 能力：

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/logout` | 用户登出 |
| GET | `/api/auth/me` | 当前用户信息 |
| GET/POST | `/api/auth/api-keys` | API Key 管理 |
| GET | `/api/auth/oauth/:provider` | OAuth 跳转 |
| GET | `/api/auth/oauth/:provider/callback` | OAuth 回调 |
| POST | `/api/auth/send-verification` | 发送验证邮件 |
| GET | `/api/auth/verify-email` | 验证邮箱 |

### AI Agent
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chat` | AI 对话（SSE 流式 + 工具调用） |
| POST | `/api/reasoning/decompose` | 任务分解 |
| POST | `/api/reasoning/reflect` | 结构化反思 |
| POST | `/api/evaluation` | 质量评分 / 检索评估 |

### 记忆与知识
| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST/PUT/DELETE | `/api/memories` | 记忆 CRUD |
| POST | `/api/memories/search` | 记忆相似度搜索 |
| GET/POST/PUT/DELETE | `/api/experiences` | 经验 CRUD |
| POST | `/api/experiences/search` | 经验搜索 |
| POST | `/api/memory/injection` | 记忆注入 |
| GET/POST/PUT/DELETE | `/api/knowledge/documents` | 文档管理 |
| POST | `/api/knowledge/search` | 语义搜索 |
| POST | `/api/knowledge/rag` | RAG 问答 |

### 多智能体
| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/multi-agent/teams` | 团队/模板 |
| POST | `/api/multi-agent/run` | 启动运行（SSE） |
| GET | `/api/multi-agent/runs` | 运行历史 |
| GET | `/api/multi-agent/runs/:id` | 运行详情 |

### LangChain
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/langchain/chat` | LangChain 对话 |
| POST | `/api/langchain/prompt` | PromptTemplate 生成 |
| POST | `/api/langchain/rag` | RAG 查询 |
| GET/POST | `/api/langchain/tools` | 工具对比 |
| POST | `/api/langchain/graph/start` | HITL 工作流启动 |
| POST | `/api/langchain/graph/resume` | 断点续跑 |
| GET | `/api/langchain/graph/states/:threadId` | 状态历史 |
| POST | `/api/langchain/graph/rollback` | 时间旅行回滚 |

### 提示词
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/playground` | Playground 执行 |
| POST | `/api/ab-test` | A/B 测试 |

### 系统
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查（含 DB 连接） |
| GET | `/api/performance/stats` | 性能统计 |
| GET/POST | `/api/model-configs` | 模型配置管理 |
| POST | `/api/upload` | 文件上传 |
| POST | `/api/export` | 数据导出 |

---

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 否 | PostgreSQL 连接串（未配置则内存降级） |
| `OPENAI_BASE_URL` | 否 | OpenAI API 地址 |
| `OPENAI_API_KEY` | 否 | OpenAI API Key |
| `DEFAULT_MODEL` | 否 | 默认模型（默认 gpt-4o-mini） |
| `LLM_PROVIDER` | 否 | LLM 提供商（mock/openai/langchain） |
| `JWT_SECRET` | 生产必须 | JWT 签名密钥 |
| `ENCRYPTION_KEY` | 生产必须 | API Key 加密密钥（32 字符） |
| `REDIS_URL` | 否 | Redis 连接串（未配置则内存降级） |
| `LOG_LEVEL` | 否 | 日志级别（debug/info/warn/error） |
| `GITHUB_CLIENT_ID` | 否 | GitHub OAuth Client ID |
| `GITHUB_CLIENT_SECRET` | 否 | GitHub OAuth Client Secret |
| `GOOGLE_CLIENT_ID` | 否 | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | 否 | Google OAuth Client Secret |
| `SMTP_HOST` | 否 | SMTP 服务器（未配置则 Mock） |

---

## 部署

### Docker

```bash
docker build -t aichat .
docker run -p 8000:8000 \
  -e DATABASE_URL=postgres://... \
  -e JWT_SECRET=your-secret \
  -e ENCRYPTION_KEY=32-char-key \
  aichat
```

### Fly.io

```bash
fly deploy
```

---

## 文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 需求文档 | `docs/requirements/` | 24 份里程碑需求 |
| 学习文档 | `docs/learning/` | 技术学习笔记 |
| 开发进度 | `docs/progress.md` | 实时进度记录 |
| 问题追踪 | `docs/issues.md` | 问题与解决方案 |
| 待办池 | `docs/backlog.md` | 遗留优化项 |
| 审计报告 | `docs/production-audit.md` | 生产级差距分析 |
| 交接文档 | `docs/handoff/` | 环境/API/交接说明 |

---

## CI/CD

GitHub Actions 自动化流水线（`.github/workflows/ci.yml`）：

```
push/PR → Lint → TypeCheck → Test → Build
```

本地 pre-commit 钩子（Husky + lint-staged）：

```
git commit → ESLint + Prettier 自动检查
```

---

## License

MIT
