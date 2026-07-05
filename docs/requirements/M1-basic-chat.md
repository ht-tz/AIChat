# M1 · 基础对话 · 需求文档

> 本文档先于代码产出。任何动手前的不一致都需要回到这里更新。

## 基本信息

- **里程碑**：M1
- **标题**：基础对话
- **创建日期**：2026-07-02
- **状态**：🚧 进行中

## 1. 背景与目标

NEXUS 的第一个里程碑目标，是**让一个能"打字机式聊起来"的 AI 对话页跑通**。

这是所有后续 Agent 能力（工具调用、ReAct、Plan、Reflexion、Multi-Agent…）的**最小底座**：

- 没有可用的对话流，后面的工具可视化、思考链折叠、报告下载都没法承载
- 把流式 SSE 跑通后，M2+ 只需要把"普通回复"换成"工具调用回复"即可
- 让学习者第一天就能在本地看到效果，激励继续深入

完成 M1 的标志：用户在首页输入一句话，**看到带霓虹光标的"打字机"回复**，并能复制、重新生成。

## 2. 用户故事

1. 作为新用户，我打开首页能直接看到聊天界面，无需注册也能体验。
2. 作为新用户，我输入一句话点击发送，能看到 AI 逐字流式输出。
3. 作为新用户，我能复制 AI 回复、新建会话、查看历史会话。
4. 作为新用户，我能切换 Mock / 真实 LLM（在 `/settings` 改完立即生效）。
5. 作为学习者，我能在浏览器看到每一次 SSE 事件类型，方便理解流式协议。

## 3. 功能范围

### 3.1 包含（In Scope）

- `/` 对话主页
  - 左侧会话列表（侧边栏）
  - 中部消息流
  - 底部输入区（多行、Enter 发送、Shift+Enter 换行、附件 / 语音 / 智能体按钮占位）
- 消息渲染
  - Markdown（标题 / 列表 / 代码块 / 表格 / 引用 / 链接）
  - 用户 / AI 气泡区分
  - AI 回复带打字机光标（流式中）
  - 复制按钮、重新生成按钮
- 会话管理
  - 本地 `localStorage` 持久化（开发期不连数据库）
  - 新建、重命名、删除会话
- 模型切换
  - 输入区顶部模型胶囊（Mock / GPT-4o / GPT-4o-mini / DeepSeek 等）
  - 默认走 Mock Provider
- `/settings` 设置页
  - Base URL / API Key / 默认模型
  - 主题切换（赛博深 / 赛博亮，预留）
- `/api/chat` SSE 接口
  - 支持取消（`AbortController`）
  - 事件类型：`delta` / `thought` / `done` / `error`（M1 阶段）

### 3.2 不包含（Out of Scope）

- 工具调用、ReAct 推理 → M2 / M3
- 思考过程可视化、Plan 编辑 → M3 / M7
- 数据库持久化（开发期先用 localStorage）→ M5
- 用户登录 / 注册 → M5+
- 生图 / 语音 / 文件 → M4
- 多智能体 / 提示词工程 / 评估 / 可观测 → M6-M10

## 4. 验收标准

- [ ] 打开 `/` 看到带赛博未来风格的对话页（暗色 + 霓虹）
- [ ] 输入一句话点击发送，能在 < 200ms 内看到首个字符
- [ ] 整段回复以打字机效果流式出现
- [ ] AI 气泡右上角有"复制"按钮，点击后浏览器提示复制成功
- [ ] AI 气泡右上角有"重新生成"按钮，点击后再次流式输出
- [ ] 左侧能新建会话、重命名、删除
- [ ] 切换 `/settings` 中的模型后，下次对话生效
- [ ] `LLM_PROVIDER=mock` 时无任何外部 API 调用
- [ ] 浏览器 Console 可见 SSE 事件日志（开发模式）
- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm build` 全部通过

## 5. 交互 / UI 说明

### 5.1 对话主页（`/`）

```
┌──────────────────────────────────────────────────────────────────┐
│  [≡] NEXUS · AI Agent                  [Mock ▾] [⚙] [👤]        │  顶栏
├──────────────┬───────────────────────────────────────────────────┤
│              │                                                   │
│  [ + 新会话 ] │   ┌─────────────────────────────────────────┐   │
│              │   │ 用户：写一个 LRU 缓存                  │   │
│  ▸ 学习 ReAct│   └─────────────────────────────────────────┘   │
│  ▸ 代码导师  │   ┌─────────────────────────────────────────┐   │
│  ▸ 研究员    │   │ AI：下面是一个 TypeScript 实现的 LRU  │   │
│  ▸ 通用助手  │   │ 缓存...                              ▍  │   │
│              │   └─────────────────────────────────────────┘   │
│  ─────────   │                                                   │
│  设置        │   ┌─────────────────────────────────────────┐   │
│              │   │ [📎] [🎙] [@Agent▾]              [发送]│   │  输入区
│              │   └─────────────────────────────────────────┘   │
└──────────────┴───────────────────────────────────────────────────┘
```

- 顶栏：左侧 logo + 标题，中间模型切换胶囊，右侧设置 / 用户图标
- 侧边栏：会话列表（可折叠），底部"设置"入口
- 消息流：自适应滚动到底部，用户右对齐 / AI 左对齐
- 输入区：圆角 16px，玻璃拟态，发送按钮在右下

### 5.2 状态

- **空闲**：输入区可输入，发送按钮亮起
- **生成中**：发送按钮变 loading；输入区禁用；AI 气泡显示打字机光标
- **生成完成**：恢复输入；气泡可复制 / 重生成
- **错误**：底部弹 Toast，提示重试

## 6. 技术约束

- 框架：Next.js 14.2 App Router + React 18 + TypeScript 5.6
- 样式：Tailwind 3.4 + 全局 CSS（已就位）
- 状态：Zustand（会话列表 / 当前会话 / 设置）
- 持久化：`localStorage`（开发期）
- LLM：抽象走 `src/server/providers/*`，默认 Mock
- API：`src/app/api/chat/route.ts`，使用 `ReadableStream` SSE
- Markdown：`react-markdown` + `remark-gfm` + `rehype-highlight`
- 图标：`lucide-react`

## 7. 风险与备选

| 风险 | 应对 |
|------|------|
| SSE 在某些代理下被缓冲 | 前端用 `fetch + ReadableStream` 而非 `EventSource`，更可控 |
| Mock 回答太死板影响体验 | Mock 内置 6+ 关键字匹配，覆盖问候 / LRU / React / Next.js / Plan 等常见场景 |
| 流式断网 | `AbortController` + 错误事件 + Toast |
| Tailwind 主题色在 SSR 下未生效 | `darkMode: "class"` + html 标签默认 `class="dark"` |
| Zustand SSR 序列化 | 用 `useEffect` 初始化 localStorage，避免 hydration mismatch |

## 8. 拆分与排期

| 子任务 | 工时 | 文件 |
|--------|------|------|
| SSE 接口 + Mock 串通 | 0.5d | `src/app/api/chat/route.ts` |
| Zustand 会话 Store + localStorage | 0.3d | `src/stores/session.ts` |
| 顶栏 + 侧边栏组件 | 0.5d | `src/components/layout/*` |
| 消息流组件 + Markdown 渲染 | 0.5d | `src/components/chat/message-list.tsx` |
| 输入区组件 | 0.3d | `src/components/chat/composer.tsx` |
| `/settings` 设置页 | 0.3d | `src/app/settings/page.tsx` |
| 自测 + 文档 | 0.3d | `docs/learning/M1-basic-chat.md` |
| **合计** | **~3 天** | |

## 9. 自测计划

1. `pnpm dev` 启动 → 打开 http://localhost:3000
2. 输 "你好" → 看到流式欢迎语
3. 输 "LRU 缓存" → 看到代码块 + 复杂度说明
4. 输 "你好 React" → 看到 Next.js App Router 对比
5. 输 "帮我规划" → 看到 plan 风格的回复
6. 输其他 → 看到 mock 默认回复
7. 点"复制" → 浏览器提示成功
8. 点"重新生成" → 重新流式输出
9. 新建会话 / 切回旧会话 → 历史保留
10. 浏览器 Console 看到 `data: {...}` 日志

## 10. 关联文档

- 对应学习文档：`docs/learning/M1-basic-chat.md`（完成后产出）
- 对应 PRD 章节：[§2.2 基础功能模块 / §2.2.1 对话主页](../../.trae/documents/prd.md)
- 对应技术架构章节：[§4.1 对话与 Agent](../../.trae/documents/technical-architecture.md#41-对话与-agent)
- 架构总览学习：[docs/learning/00-architecture.md](../learning/00-architecture.md)
