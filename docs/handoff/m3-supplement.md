# M3 ReAct 多步推理 + DB · 交接补充

> 本文档作为 [README.md](./README.md) 的 M3 阶段补充。M3 在 M2 基础上引入多轮工具调用、Plan-and-Execute、Reflexion 自反思、并把推理过程落 PostgreSQL。
> 接手 M4 之前必读 [M3 学习文档](../learning/M3-react.md)。

## 1. M3 新增模块

### 1.1 数据库层（src/server/db/）

| 文件 | 职责 |
|------|------|
| `schema.ts` | 7 张表的 Drizzle schema：agents / sessions / messages / tool_calls / agent_runs / agent_steps / tools |
| `index.ts` | postgres-js + drizzle 连接（`process.env.DATABASE_URL`） |

### 1.2 调度层升级

| 文件 | 改动 |
|------|------|
| `src/server/agent/dispatcher.ts` | 多轮循环（maxToolRounds=5）+ 反思重试 + 持久化 hook |
| `src/server/agent/persistence.ts` | startRun / persistStep / finishRun / ensureSession |

### 1.3 Mock Provider 升级

`src/server/providers/mock.ts` 新增分支：
- 反思重试：检测 `[Reflection]` system 消息 → 输出"改进版答案" + score=0.92
- Plan 触发：用户输入"计划 xxx" → yield plan event + 触发 calculator
- 每次输出都 yield reflection event（self-grade 0.85-0.92）

### 1.4 前端组件

| 文件 | 职责 |
|------|------|
| `src/components/agent/plan-todo.tsx` | PlanTodoList + ReflectionCard |
| `src/components/chat/message-bubble.tsx` | 渲染 plans / reflections |
| `src/features/chat/chat-container.tsx` | 累积 plan / reflection 到 message |
| `src/hooks/use-chat-stream.ts` | body 加 `enablePlan` / `enableReflection` / `sessionId` |

### 1.5 数据库迁移

- `drizzle/0000_bizarre_master_mold.sql` —— 7 张表 + 4 个 enum
- `drizzle/0001_polite_lenny_balinger.sql` —— sessionId / messageId 改 varchar(64) 兼容 nanoid

### 1.6 脚本

- `scripts/db-push.sh` —— 绕开 drizzle-kit 0.28 卡死 bug
- `.env.local` —— 新增 `DATABASE_URL`

## 2. 数据库连接

```bash
# .env.local
DATABASE_URL=postgresql://tizen:root@localhost:5432/postgres
```

应用启动时自动连接（不需要 schema push）。如要重建表：

```bash
pnpm db:push   # 跑 drizzle/*.sql
```

## 3. 验证命令

```bash
# 启动
pnpm dev

# 烟囱测试：Plan + 工具 + 反思
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sess-m3-test",
    "messages": [{"role":"user","content":"计划 计算 100 + 200"}],
    "enablePlan": true,
    "enableReflection": true,
    "maxToolRounds": 5
  }' --no-buffer | grep '"kind"'

# DB 验证
PGPASSWORD=root psql -h localhost -U tizen -d postgres -c "SELECT * FROM agent_runs;"
PGPASSWORD=root psql -h localhost -U tizen -d postgres -c "SELECT step_index, kind, content FROM agent_steps ORDER BY step_index;"
```

## 4. M3 已修复的 ISSUE

- ISSUE-013 drizzle-kit 0.28 macOS 卡死 → `scripts/db-push.sh`
- ISSUE-014 sessionId 是 nanoid 非 UUID → schema 改 varchar
- ISSUE-015 agent_runs 外键约束 → dispatcher 自动 ensureSession

## 5. M3 已知未解决（ISSUE-016 / 017 / 018）

- **ISSUE-016** delta 事件未落库（M9 优化）
- **ISSUE-017** 反思重试复用 runId（M9 评估阶段可优化）
- **ISSUE-018** sessions.title 不自动更新（M4 接"会话同步"）

## 6. M4 启动指南（接力者必读）

### 6.1 M4 范围（多模态 + 存储）

- **文件上传**（PDF / Word / Excel / 图片 / 文本）
- **图片理解**（vision 模型）
- **图片生成**（DALL·E 3 / Stable Diffusion）
- **语音转文字**（Whisper）
- **OCR**（Tesseract / 阿里云 OCR）

### 6.2 数据库扩展（M4 需要）

```sql
-- 已有
agents / sessions / messages / tool_calls / agent_runs / agent_steps / tools

-- M4 新增
files          -- 上传文件元数据 + 存储路径
images         -- 图片生成记录
audio_files    -- 音频文件
file_chunks    -- 文档切片（为 M10 RAG 准备）
```

### 6.3 改动点预告

| 文件 | 改动 |
|------|------|
| `src/server/db/schema.ts` | 新增 files / images / file_chunks |
| `src/components/chat/composer.tsx` | 启用 Paperclip + Mic 按钮 |
| `src/server/tools/builtin/file_analyzer.ts` | 新增：解析 PDF / Word / Excel / 图片 |
| `src/server/tools/builtin/image_generator.ts` | 新增：DALL·E 3 / SD |
| `src/server/tools/builtin/audio_to_text.ts` | 新增：Whisper |
| `src/app/api/upload/route.ts` | 新增：文件上传端点 |
| `src/app/api/files/[id]/route.ts` | 新增：文件下载/查看 |
| `next.config.js` | 配 `serverActions.bodySizeLimit` |

### 6.4 关键技术决策

- **本地存储 vs OSS**：M4 阶段用本地 `public/uploads/` 目录，M5+ 接入 S3 / 阿里云 OSS
- **图片压缩**：sharp 库（Next.js 内置）
- **音频转码**：ffmpeg
- **OCR**：先用 Tesseract.js（轻量），后期换 PaddleOCR

## 7. 文件总览（M3 完成态）

```
ai-agent/
├── drizzle/                        # M3 新增
│   ├── 0000_bizarre_master_mold.sql
│   └── 0001_polite_lenny_balinger.sql
├── docs/
│   ├── requirements/               # M1 ✅ M2 ✅ M3 ✅ M4+ ⏳
│   ├── learning/                   # 00 ✅ M1 ✅ M2 ✅ M3 ✅ M4+ ⏳
│   ├── handoff/                    # README / env / api / m2-supplement / m3-supplement
│   ├── progress.md                 # 含 M3 记录
│   └── issues.md                   # 含 M3 ISSUE-013/014/015/016/017/018
├── scripts/                        # M3 新增
│   └── db-push.sh
├── src/
│   ├── server/
│   │   ├── db/                     # M3 新增：drizzle + postgres-js
│   │   ├── agent/                  # M3 新增：dispatcher + persistence
│   │   ├── tools/                  # M2
│   │   └── providers/              # M3 升级：plan + reflection
│   ├── components/
│   │   ├── chat/                   # M2/M3
│   │   ├── layout/                 # M1
│   │   ├── agent/                  # M3 新增：plan-todo.tsx
│   │   └── ui/
│   ├── features/chat/              # M3 升级
│   ├── hooks/                      # M2/M3
│   ├── lib/                        # types（PlanItem / reflections 扩展）
│   └── stores/                     # session / settings
└── tests/                          # vitest
```

## 8. 上下文快照

| 项 | 值 |
|----|----|
| 当前里程碑 | M3（ReAct + DB）✅ |
| 已完成 | M1 / M2 / M3 |
| 进行中 | 无 |
| 下一步 | M4 多模态（文件 / 图片 / 语音） |
| 数据库 | postgresql://tizen:root@localhost:5432/postgres（已连通） |
| 关键技术 | Next.js 14.2 / React 18 / TypeScript 5.6 / Tailwind 3.4 / Zustand 4.5 / OpenAI 4.73 / Drizzle ORM / postgres-js / Vitest 2.1 / zod 3.23 |
| 已建表 | agents / sessions / messages / tool_calls / agent_runs / agent_steps / tools |
| 待建表 | files / images / file_chunks / memories（M10） |
