# M2 · 工具调用 · 需求文档

> 本文档先于代码产出。

## 基本信息

- **里程碑**：M2
- **标题**：工具调用（Function Calling）
- **创建日期**：2026-07-02
- **状态**：🚧 进行中

## 1. 背景与目标

M1 我们跑通了"AI 流式说话"，但 LLM 还**没有手和脚**。M2 目标：让 AI 能调用本地工具（计算器、查时间、跑 JS、统计字数等），并把"调用过程"在 UI 上**可视化**。

这是 M3 ReAct 推理、M8 多智能体协作的**前置依赖**——没有工具调用就谈不上推理循环。

**完成 M2 的标志**：用户输入"123 × 456 等于多少"，能看到 AI 调 `calculator` 工具，工具返回结果，AI 再流式输出"56,088"。

## 2. 用户故事

1. 作为用户，我输入涉及计算的问题，AI 能自动调用 `calculator` 工具拿到准确结果。
2. 作为用户，我能看到 AI 调了哪个工具、参数是什么、结果是什么（透明可观察）。
3. 作为用户，我能在 Composer 选择"启用工具"或"不启用工具"模式。
4. 作为学习者，我能在源码里找到"工具怎么注册 / 怎么执行"的清晰路径。
5. 作为用户，我可以安全地让 AI 执行 JS 代码片段（沙箱隔离）。
6. 作为用户，重新生成按钮（M1 遗留）能正常工作。

## 3. 功能范围

### 3.1 包含（In Scope）

#### 工具注册中心
- `src/server/tools/registry.ts` —— 工具的注册 / 列表 / 执行入口
- zod schema 校验参数（避免恶意输入）
- 工具执行带超时（默认 5s）

#### 5 个内置工具
1. `calculator` —— 数学表达式求值（基于 `mathjs` 风格手写，支持 `+ - * / ^ ( )` 和常用函数 `sqrt sin cos log`）
2. `get_current_time` —— 返回当前时间（带时区参数）
3. `web_search` —— Mock 搜索（返回预设的 3 条结果，关键词命中）
4. `code_runner` —— Node 沙箱执行 JS 片段（`vm` 模块，限制 5s）
5. `word_count` —— 文本字数 / 行数 / 字符数统计

#### 服务端
- `/api/chat` 支持 `tools` 字段
- Provider 接口支持 `tools` 参数
- **工具调用调度器**（核心）：解析 LLM 的 `tool_call` 事件 → 执行工具 → yield `tool_result` → 再次调用 LLM（带 tool 结果） → 流式输出最终答案
- 工具调用过程完整落库（暂用 console + 未来 `agent_steps` 表）

#### 前端
- 新增 `ToolCallCard` 组件，展示在 AI 气泡内
  - 工具名称、参数、结果、耗时、状态（pending / success / error）
  - 可折叠参数和结果
- `ChatContainer` 处理 `tool_call` / `tool_result` 事件，把数据存到 message 上
- Composer 中 **Bot 按钮启用**（修复 ISSUE-004），点击弹出工具选择器
- 修复 ISSUE-003：**重新生成**按钮接通

### 3.2 不包含（Out of Scope）

- ReAct 循环（多步推理） → M3
- 自定义工具上传 / MCP 协议 → M3+ / M7+
- 工具权限审批（HITL） → M7
- 工具调用统计与计费 → M9
- 真实 web_search（接 Tavily / SerpAPI） → 后续

## 4. 验收标准

- [ ] 输入"123 × 456" → AI 调用 `calculator` → 工具返回 56088 → AI 输出"123 × 456 = **56088**"
- [ ] 输入"现在几点了" → AI 调用 `get_current_time` → 输出当前时间
- [ ] 输入"搜索 NEXUS" → AI 调用 `web_search` → 返回 mock 搜索结果 → AI 总结
- [ ] 输入"运行 JS：1+2*3" → AI 调用 `code_runner` → 返回 `7`
- [ ] 输入"统计这段文字：xxx" → AI 调用 `word_count` → 返回字数
- [ ] ToolCallCard 在 AI 气泡内正确显示：工具名、参数、结果、耗时
- [ ] 工具失败时 ToolCallCard 显示 error 状态，AI 用自然语言解释错误
- [ ] Composer 中 Bot 按钮可点击，弹出工具开关列表
- [ ] 重新生成按钮能重新调用同一条 user 消息的 LLM（M1 遗留修复）
- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm build` 全部通过
- [ ] 至少 1 个工具调用相关单元测试

## 5. 交互 / UI 说明

### 5.1 ToolCallCard 形态

```
┌─────────────────────────────────────────────────────┐
│ 🔧 calculator  ✓  8ms                              │  ← 头部：图标 + 名称 + 状态徽章 + 耗时
├─────────────────────────────────────────────────────┤
│ 参数：{ "expression": "123 * 456" }                 │  ← 可折叠
│ 结果：56088                                         │
└─────────────────────────────────────────────────────┘
```

**状态颜色**：
- pending：青色脉冲
- success：酸橙绿
- error：红色

### 5.2 Composer Bot 按钮

点击 Bot 图标 → 弹出 Popover，列出可用工具与开关：

```
┌─────────────────────────────┐
│ 可用工具                     │
│ ─────────────               │
│ ✓ calculator  数学计算       │
│ ✓ get_current_time  时间     │
│ ✓ web_search  联网搜索       │
│ ✓ code_runner  JS 沙箱       │
│ ✓ word_count  字数统计       │
│ ─────────────               │
│ [全部启用] [全部禁用]        │
└─────────────────────────────┘
```

### 5.3 工具调用流程（端到端）

```
用户：123 × 456 等于多少
   ↓
LLM Provider（带 tools 参数）返回 tool_call
   ↓
服务端调度器：
   - 验证参数（zod）
   - 查表找到 calculator
   - 执行 calculator
   - 把结果回填给 LLM
   ↓
LLM 拿到 tool_result → 流式输出最终答案
   ↓
前端：显示 ToolCallCard + 最终文字回复
```

## 6. 技术约束

- **Provider 接口扩展**：`stream({ messages, tools })`，`tools` 可选
- **工具 schema**：`{ name, description, parameters: { type: "object", properties, required } }`，遵循 OpenAI Function Calling 规范
- **工具执行**：
  - 同步工具（calculator / word_count）走 async 包装
  - JS 沙箱用 `node:vm` 模块，`timeout: 5000`
  - 工具执行结果统一序列化为 JSON
- **前端状态**：`message.toolCalls` 字段存 `{ id, name, args, result, status, durationMs }`
- **事件协议**：复用 M1 的 `AgentStep`，新增 `tool_call` / `tool_result` 类型（已定义）

## 7. 风险与备选

| 风险 | 应对 |
|------|------|
| 工具执行阻塞主线程 | 工具统一 async；JS 沙箱用 vm.runInNewContext + setTimeout 守护 |
| LLM 输出非预期参数 | zod 严格校验，失败时 yield error 事件，AI 自动重试或解释 |
| Mock Provider 工具调用难以演示 | 关键字精准匹配（"123 × 456" → calculator；"现在" → time） |
| 工具调用循环无限 | M1 / M2 阶段单次工具调用，循环控制放到 M3 |
| JS 沙箱逃逸 | `node:vm` 在独立 context，无 `require` / `process`，仅暴露 `console` |

## 8. 拆分与排期

| 子任务 | 工时 | 文件 |
|--------|------|------|
| 工具注册中心 + zod 校验 | 0.3d | `src/server/tools/registry.ts` |
| 5 个内置工具实现 | 0.5d | `src/server/tools/builtin/*.ts` |
| Provider 接口扩展 tools | 0.3d | `src/server/providers/{index,mock,openai}.ts` |
| /api/chat 支持 tools + 调度器 | 0.5d | `src/app/api/chat/route.ts`, `src/server/agent/dispatcher.ts` |
| ToolCallCard 组件 | 0.3d | `src/components/chat/tool-call-card.tsx` |
| ChatContainer 接入 tool_call / tool_result | 0.2d | `src/features/chat/chat-container.tsx` |
| Composer Bot 按钮工具开关 | 0.3d | `src/components/chat/composer.tsx` + Popover |
| 修复重新生成按钮（ISSUE-003） | 0.2d | `src/features/chat/chat-container.tsx` |
| 单元测试（calculator） | 0.2d | `tests/tools/calculator.test.ts` |
| 启动验证 + 写学习文档 | 0.3d | `docs/learning/M2-tool-calling.md` |
| **合计** | **~3 天** | |

## 9. 自测计划

1. `pnpm dev`
2. 输入"123 × 456 等于多少" → 看到 ToolCallCard → 看到 56088
3. 输入"现在几点了" → 看到当前时间
4. 输入"搜索 NEXUS" → 看到 web_search mock 结果
5. 输入"运行 JS：console.log(1+2*3)" → 看到 7
6. 输入"统计这段：你好世界" → 看到 4 字
7. 故意输入"9999999 ÷ 0" → 工具报错 → AI 解释
8. 关闭"calculator"开关 → 问"1+1" → AI 回答错误或不调用工具
9. 点"重新生成" → 重新生成回复
10. 浏览器 Console 看到 tool_call / tool_result 事件
11. `pnpm test` → calculator 单元测试通过

## 10. 关联文档

- 对应学习文档：`docs/learning/M2-tool-calling.md`（完成后产出）
- 对应 PRD 章节：[§2.5 进阶 Agent 能力（Function Calling / HITL）](../../.trae/documents/prd.md#25-进阶-agent-能力新增)
- 对应技术架构章节：[§5.3 工具注册中心](../../.trae/documents/technical-architecture.md#53-工具注册中心含-mcp)
- 架构总览：[docs/learning/00-architecture.md](../learning/00-architecture.md)
- M1 学习文档：[docs/learning/M1-basic-chat.md](../learning/M1-basic-chat.md)
