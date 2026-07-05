# 交接提示词 — 复制粘贴到新 Trae IDE 对话

---

将以下内容完整复制，粘贴到新的 Trae IDE 对话中即可继续工作：

---

```
请先阅读以下关键文件了解项目，然后开始工作：

1. `CLAUDE.md` — AI 助手指令（必须遵循所有规则）
2. `docs/handover.md` — 完整交接文档（项目架构/部署/待办全在里面）
3. `docs/production-audit.md` — 审计清单
4. `docs/roadmap.md` — 路线图

阅读完后，运行以下命令确认环境正常：
pnpm lint && pnpm test && pnpm typecheck && pnpm build

---

## 项目概况

你正在维护 **NEXUS AI Agent**，一个全栈 AI 智能体平台。

- 仓库：https://github.com/ht-tz/AIChat
- 线上：https://ai-chat-ghtz.vercel.app
- 本地启动：`pnpm dev` → http://localhost:8000
- 技术栈：Next.js 15 + TypeScript + Tailwind CSS 4 + shadcn/ui + Drizzle ORM + Neon PostgreSQL + pino

## 当前进度

已完成 24/26 个里程碑（M1-M24，M22-M24 为生产审计加固）。CI 通过，线上部署正常。

## 当前待办（按优先级）

### P0：测试覆盖率（目标 30%+）
- 补充 `/api/auth`、`/api/chat`、`/api/agents`、`/api/rag` 等核心端点的集成测试
- 测试框架已配好（Vitest），`pnpm test` 运行
- 测试文件放在 `__tests__/` 目录

### P1：Sentry APM 集成
- 需要 Sentry 账号（sentry.io 免费版够用）
- `@sentry/nextjs` 包已可用
- 集成后错误自动上报，性能追踪可视化

### P1：多智能体运行控制
- 补充暂停/恢复/取消机制
- 支持并行/顺序/投票三种模式的运行生命周期管理

### P2：isolated-vm 沙箱
- Vercel 不支持 native 模块，需考虑 VM2 或 Web Worker 替代方案
- 目标：安全执行用户提供的代码片段

### P2：WebSocket 支持
- 当前用 SSE（Server-Sent Events）流式输出
- WebSocket 可支持双向实时通信

## 部署信息

### Vercel
- 项目：ai-chat（ghtz 账号）
- API Token：`<YOUR_VERCEL_TOKEN>`
- 用 Vercel API 修改环境变量：
  ```
  curl -s "https://api.vercel.com/v9/projects/ai-chat/env" \
    -H "Authorization: Bearer <YOUR_VERCEL_TOKEN>"
  ```

### GitHub CLI
- 已登录，可直接 `gh` 命令操作
- CI workflow：`.github/workflows/ci.yml`（lint + typecheck + test + build）

### 数据库
- Neon PostgreSQL（Serverless）
- 连接串：`<YOUR_DATABASE_URL>`
- 22 张表，Schema 在 `src/server/db/schema.ts`
- 迁移文件在 `drizzle/` 目录
- 初始化命令：`DATABASE_URL="..." pnpm db:push`

### AI 模型
- MiMo V2.5 Coding Plan（小米 MiMo）
- API：`https://token-plan-cn.xiaomimimo.com/v1`
- Key：`<YOUR_MIMO_API_KEY>`
- 模型名：`mimo-v2.5`

## 开发规范

1. 所有文档、注释、提交信息使用**中文**
2. 每个里程碑单独提交，格式：`feat/fix/docs(里程碑): 描述`
3. 始终使用 main 分支
4. 发布前检查：`pnpm lint && pnpm test && pnpm typecheck && pnpm build`
5. 先写代码，再更新文档（需求 → 学习 → 进度 → 路线图 → backlog）
6. 完成后 `git push origin main`，CI 自动运行

## 已知问题

- Vercel 不支持 native 模块（bcrypt 已换 bcryptjs）
- Neon 连接串可能带 `channel_binding=require`，postgres.js 不支持，`db/index.ts` 已自动清理
- 登录页路由是 `/auth/login`（不是 `/login`）

## 下一步行动

请先确认环境正常，然后从 P0（测试覆盖率）开始推进。每个任务完成后更新 `docs/progress.md`、对应的 `docs/requirements/` 和 `docs/learning/` 文档。
```
