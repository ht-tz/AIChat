# SplitAiAgent 前后端分离架构设计

> 将 NEXUS AI Agent 项目从 Next.js 单体架构拆分为前后端分离的 Monorepo 架构

## 1. 项目概述

### 1.1 背景

NEXUS 是一个面向开发者的 AI Agent 学习平台，当前使用 Next.js 14 单体架构，前后端代码耦合在同一项目中。为了支持工业级生产部署、团队协作和技术栈优化，需要将项目拆分为前后端分离的架构。

### 1.2 目标

- 前后端完全解耦，独立开发、测试、部署
- 前端使用 Vite + React 19，轻量快速
- 后端使用 NestJS + Prisma + PostgreSQL，工业级标准
- 使用 Turborepo 管理 Monorepo
- 保持所有现有功能完整迁移

### 1.3 技术栈

| 层级 | 技术选型 |
|------|----------|
| 前端构建 | Vite 6 |
| 前端框架 | React 19 |
| 前端路由 | React Router v7 |
| 前端样式 | Tailwind CSS 4 + Radix UI |
| 前端状态 | Zustand 5 + React Query |
| 后端框架 | NestJS |
| ORM | Prisma |
| 数据库 | PostgreSQL + pgvector |
| 缓存 | Redis |
| AI 编排 | LangChain |
| Monorepo | Turborepo + pnpm workspaces |
| 容器化 | Docker + Docker Compose |

---

## 2. 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Browser                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Vite + React 19                                            │   │
│  │  ├── React Router v7 (客户端路由)                            │   │
│  │  ├── Radix UI + Tailwind CSS (UI)                           │   │
│  │  ├── Zustand (状态管理)                                      │   │
│  │  ├── React Query (数据获取)                                  │   │
│  │  └── Axios (HTTP 客户端)                                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTP/REST + SSE
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         NestJS Backend                              │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Modules                                                    │   │
│  │  ├── AuthModule (JWT + OAuth + 邮箱验证)                     │   │
│  │  ├── ChatModule (SSE 流式对话)                               │   │
│  │  ├── AgentModule (ReAct、Plan、Reflection)                   │   │
│  │  ├── ToolModule (工具注册与调用)                              │   │
│  │  ├── KnowledgeModule (RAG、文档管理)                         │   │
│  │  ├── MemoryModule (记忆系统)                                 │   │
│  │  ├── MultiAgentModule (多智能体协作)                         │   │
│  │  ├── PromptModule (提示词工程)                               │   │
│  │  └── ModelConfigModule (模型配置)                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  核心服务                                                    │   │
│  │  ├── PrismaService (数据库)                                  │   │
│  │  ├── LangChainService (AI 编排)                              │   │
│  │  ├── LLMProviderService (模型调用)                           │   │
│  │  └── EventEmitterService (事件总线)                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ Prisma Client
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       PostgreSQL + pgvector                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Monorepo 目录结构

```
splitAiAgent/
├── apps/
│   ├── web/                              # Vite + React 19 前端应用
│   │   ├── src/
│   │   │   ├── pages/                    # 页面组件
│   │   │   │   ├── auth/
│   │   │   │   │   ├── LoginPage.tsx
│   │   │   │   │   └── RegisterPage.tsx
│   │   │   │   ├── chat/
│   │   │   │   │   └── ChatPage.tsx
│   │   │   │   ├── knowledge/
│   │   │   │   │   └── KnowledgePage.tsx
│   │   │   │   ├── memory/
│   │   │   │   │   └── MemoryPage.tsx
│   │   │   │   ├── prompts/
│   │   │   │   │   ├── PromptsPage.tsx
│   │   │   │   │   └── PlaygroundPage.tsx
│   │   │   │   ├── reasoning/
│   │   │   │   │   └── ReasoningPage.tsx
│   │   │   │   ├── langchain/
│   │   │   │   │   └── LangChainPage.tsx
│   │   │   │   ├── collaboration/
│   │   │   │   │   └── CollaborationPage.tsx
│   │   │   │   ├── docs/
│   │   │   │   │   ├── DocsPage.tsx
│   │   │   │   │   └── DocDetailPage.tsx
│   │   │   │   ├── settings/
│   │   │   │   │   ├── SettingsPage.tsx
│   │   │   │   │   ├── ModelConfigPage.tsx
│   │   │   │   │   └── ProfilePage.tsx
│   │   │   │   ├── admin/
│   │   │   │   │   └── users/
│   │   │   │   │       └── UsersPage.tsx
│   │   │   │   └── NotFoundPage.tsx
│   │   │   ├── components/               # UI 组件
│   │   │   │   ├── ui/                   # 基础组件（来自 @ai/ui）
│   │   │   │   │   ├── Button.tsx
│   │   │   │   │   ├── Card.tsx
│   │   │   │   │   ├── Dialog.tsx
│   │   │   │   │   ├── Input.tsx
│   │   │   │   │   ├── DropdownMenu.tsx
│   │   │   │   │   ├── Tabs.tsx
│   │   │   │   │   ├── Tooltip.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   ├── chat/                 # 聊天组件
│   │   │   │   │   ├── ChatContainer.tsx
│   │   │   │   │   ├── MessageList.tsx
│   │   │   │   │   ├── MessageItem.tsx
│   │   │   │   │   ├── Composer.tsx
│   │   │   │   │   └── StreamingIndicator.tsx
│   │   │   │   ├── agent/                # Agent 组件
│   │   │   │   │   ├── AgentCard.tsx
│   │   │   │   │   ├── PlanTodo.tsx
│   │   │   │   │   ├── ThoughtPanel.tsx
│   │   │   │   │   ├── ToolCallCard.tsx
│   │   │   │   │   └── ReflectionScore.tsx
│   │   │   │   ├── knowledge/            # 知识库组件
│   │   │   │   │   ├── DocumentList.tsx
│   │   │   │   │   ├── DocumentUpload.tsx
│   │   │   │   │   └── SearchPanel.tsx
│   │   │   │   ├── memory/               # 记忆组件
│   │   │   │   │   ├── MemoryList.tsx
│   │   │   │   │   ├── MemoryCard.tsx
│   │   │   │   │   └── MemoryTimeline.tsx
│   │   │   │   ├── prompt/               # 提示词组件
│   │   │   │   │   ├── PromptList.tsx
│   │   │   │   │   ├── PromptEditor.tsx
│   │   │   │   │   └── VariableForm.tsx
│   │   │   │   ├── multi-agent/          # 多智能体组件
│   │   │   │   │   ├── WorkflowGraph.tsx
│   │   │   │   │   ├── ProgressPanel.tsx
│   │   │   │   │   └── StepTimeline.tsx
│   │   │   │   ├── docs/                 # 文档组件
│   │   │   │   │   ├── MarkdownViewer.tsx
│   │   │   │   │   └── DocsSidebar.tsx
│   │   │   │   └── layout/               # 布局组件
│   │   │   │       ├── AppLayout.tsx
│   │   │   │       ├── Sidebar.tsx
│   │   │   │       ├── Header.tsx
│   │   │   │       ├── SessionList.tsx
│   │   │   │       └── UserMenu.tsx
│   │   │   ├── features/                 # 业务功能模块
│   │   │   │   ├── chat/
│   │   │   │   ├── knowledge/
│   │   │   │   ├── memory/
│   │   │   │   ├── prompt/
│   │   │   │   ├── reasoning/
│   │   │   │   └── langchain/
│   │   │   ├── hooks/                    # 自定义 Hooks
│   │   │   │   ├── useApi.ts
│   │   │   │   ├── useSSE.ts
│   │   │   │   ├── useChat.ts
│   │   │   │   ├── useAuth.ts
│   │   │   │   └── ...
│   │   │   ├── stores/                   # Zustand 状态
│   │   │   │   ├── appStore.ts
│   │   │   │   ├── authStore.ts
│   │   │   │   ├── chatStore.ts
│   │   │   │   ├── memoryStore.ts
│   │   │   │   ├── promptStore.ts
│   │   │   │   ├── settingsStore.ts
│   │   │   │   ├── themeStore.ts
│   │   │   │   └── sidebarStore.ts
│   │   │   ├── api/                      # API 客户端
│   │   │   │   ├── client.ts             # Axios 实例
│   │   │   │   ├── interceptors.ts       # 请求/响应拦截
│   │   │   │   ├── auth.ts               # 认证 API
│   │   │   │   ├── chat.ts               # 聊天 API
│   │   │   │   ├── agent.ts              # Agent API
│   │   │   │   ├── tool.ts               # 工具 API
│   │   │   │   ├── knowledge.ts          # 知识库 API
│   │   │   │   ├── memory.ts             # 记忆 API
│   │   │   │   ├── experience.ts         # 经验 API
│   │   │   │   ├── prompt.ts             # 提示词 API
│   │   │   │   ├── multi-agent.ts        # 多智能体 API
│   │   │   │   ├── model-config.ts       # 模型配置 API
│   │   │   │   ├── reasoning.ts          # 推理 API
│   │   │   │   ├── langchain.ts          # LangChain API
│   │   │   │   ├── evaluation.ts         # 评估 API
│   │   │   │   ├── ab-test.ts            # A/B 测试 API
│   │   │   │   ├── export.ts             # 导出 API
│   │   │   │   ├── file.ts               # 文件 API
│   │   │   │   ├── performance.ts        # 性能 API
│   │   │   │   └── user.ts               # 用户 API
│   │   │   ├── lib/                      # 工具函数
│   │   │   │   ├── utils.ts              # 通用工具
│   │   │   │   ├── format.ts             # 格式化
│   │   │   │   ├── validation.ts         # 验证
│   │   │   │   ├── agent-utils.ts        # Agent 工具
│   │   │   │   ├── types.ts              # 类型定义
│   │   │   │   └── constants.ts          # 常量
│   │   │   ├── router/                   # 路由配置
│   │   │   │   └── index.tsx
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── public/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   └── api/                              # NestJS 后端应用
│       ├── src/
│       │   ├── modules/                  # 功能模块
│       │   │   ├── auth/
│       │   │   │   ├── auth.module.ts
│       │   │   │   ├── auth.controller.ts
│       │   │   │   ├── auth.service.ts
│       │   │   │   ├── auth-middleware.ts
│       │   │   │   ├── email-service.ts
│       │   │   │   ├── oauth-service.ts
│       │   │   │   ├── strategies/
│       │   │   │   │   ├── jwt.strategy.ts
│       │   │   │   │   ├── github.strategy.ts
│       │   │   │   │   └── google.strategy.ts
│       │   │   │   ├── guards/
│       │   │   │   └── dto/
│       │   │   ├── user/
│       │   │   │   ├── user.module.ts
│       │   │   │   ├── user.controller.ts
│       │   │   │   └── user.service.ts
│       │   │   ├── chat/
│       │   │   │   ├── chat.module.ts
│       │   │   │   ├── chat.controller.ts
│       │   │   │   ├── chat.service.ts
│       │   │   │   └── dto/
│       │   │   ├── agent/
│       │   │   │   ├── agent.module.ts
│       │   │   │   ├── agent.controller.ts
│       │   │   │   ├── agent.service.ts
│       │   │   │   ├── dispatcher.ts
│       │   │   │   └── persistence.ts
│       │   │   ├── tool/
│       │   │   │   ├── tool.module.ts
│       │   │   │   ├── tool.controller.ts
│       │   │   │   ├── tool.service.ts
│       │   │   │   ├── registry.ts
│       │   │   │   ├── types.ts
│       │   │   │   └── builtin/
│       │   │   │       ├── calculator.tool.ts
│       │   │   │       ├── code-runner.tool.ts
│       │   │   │       ├── generate-image.tool.ts
│       │   │   │       ├── get-current-time.tool.ts
│       │   │   │       ├── read-file.tool.ts
│       │   │   │       ├── read-pdf.tool.ts
│       │   │   │       ├── summarize-report.tool.ts
│       │   │   │       ├── web-search.tool.ts
│       │   │   │       └── word-count.tool.ts
│       │   │   ├── knowledge/
│       │   │   │   ├── knowledge.module.ts
│       │   │   │   ├── knowledge.controller.ts
│       │   │   │   ├── knowledge.service.ts
│       │   │   │   ├── document.service.ts
│       │   │   │   ├── rag.service.ts
│       │   │   │   ├── multi-agent.ts
│       │   │   │   └── vector-store.ts
│       │   │   ├── memory/
│       │   │   │   ├── memory.module.ts
│       │   │   │   ├── memory.controller.ts
│       │   │   │   ├── memory.service.ts
│       │   │   │   ├── experience.service.ts
│       │   │   │   ├── memory-injection.ts
│       │   │   │   └── vector-utils.ts
│       │   │   ├── experience/
│       │   │   │   ├── experience.module.ts
│       │   │   │   ├── experience.controller.ts
│       │   │   │   └── experience.service.ts
│       │   │   ├── multi-agent/
│       │   │   │   ├── multi-agent.module.ts
│       │   │   │   ├── multi-agent.controller.ts
│       │   │   │   ├── multi-agent.service.ts
│       │   │   │   ├── agents.ts
│       │   │   │   ├── message-bus.ts
│       │   │   │   ├── run-store.ts
│       │   │   │   ├── workflow-engine.ts
│       │   │   │   └── workflow-templates.ts
│       │   │   ├── prompt/
│       │   │   │   ├── prompt.module.ts
│       │   │   │   ├── prompt.controller.ts
│       │   │   │   ├── prompt.service.ts
│       │   │   │   ├── playground-service.ts
│       │   │   │   ├── builtin-templates.ts
│       │   │   │   ├── variable-parser.ts
│       │   │   │   └── dto/
│       │   │   ├── model-config/
│       │   │   │   ├── model-config.module.ts
│       │   │   │   ├── model-config.controller.ts
│       │   │   │   └── model-config.service.ts
│       │   │   ├── experience/
│       │   │   │   ├── experience.module.ts
│       │   │   │   ├── experience.controller.ts
│       │   │   │   └── experience.service.ts
│       │   │   ├── reasoning/
│       │   │   │   ├── reasoning.module.ts
│       │   │   │   ├── reasoning.controller.ts
│       │   │   │   ├── reasoning.service.ts
│       │   │   │   ├── plan-optimizer.ts
│       │   │   │   ├── reflection-engine.ts
│       │   │   │   └── tool-strategy.ts
│       │   │   ├── langchain/
│       │   │   │   ├── langchain.module.ts
│       │   │   │   ├── langchain.controller.ts
│       │   │   │   ├── langchain.service.ts
│       │   │   │   ├── graph.service.ts
│       │   │   │   └── checkpoint.service.ts
│       │   │   ├── evaluation/
│       │   │   │   ├── evaluation.module.ts
│       │   │   │   ├── evaluation.controller.ts
│       │   │   │   └── evaluation.service.ts
│       │   │   ├── ab-test/
│       │   │   │   ├── ab-test.module.ts
│       │   │   │   ├── ab-test.controller.ts
│       │   │   │   └── ab-test.service.ts
│       │   │   ├── export/
│       │   │   │   ├── export.module.ts
│       │   │   │   ├── export.controller.ts
│       │   │   │   └── export.service.ts
│       │   │   ├── file/
│       │   │   │   ├── file.module.ts
│       │   │   │   ├── file.controller.ts
│       │   │   │   └── file.service.ts
│       │   │   └── performance/
│       │   │       ├── performance.module.ts
│       │   │       ├── performance.controller.ts
│       │   │       └── performance.service.ts
│       │   ├── common/                   # 公共模块
│       │   │   ├── decorators/
│       │   │   │   ├── current-user.decorator.ts
│       │   │   │   └── api-response.decorator.ts
│       │   │   ├── filters/
│       │   │   │   ├── http-exception.filter.ts
│       │   │   │   └── prisma-exception.filter.ts
│       │   │   ├── guards/
│       │   │   │   ├── jwt-auth.guard.ts
│       │   │   │   ├── roles.guard.ts
│       │   │   │   └── throttle.guard.ts
│       │   │   ├── interceptors/
│       │   │   │   ├── logging.interceptor.ts
│       │   │   │   └── transform.interceptor.ts
│       │   │   ├── pipes/
│       │   │   │   └── validation.pipe.ts
│       │   │   └── middleware/
│       │   │       ├── cors.middleware.ts
│       │   │       ├── rate-limiter.middleware.ts
│       │   │       ├── input-validator.middleware.ts
│       │   │       └── request-id.middleware.ts
│       │   ├── core/                     # 核心模块
│       │   │   ├── prisma/
│       │   │   │   ├── prisma.module.ts
│       │   │   │   └── prisma.service.ts
│       │   │   ├── langchain/
│       │   │   │   ├── langchain.module.ts
│       │   │   │   ├── langchain.controller.ts
│       │   │   │   ├── langchain.service.ts
│       │   │   │   ├── graph.ts
│       │   │   │   ├── checkpoint.ts
│       │   │   │   ├── conditional-edges.ts
│       │   │   │   ├── document-loaders.ts
│       │   │   │   ├── prompts.ts
│       │   │   │   ├── provider.ts
│       │   │   │   ├── rag.ts
│       │   │   │   └── tools-adapter.ts
│       │   │   ├── llm/
│       │   │   │   ├── llm.module.ts
│       │   │   │   ├── llm.service.ts
│       │   │   │   └── providers/
│       │   │   │       ├── openai.provider.ts
│       │   │   │       ├── anthropic.provider.ts
│       │   │   │       ├── deepseek.provider.ts
│       │   │   │       ├── mock.provider.ts
│       │   │   │       └── embedding/
│       │   │   │           └── openai-compatible.provider.ts
│       │   │   ├── event-emitter/
│       │   │   │   ├── event-emitter.module.ts
│       │   │   │   └── event-emitter.service.ts
│       │   │   ├── cache/
│       │   │   │   ├── cache.module.ts
│       │   │   │   └── cache.service.ts
│       │   │   ├── crypto/
│       │   │   │   ├── crypto.module.ts
│       │   │   │   └── crypto.service.ts
│       │   │   └── docs/
│       │   │       ├── docs.module.ts
│       │   │       └── docs.service.ts
│       │   ├── config/
│       │   ├── main.ts
│       │   └── app.module.ts
│       ├── test/
│       │   ├── unit/
│       │   ├── integration/
│       │   └── e2e/
│       ├── nest-cli.json
│       ├── tsconfig.json
│       ├── package.json
│       └── Dockerfile
│
├── packages/
│   ├── shared/                           # 共享类型和工具
│   │   ├── src/
│   │   │   ├── types/                    # TypeScript 类型定义
│   │   │   ├── constants/                # 常量
│   │   │   ├── utils/                    # 工具函数
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ui/                               # 共享 UI 组件
│   │   ├── src/
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── tooltip.tsx
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── database/                         # Prisma schema 和迁移
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── config/                           # 共享配置
│       ├── eslint/
│       ├── typescript/
│       └── tailwind/
│
├── docker/                               # Docker 配置
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── web.Dockerfile
│   ├── api.Dockerfile
│   └── nginx/
│       └── nginx.conf
│
├── scripts/
│   ├── setup.sh
│   ├── build.sh
│   └── deploy.sh
│
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .gitignore
├── .env.example
└── README.md
```

---

## 4. 后端模块设计

### 4.1 模块职责

| 模块 | 职责 | 主要 API |
|------|------|----------|
| AuthModule | 用户认证、JWT、OAuth | POST /auth/* |
| UserModule | 用户信息管理 | GET/PATCH /users/* |
| ChatModule | SSE 流式对话 | POST /chat |
| AgentModule | Agent 运行、调度 | CRUD /agents |
| ToolModule | 工具注册、执行 | CRUD /tools |
| KnowledgeModule | 知识库、RAG | CRUD /knowledge |
| MemoryModule | 记忆系统 | CRUD /memories |
| ExperienceModule | 经验案例管理 | CRUD /experiences |
| MultiAgentModule | 多智能体协作 | POST /multi-agent/* |
| PromptModule | 提示词模板、Playground | CRUD /prompts, POST /playground |
| ModelConfigModule | 模型配置 | CRUD /model-configs |
| ReasoningModule | 推理实验（分解、反思） | POST /reasoning/* |
| LangChainModule | LangGraph 图执行 | POST /langchain/* |
| EvaluationModule | 模型评估 | POST /evaluation |
| ABTestModule | A/B 测试分流 | POST /ab-test |
| ExportModule | 数据导出 | POST /export |
| PerformanceModule | 性能监控统计 | GET /performance/* |
| FileModule | 文件上传管理 | POST /files/* |

### 4.2 核心服务

```typescript
// PrismaService - 数据库服务
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}

// LLMProviderService - LLM 调用服务
@Injectable()
export class LLMProviderService {
  async stream(chatRequest: ChatRequest): AsyncIterable<AgentStep> {
    const provider = this.getProvider(chatRequest.model);
    return provider.stream(chatRequest);
  }
  
  async complete(chatRequest: ChatRequest): Promise<ChatResponse> {
    const provider = this.getProvider(chatRequest.model);
    return provider.complete(chatRequest);
  }
}

// LangChainService - AI 编排服务
@Injectable()
export class LangChainService {
  async executeGraph(graph: Graph, input: GraphInput): AsyncIterable<AgentStep> {
    // 执行 LangGraph 图
  }
}
```

---

## 5. 前端模块设计

### 5.1 页面路由

```typescript
// router/index.tsx
const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/chat" /> },
      { path: 'chat', element: <ChatPage /> },
      { path: 'chat/:sessionId', element: <ChatPage /> },
      { path: 'knowledge', element: <KnowledgePage /> },
      { path: 'memory', element: <MemoryPage /> },
      { path: 'prompts', element: <PromptsPage /> },
      { path: 'prompts/playground', element: <PlaygroundPage /> },
      { path: 'reasoning', element: <ReasoningPage /> },
      { path: 'langchain', element: <LangChainPage /> },
      { path: 'collaboration', element: <CollaborationPage /> },
      { path: 'docs', element: <DocsPage /> },
      { path: 'docs/:slug', element: <DocDetailPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'settings/models', element: <ModelConfigPage /> },
      { path: 'settings/profile', element: <ProfilePage /> },
      { path: 'admin/users', element: <UsersPage /> },
    ],
  },
  {
    path: '/auth',
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
```

### 5.2 状态管理

```typescript
// stores/chatStore.ts
interface ChatState {
  sessions: Session[];
  currentSession: Session | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

export const useChatStore = create<ChatState>((set) => ({
  sessions: [],
  currentSession: null,
  messages: [],
  isLoading: false,
  error: null,
  // actions...
}));

// 使用 React Query 管理服务器状态
export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: chatApi.getSessions,
  });
}
```

### 5.3 API 客户端

```typescript
// api/client.ts
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加 Token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器 - 处理错误和 Token 刷新
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // 尝试刷新 Token
      const refreshed = await refreshToken();
      if (refreshed) {
        return apiClient.request(error.config);
      }
      // 跳转到登录页
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  },
);
```

---

## 6. API 设计

### 6.1 认证模块

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/logout` | 用户登出 |
| GET | `/api/auth/me` | 获取当前用户 |
| POST | `/api/auth/refresh` | 刷新 Token |
| POST | `/api/auth/verify-email` | 验证邮箱 |
| POST | `/api/auth/send-verification` | 发送验证邮件 |
| POST | `/api/auth/oauth/:provider` | OAuth 登录 |
| GET | `/api/auth/oauth/:provider/callback` | OAuth 回调 |

### 6.2 聊天模块

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chat` | 发送消息（SSE） |
| GET | `/api/chat/sessions` | 获取会话列表 |
| POST | `/api/chat/sessions` | 创建会话 |
| GET | `/api/chat/sessions/:id` | 获取会话详情 |
| PATCH | `/api/chat/sessions/:id` | 更新会话 |
| DELETE | `/api/chat/sessions/:id` | 删除会话 |
| GET | `/api/chat/sessions/:id/messages` | 获取消息 |

### 6.3 Agent 模块

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agents` | 获取 Agent 列表 |
| POST | `/api/agents` | 创建 Agent |
| GET | `/api/agents/:id` | 获取 Agent 详情 |
| PATCH | `/api/agents/:id` | 更新 Agent |
| DELETE | `/api/agents/:id` | 删除 Agent |

### 6.4 工具模块

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tools` | 获取工具列表 |
| POST | `/api/tools` | 注册工具 |
| GET | `/api/tools/:id` | 获取工具详情 |
| PATCH | `/api/tools/:id` | 更新工具 |
| DELETE | `/api/tools/:id` | 删除工具 |
| POST | `/api/tools/:id/execute` | 执行工具 |

### 6.5 知识库模块

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/knowledge` | 获取知识库列表 |
| POST | `/api/knowledge` | 创建知识库 |
| GET | `/api/knowledge/:id` | 获取知识库详情 |
| DELETE | `/api/knowledge/:id` | 删除知识库 |
| GET | `/api/knowledge/:id/documents` | 获取文档列表 |
| POST | `/api/knowledge/:id/documents` | 上传文档 |
| DELETE | `/api/knowledge/:id/documents/:docId` | 删除文档 |
| POST | `/api/knowledge/:id/search` | 搜索知识库 |
| POST | `/api/knowledge/:id/rag` | RAG 检索 |

### 6.6 记忆模块

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/memories` | 获取记忆列表 |
| POST | `/api/memories` | 创建记忆 |
| GET | `/api/memories/:id` | 获取记忆详情 |
| PATCH | `/api/memories/:id` | 更新记忆 |
| DELETE | `/api/memories/:id` | 删除记忆 |
| POST | `/api/memories/search` | 搜索记忆 |
| POST | `/api/memory/injection` | 记忆注入 |

### 6.7 经验案例模块

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/experiences` | 获取经验列表 |
| POST | `/api/experiences` | 创建经验 |
| GET | `/api/experiences/:id` | 获取经验详情 |
| PATCH | `/api/experiences/:id` | 更新经验 |
| DELETE | `/api/experiences/:id` | 删除经验 |
| POST | `/api/experiences/search` | 搜索经验 |

### 6.8 提示词模块

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/prompts` | 获取提示词模板列表 |
| POST | `/api/prompts` | 创建提示词模板 |
| GET | `/api/prompts/:id` | 获取提示词模板详情 |
| PATCH | `/api/prompts/:id` | 更新提示词模板 |
| DELETE | `/api/prompts/:id` | 删除提示词模板 |
| GET | `/api/prompts/:id/versions` | 获取版本历史 |
| POST | `/api/prompts/:id/versions` | 创建新版本 |
| POST | `/api/playground` | Playground 测试 |

### 6.9 多智能体模块

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/multi-agent/teams` | 获取团队列表 |
| POST | `/api/multi-agent/teams` | 创建团队 |
| GET | `/api/multi-agent/teams/:id` | 获取团队详情 |
| PATCH | `/api/multi-agent/teams/:id` | 更新团队 |
| DELETE | `/api/multi-agent/teams/:id` | 删除团队 |
| POST | `/api/multi-agent/runs` | 启动运行 |
| GET | `/api/multi-agent/runs` | 获取运行列表 |
| GET | `/api/multi-agent/runs/:id` | 获取运行详情 |
| POST | `/api/multi-agent/runs/:id/cancel` | 取消运行 |

### 6.10 模型配置模块

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/model-configs` | 获取模型配置列表 |
| POST | `/api/model-configs` | 创建模型配置 |
| GET | `/api/model-configs/:id` | 获取模型配置详情 |
| PATCH | `/api/model-configs/:id` | 更新模型配置 |
| DELETE | `/api/model-configs/:id` | 删除模型配置 |
| POST | `/api/model-configs/:id/activate` | 激活模型 |
| POST | `/api/model-configs/:id/test` | 测试模型连接 |

### 6.11 推理模块

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/reasoning/decompose` | 问题分解 |
| POST | `/api/reasoning/reflect` | 反思推理 |

### 6.12 LangChain 模块

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/langchain/chat` | LangChain 对话 |
| POST | `/api/langchain/graph/start` | 启动图执行 |
| POST | `/api/langchain/graph/run` | 运行图 |
| POST | `/api/langchain/graph/resume` | 恢复图执行 |
| POST | `/api/langchain/graph/rollback` | 回滚图 |
| GET | `/api/langchain/graph/states` | 获取图状态 |
| GET | `/api/langchain/graph/states/:threadId` | 获取线程状态 |
| GET | `/api/langchain/graph/threads` | 获取线程列表 |
| POST | `/api/langchain/prompt` | 提示词处理 |
| POST | `/api/langchain/rag` | RAG 检索 |
| GET | `/api/langchain/tools` | 获取 LangChain 工具 |

### 6.13 评估模块

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/evaluation` | 运行评估 |

### 6.14 A/B 测试模块

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ab-test` | 创建/获取实验分流 |

### 6.15 导出模块

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/export` | 导出数据 |

### 6.16 文件模块

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/upload` | 上传文件 |
| GET | `/api/files/:id` | 获取文件信息 |
| GET | `/api/files/:id/download` | 下载文件 |
| DELETE | `/api/files/:id` | 删除文件 |

### 6.17 性能监控模块

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/performance` | 获取性能数据 |
| GET | `/api/performance/stats` | 获取性能统计 |

### 6.18 用户模块

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/users/profile` | 获取用户资料 |
| PATCH | `/api/users/profile` | 更新用户资料 |
| PATCH | `/api/users/password` | 修改密码 |
| GET | `/api/users/api-keys` | 获取 API Key 列表 |
| POST | `/api/users/api-keys` | 创建 API Key |
| DELETE | `/api/users/api-keys/:id` | 删除 API Key |

### 6.19 管理模块

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/users` | 获取用户列表 |
| GET | `/api/admin/users/:id` | 获取用户详情 |
| PATCH | `/api/admin/users/:id` | 更新用户 |
| DELETE | `/api/admin/users/:id` | 删除用户 |

### 6.20 响应格式

```typescript
// 成功响应
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}

// 分页响应
{
  "success": true,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}

// 错误响应
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "参数验证失败",
    "details": [...]
  }
}
```

---

## 7. 数据流设计

### 7.1 SSE 流式对话

```
用户输入 → 前端 POST /api/chat → ChatController → ChatService → AgentService
    → Dispatcher → LLMProvider → SSE 编码 → 前端解析 → 增量渲染
```

### 7.2 认证流程

```
登录请求 → AuthController → AuthService → 生成 JWT → 返回 Token
    → 前端存储 Token → 后续请求自动携带 → JWT Guard 验证
```

### 7.3 RAG 检索流程

```
用户提问 → AgentService → KnowledgeService.search()
    → 向量检索 → 返回相关文档 → 注入提示词 → LLM 生成回答
```

---

## 8. 安全设计

### 8.1 认证与授权

- JWT Token 认证
- OAuth 2.0 (GitHub/Google)
- 邮箱验证
- RBAC 角色授权 (admin/user)

### 8.2 防护措施

- Rate Limiting (IP 限流 100 req/min)
- Input Validation (Zod Schema)
- CORS 配置
- Helmet 安全头
- XSS 过滤
- SQL 注入防护 (Prisma ORM)

### 8.3 数据安全

- 密码 bcrypt 加密
- API Key 哈希存储
- 敏感数据 AES-256 加密

---

## 9. 测试策略

### 9.1 测试分层

| 层级 | 覆盖率 | 工具 |
|------|--------|------|
| 单元测试 | ≥ 80% | Jest / Vitest |
| 集成测试 | ≥ 60% | Supertest + TestContainers |
| E2E 测试 | 关键路径 | Playwright |

### 9.2 测试结构

```
后端: test/unit/, test/integration/, test/e2e/
前端: src/__tests__/components/, src/__tests__/features/, src/__tests__/pages/
```

---

## 10. Docker 部署

### 10.1 服务组成

- **web**: Nginx 托管前端静态文件
- **api**: Node.js 运行 NestJS 后端
- **postgres**: PostgreSQL + pgvector 数据库
- **redis**: Redis 缓存
- **nginx**: 反向代理（生产环境）

### 10.2 端口映射

| 服务 | 端口 |
|------|------|
| nginx | 80, 443 |
| web | 3000 |
| api | 4000 |
| postgres | 5432 |
| redis | 6379 |

### 10.3 环境变量

```bash
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/aiagent
REDIS_URL=redis://redis:6379
JWT_SECRET=your-secret-key
OPENAI_API_KEY=your-api-key
```

---

## 11. 迁移计划

### 11.1 阶段一：基础设施搭建

1. 初始化 Turborepo Monorepo
2. 配置共享包 (shared, ui, database, config)
3. 搭建 NestJS 后端框架
4. 搭建 Vite + React 19 前端框架

### 11.2 阶段二：数据库迁移

1. 将 Drizzle Schema 转换为 Prisma Schema
2. 优化数据库设计
3. 生成 Prisma Client
4. 编写数据库迁移脚本

### 11.3 阶段三：后端模块开发

1. AuthModule (认证)
2. UserModule (用户)
3. ChatModule (聊天)
4. AgentModule (Agent)
5. ToolModule (工具)
6. KnowledgeModule (知识库)
7. MemoryModule (记忆)
8. ExperienceModule (经验案例)
9. MultiAgentModule (多智能体)
10. PromptModule (提示词)
11. ModelConfigModule (模型配置)
12. ReasoningModule (推理)
13. LangChainModule (LangChain)
14. EvaluationModule (评估)
15. ABTestModule (A/B 测试)
16. ExportModule (导出)
17. FileModule (文件)
18. PerformanceModule (性能监控)

### 11.4 阶段四：前端页面开发

1. 认证页面 (登录/注册)
2. 聊天页面
3. 知识库页面
4. 记忆页面
5. 提示词页面 + Playground
6. 推理实验页面
7. LangChain 可视化页面
8. 协作页面
9. 文档页面
10. 设置页面 (模型配置、个人资料)
11. 管理页面

### 11.5 阶段五：测试与部署

1. 编写单元测试
2. 编写集成测试
3. 编写 E2E 测试
4. Docker 容器化
5. CI/CD 配置

---

## 12. 附录

### 12.1 术语表

| 术语 | 说明 |
|------|------|
| Agent | AI 智能体，能够自主完成任务 |
| ReAct | Reasoning + Acting，推理与行动结合的 Agent 模式 |
| RAG | Retrieval-Augmented Generation，检索增强生成 |
| SSE | Server-Sent Events，服务端推送事件 |
| Monorepo | 单一仓库管理多个项目 |

### 12.2 参考文档

- [NestJS 官方文档](https://docs.nestjs.com/)
- [Prisma 官方文档](https://www.prisma.io/docs/)
- [Vite 官方文档](https://vitejs.dev/)
- [React 19 文档](https://react.dev/)
- [Turborepo 文档](https://turbo.build/repo)
