# 开发问题记录（Issues Log）

> 踩到的坑、临时方案、待重构项、阻塞与解决都写在这里。
> 既是自己复盘，也是交接给同事的"避坑指南"。

## 模板

每条问题用以下格式：

```markdown
### [YYYY-MM-DD] [ISSUE-001] 简短标题
- **现象**：
- **原因**：
- **解决**：
- **影响**：
- **后续**：是否需要更深层修复 / 重构
```

---

## 待办 / 未解决

> ⚠️ 以下 6 条待办已归档到 [`docs/backlog.md`](backlog.md)，统一管理优先级和排期。

### [2026-07-03] [ISSUE-016] M3 delta 事件未落库
- **现象**：每次流式 token 都 yield `{ kind: "delta" }`，但 dispatcher 跳过不落库。
- **原因**：delta 太多（一个 run 可能上千条），每条 INSERT 太慢。
- **影响**：UI 上能看到流式输出，但 DB 看不到完整 token 序列。
- **后续**：M9 阶段改为"聚合 delta 到一个 content 字段"，或加 `delta_acc` 增量更新。

### [2026-07-03] [ISSUE-017] 反思重试未生成新 run
- **现象**：反思评分低触发重试时，runId 复用，DB 看到的是单 run 多轮。
- **原因**：M3 设计如此 —— 反思是同一 run 内的迭代，不是新 run。
- **影响**：分析"哪个反思导致答案改变"需要在 agent_steps 表内 step_index 过滤。
- **后续**：M9 评估阶段可以扩展为"反思触发时新建 child run"。

### [2026-07-03] [ISSUE-018] sessions.title 不会自动更新
- **现象**：DB 里 sessions.title 仍为"新会话"，没同步前端 Zustand 的标题。
- **原因**：ChatContainer 只更新 Zustand，没回写 DB。
- **影响**：DB 里会话标题不友好。
- **后续**：M4 接入"会话同步"功能，把 Zustand 标题 + 消息同步到 DB。

### [2026-07-02] [ISSUE-008] tool_calls 字段被 Provider 重复 yield（M3 处理）
- **现象**：当 LLM 一次发起多个 tool_call（比如同时查两个网站），OpenAI Provider 在 `finish_reason === "tool_calls"` 时一次性 yield 多个 tool_call 事件。M2 阶段 dispatcher 是按顺序串行执行的。
- **原因**：M2 阶段 `maxToolRounds = 1`，并行执行价值不大。
- **影响**：M3 ReAct 阶段如果需要并行查多个数据源，会有性能损失。
- **后续**：M3 把 dispatcher 升级为 `Promise.all` 并行执行 + 错误隔离。

### [2026-07-03] [ISSUE-009] Mock Provider 关键字匹配易误触
- **现象**：输入"统计 100 个字"时，Mock Provider 的 word_count 规则会匹配，但 `extractArgs` 抓到的 text 可能不准确。
- **原因**：正则表达式是"贪婪"匹配，没做语义理解。
- **影响**：少数情况下 args 提取错误。
- **后续**：M3+ 接真实 LLM 后自然解决（LLM 语义理解 + tools 参数）。Mock 模式仅做演示。

### [2026-07-02] [ISSUE-002] Message.thoughts 是临时字段
- **现象**：`Message` 类型当前通过 `thoughts?: string[]` 收集 LLM 返回的 thought。
- **原因**：M1-M2 阶段还没接数据库，先用"野字段"把数据流跑通。
- **影响**：前端能拿到 thought 数据，但 ThoughtPanel 实际并未读它（仅占位）。
- **后续**：M3 ReAct 上线时，把 thought 数据落到 `agent_runs` / `agent_steps` 表，Message 不再带这个字段。
- **归档**：已归入 `backlog.md` — 需确认 M3 是否已解决

### [2026-07-02] [ISSUE-003] 重新生成按钮回调未接通
- **现象**：`MessageBubble` 上挂了 `onRegenerate` 回调，但 `MessageList` 没有把它传给最后一条气泡，`ChatContainer` 也没实现 regenerate 方法。
- **原因**：M1 阶段优先级让位给"先打通流式"，重新生成属于体验增强。
- **影响**：UI 上能看到"重新生成"按钮（hover 状态），但点了无反应。
- **后续**：M2 上线时一并接通，实现"找到最后一条 user 消息 → 删除末尾 AI → 重新 send"。

### [2026-07-02] [ISSUE-004] Composer 工具区按钮是占位
- **现象**：Composer 里的 Paperclip / Mic / Bot 三个图标 `disabled`，hover 显示"M2 / M4 上线"。
- **原因**：M1 范围不含这些。
- **影响**：无。
- **后续**：M2 启用 Bot（智能体切换）、M4 启用 Paperclip（文件上传）和 Mic（语音）。

### [2026-07-03] [ISSUE-003] 重新生成按钮回调未接通
- **现象**：`MessageBubble` 上挂了 `onRegenerate` 回调，但 `MessageList` 没有把它传给最后一条气泡，`ChatContainer` 也没实现 regenerate 方法。
- **原因**：M1 阶段优先级让位给"先打通流式"，重新生成属于体验增强。
- **影响**：UI 上能看到"重新生成"按钮（hover 状态），但点了无反应。
- **解决**（M2）：
  1. `session` store 新增 `removeLastAssistant` action
  2. `MessageList` 把 `onRegenerate` 透传给最后一条 AI 气泡
  3. `ChatContainer` 实现 `handleRegenerate`：删末尾 AI → 调 `runStream(history)` 重新 send
- **后续**：如需更细粒度（"重新生成整段对话"），M3 重新设计。

## 已解决

### [2026-07-03] [ISSUE-010] calculator 一元负号识别 bug
- **现象**：`"-5 + 3"` 单元测试失败，工具返回 "Result is NaN"。
- **原因**：toRPN 函数中 `else if (t in prec)` 分支在 `t === "-"` 之前匹配，导致一元负号分支不可达。
- **解决**：把 `t === "-"` 分支移到 `t in prec` 之前，并用 `lastIsOp` 标志位判断是否一元。
- **影响**：M2 calculator 工具单测 1/5 失败。
- **后续**：写词法分析器时优先用"状态机"而非"规则链"，规则链容易因短路匹配而漏分支。

### [2026-07-03] [ISSUE-011] code_runner 纯表达式无法 return
- **现象**：输入 "1+2*3"，code_runner 返回 `undefined` 而不是 7。
- **原因**：原实现 `function() { <code> }` 包装，最后一行表达式没有 return。
- **解决**：把最后一行作为 `return (lastLine)`，前面 head 仍当语句执行。
- **影响**：用户期望"运行 JS"应返回结果，实际是 undefined。
- **后续**：在工具文档中明确"最后一行表达式自动 return"。

### [2026-07-03] [ISSUE-015] agent_runs 外键约束违反
- **现象**：dispatcher 调用 `startRun` 时报 `foreign key constraint violation`。
- **原因**：agent_runs.sessionId 引用 sessions.id，客户端首次发请求时 DB 里没 session。
- **解决**：`ensureSession(sessionId)` 在 startRun 前 upsert 一条空 session。
- **后续**：M4 把"创会话"操作放到更上层（用户主动开新会话时建）。

### [2026-07-03] [ISSUE-014] sessionId 是 nanoid 而非 UUID
- **现象**：`[persistence] startRun failed: invalid input syntax for type uuid: "test-m3-plan"`。
- **原因**：前端 Zustand 用 `nanoid()` 生成 sessionId，但 DB 字段是 uuid。
- **解决**：schema 把 sessions.id / messages.id / messages.sessionId / agent_runs.sessionId 改 `varchar(64)`，兼容 nanoid。
- **影响**：M2 / M3 之前的设计假设 sessionId 是 UUID，临时调整。
- **后续**：M4 决定 sessionId 是 varchar 还是 UUID（建议保持 varchar，与前端统一）。

### [2026-07-03] [ISSUE-013] drizzle-kit 0.28.1 在 macOS 卡死
- **现象**：`pnpm db:push` 启动后等用户输入，进程挂起不退出。
- **原因**：drizzle-kit 0.28 启动 drizzle-studio 试图创建 `~/Library/Application Support/drizzle-studio` 目录，但权限/路径有问题。
- **解决**：写 `scripts/db-push.sh` 直接用 psql 跑 drizzle/*.sql。
- **影响**：新项目 onboard 时要查文档才知道。
- **后续**：升级 drizzle-kit 到 0.30+ 修复。

### [2026-07-03] [ISSUE-012] Next.js dev server 修改文件不热重载
- **现象**：改了 code_runner.ts 后 curl 仍返回旧结果。
- **原因**：Next.js 14 dev server 在某些情况下不会自动 HMR `node:vm` 这种 native 依赖。
- **解决**：手动 `Ctrl+C` 停掉 dev server，重新 `pnpm dev`。
- **影响**：调试效率低。
- **后续**：M3+ 用 Vitest 单测覆盖工具逻辑，e2e 验证时再启动 dev server。

### [2026-07-02] [ISSUE-001] 文档与代码不同步
- **现象**：用户最初要求"先完成需求再写代码"，但我在前几轮直接写了不少代码（package.json / 布局 / Provider 等）。
- **原因**：工作流尚未建立，缺少"需求模板 + 进度同步 + 学习文档"的强制约束。
- **解决**：
  1. 新建 `docs/` 目录与 `README.md`，定义"需求 → 代码 → 学习"三段式工作流
  2. 提供 `requirements/_template.md` 与 `learning/_template.md` 两份模板
  3. 新建 `progress.md` 实时记录
  4. 新建本 `issues.md` 留痕
  5. 为 M1 补一份需求文档
- **影响**：M1 已有的脚手架代码需要追加学习文档，但不算返工；后续 M2 起严格执行工作流。
- **后续**：每个功能完成后必须更新 `progress.md` 与 `issues.md`，避免再次出现不同步。

### [2026-07-02] [ISSUE-005] Button 组件自我导入
- **现象**：`pnpm typecheck` 报"Individual declarations in merged declaration 'Button' must be all exported or all local"。
- **原因**：`src/components/ui/button.tsx` 顶部写了 `import { Button } from "@/components/ui/button";`，即从自己导入自己。
- **解决**：删除这行自我导入。
- **影响**：编译失败。
- **后续**：自检模板代码时注意 import 来源。

### [2026-07-02] [ISSUE-006] import.meta.env 在 Next.js 不存在
- **现象**：`useChatStream` 里写了 `if (import.meta.env.DEV)`，TS 编译失败。
- **原因**：Next.js 用 webpack/Vite 不一样，`import.meta` 类型未启用。
- **解决**：改用 `process.env.NODE_ENV === "development"`。
- **影响**：无功能影响。
- **后续**：在 Next.js 项目里统一用 `process.env.NODE_ENV` 判断开发模式。

### [2026-07-02] [ISSUE-007] useEffect 依赖告警
- **现象**：`useEffect` 依赖里直接写 `messages[messages.length - 1]?.content`，ESLint 反复警告。
- **原因**：依赖项是计算结果，React Hook lint 规则要求必须是简单引用。
- **解决**：先在组件顶层把 `messagesLength` 和 `lastContent` 缓存成变量，再把它们作为依赖。
- **影响**：无功能影响。
- **后续**：写 useEffect 时养成"先把依赖抽到顶层"的习惯。
