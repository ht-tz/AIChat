# M2 工具调用 · 交接补充

> 本文档作为 [README.md](./README.md) 的 M2 阶段补充，记录 M2 完成后新增的模块、API、关键文件、踩坑点与下一阶段（M3）启动指南。
> 接手 M3 之前必须先读 [M2 学习文档](../learning/M2-tool-calling.md)。

## 1. M2 新增模块概览

### 1.1 工具层（src/server/tools/）

| 文件 | 职责 |
|------|------|
| `types.ts` | `Tool` / `ToolContext` / `ToolCallStatus` 类型 |
| `registry.ts` | `toolRegistry` 单例：注册 / 列出 / zod 校验 / 5s 超时执行 |
| `index.ts` | 入口：注册全部内置工具（幂等） |
| `builtin/calculator.ts` | 数学表达式（手写 Shunting-yard） |
| `builtin/get_current_time.ts` | 当前时间（IANA 时区） |
| `builtin/web_search.ts` | Mock 搜索（3 组预置数据） |
| `builtin/code_runner.ts` | Node vm 沙箱执行 JS（最后一行 return） |
| `builtin/word_count.ts` | 文本统计 |

### 1.2 调度层（src/server/agent/）

| 文件 | 职责 |
|------|------|
| `dispatcher.ts` | `runAgent` 单轮工具调用循环：透传 Provider step + 捕获 tool_call + 执行工具 + 回填结果 + 再调 Provider |

### 1.3 Provider 升级

- **Mock Provider** (`src/server/providers/mock.ts`)：关键字 → 工具映射（5 个工具）
- **OpenAI Provider** (`src/server/providers/openai.ts`)：累积 streaming tool_call → 一次性 yield

### 1.4 前端组件

| 文件 | 职责 |
|------|------|
| `src/components/chat/tool-call-card.tsx` | ToolCallCard：工具名 + 状态徽章 + 耗时 + 可折叠参数/结果 |
| `src/components/chat/composer.tsx` | Bot 按钮 + 工具选择 Popover（全部启用/全部禁用） |
| `src/components/chat/message-bubble.tsx` | 渲染 `message.toolCalls` |
| `src/components/chat/message-list.tsx` | 把 `onRegenerate` 透传给最后一条 AI 气泡 |
| `src/features/chat/chat-container.tsx` | 接入 tool_call/tool_result 事件 + 重新生成 |

### 1.5 Store 变更

- `src/stores/settings.ts` 新增 `enabledTools: string[]` + `toggleTool()` / `setEnabledTools()`
- `src/stores/session.ts` 新增 `removeLastAssistant(sessionId)` action

### 1.6 类型扩展

- `src/lib/types.ts` 新增 `ToolCallRecord` 接口（带 UI 状态）
- `Message.toolCalls` 改为 `ToolCallRecord[]`
- `Message.thoughts?: string[]`（M3 落库前的临时字段）

### 1.7 测试

- `tests/tools/calculator.test.ts` —— 5 个单元测试（四则 / 幂 / 函数 / 一元负号 / 异常）
- `vitest.config.ts` —— vitest 配置 + `@/` 路径别名

## 2. 新增 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/chat` | 返回 `toolRegistry.listMeta()`，前端可拉取工具列表 |
| `POST` | `/api/chat` | 新增 `enabledTools?: string[]` 与 `maxToolRounds?: number` 字段 |

详细字段定义：[M2 学习文档 § 2.3](../learning/M2-tool-calling.md#23-工具注册中心核心-api) 与 [api.md](./api.md)。

## 3. 启动 / 验证

```bash
# 安装依赖
pnpm install

# 启动 dev
pnpm dev

# 单测
pnpm test

# 烟囱测试（5 种工具）
for q in "123 * 456" "现在几点" "运行 JS：1+2*3" "统计：你好世界 hello" "搜索 NEXUS"; do
  echo "=== $q ==="
  curl -s -X POST http://localhost:3000/api/chat \
    -H "Content-Type: application/json" \
    -d "{\"messages\":[{\"role\":\"user\",\"content\":\"$q\"}]}" \
    --no-buffer | grep -E '"kind":"(tool_call|tool_result|delta)"'
done
```

## 4. M2 已修复的 ISSUE

- **ISSUE-003** 重新生成按钮接通（`session.removeLastAssistant` + `ChatContainer.handleRegenerate`）
- **ISSUE-004** Bot 按钮接通工具选择
- **ISSUE-010** calculator 一元负号 bug
- **ISSUE-011** code_runner 纯表达式无法 return
- **ISSUE-012** Next.js dev server 修改 `node:vm` 依赖不热重载

## 5. M2 已知未解决（ISSUE-002 / 008 / 009）

- **ISSUE-002** `Message.thoughts` 是临时字段 → M3 落 `agent_steps` 表后删除
- **ISSUE-008** tool_calls 串行执行 → M3 升级为 `Promise.all` 并行
- **ISSUE-009** Mock 关键字匹配易误触 → M3+ 接真实 LLM 自然解决

## 6. M3 启动指南（接力者必读）

### 6.1 M3 范围（ReAct 多步推理）

- **多轮工具调用**：`maxToolRounds` 默认 5
- **自反思（Reflexion）**：在每轮结束后 yield `reflection` 事件，LLM 决定是否需要重试
- **Plan-and-Execute**：LLM 先 yield `plan` 事件（todos），再逐步执行
- **TODO 数据结构**：`{ id, title, status: "pending" | "running" | "done" }`

### 6.2 改动点预告

| 文件 | 改动 |
|------|------|
| `src/server/agent/dispatcher.ts` | `runAgent` 升级为多轮 + 反思 |
| `src/server/providers/mock.ts` | 演示用：先 yield plan 再 yield tool_call |
| `src/components/chat/thought-panel.tsx` | 真实读 `message.thoughts` + 渲染 plan / reflection |
| `src/lib/types.ts` | `Message.thoughts` 移到 `agent_runs` / `agent_steps` 表（M3+ 接数据库） |
| 新增 `src/components/agent/plan-todo.tsx` | Plan 待办 UI |

### 6.3 数据库接入（用户已提供）

```bash
# 用户的 PostgreSQL
DATABASE_URL=postgresql://tizen:root@localhost:5432/postgres

# M4 阶段需要建表：sessions / messages / agents / tools / agent_runs / agent_steps / memories
# M3 阶段先把 schema 写出来（Drizzle ORM），但不一定立即用
```

## 7. 文件总览（M2 完成态）

```
ai-agent/
├── .trae/documents/        # PRD / 架构
├── docs/
│   ├── README.md           # 文档总览
│   ├── progress.md         # 实时进度
│   ├── issues.md           # 问题留痕
│   ├── requirements/       # 需求文档（M1✅ M2✅ M3+⏳）
│   ├── learning/           # 学习文档（00 ✅ M1✅ M2✅ M3+⏳）
│   └── handoff/            # 交接文档（README / env / api / m2-supplement）
├── src/
│   ├── app/
│   │   ├── api/chat/       # SSE 路由
│   │   ├── settings/       # 设置页
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── chat/           # composer / message-list / message-bubble / thought-panel / tool-call-card
│   │   ├── layout/         # sidebar / top-bar
│   │   └── ui/             # button
│   ├── features/chat/      # chat-container
│   ├── hooks/              # use-chat-stream
│   ├── lib/                # types / utils
│   ├── server/
│   │   ├── tools/          # 工具层（M2 新增）
│   │   ├── agent/          # 调度层（M2 新增）
│   │   └── providers/      # LLM Provider 抽象
│   └── stores/             # session / settings
└── tests/                  # vitest 单测（M2 新增）
```

## 8. 上下文快照

| 项 | 值 |
|----|----|
| 当前里程碑 | M2（工具调用）✅ |
| 已完成 | M1 / M2 |
| 进行中 | 无 |
| 下一步 | M3 ReAct 多步推理 |
| 用户期望 | 按里程碑推进，每完成一个写学习文档 |
| 数据库 | postgresql://tizen:root@localhost:5432/postgres（M4 接入） |
| 关键技术 | Next.js 14.2 / React 18 / TypeScript 5.6 / Tailwind 3.4 / Zustand 4.5 / OpenAI 4.73 / zod 3.23 / vitest 2.1 |
