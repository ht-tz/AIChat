# API 接口文档

> 完整的类型定义在 [技术架构 §4](../../.trae/documents/technical-architecture.md#4-api-定义)，本文件是当前已实现接口的索引。

## 当前已实现

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/chat` | 流式对话（SSE），支持工具调用（M2）+ Plan / Reflexion / HITL（待 M3 / M7 启用） |
| `GET` | `/api/chat` | 返回工具清单（前端拉取） |

## 计划中

| 方法 | 路径 | 说明 | 里程碑 |
|------|------|------|--------|
| `POST` | `/api/agent` | 显式触发 ReAct / Plan-and-Execute | M3 / M7 |
| `POST` | `/api/multi` | 多智能体协作 | M8 |
| `GET/POST` | `/api/prompts` | 提示词工程 | M6 |
| `POST` | `/api/eval/*` | 评估 | M9 |
| `GET` | `/api/observability/*` | 链路追踪 | M9 |
| `POST` | `/api/files` | 文件上传 | M4 |
| `POST` | `/api/files/[id]/query` | RAG 问答 | M4 |
| `POST` | `/api/image` | 文生图 | M4 |
| `POST` | `/api/webgen` | 网页生成 | M4 |
| `POST` | `/api/voice` | 语音 | M4 |
| `POST` | `/api/report` | 报告下载 | M5 |
| `POST` | `/api/cron` | 定时任务 | M7+ |
| `POST` | `/api/webhook` | 外部触发 | M7+ |
| `POST` | `/api/safety/check` | 注入检测 / PII 脱敏 | M7+ |

## POST /api/chat 详细定义

### Request（M2）

```ts
type ChatRequest = {
  sessionId?: string;
  agentId?: string;
  messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string; name?: string; toolCallId?: string }>;
  stream?: boolean;             // 默认 true
  enablePlan?: boolean;         // M3 / M7
  enableReflection?: boolean;   // M7
  requireHITL?: string[];       // M7
  model?: string;
  temperature?: number;
  enabledTools?: string[];      // M2 客户端控制启用的工具
  maxToolRounds?: number;       // M2 默认 1，M3 默认 5
};
```

### M2 工具调用示例

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{ "role": "user", "content": "123 * 456" }],
    "enabledTools": ["calculator"],
    "maxToolRounds": 1
  }'
```

返回 SSE 事件流：

```
data: {"kind":"thought","content":"用户的需求看起来需要调用 `calculator` 工具。"}

data: {"kind":"tool_call","name":"calculator","args":{"expression":"123 * 456"}}

data: {"kind":"tool_result","name":"calculator","result":{"expression":"123 * 456","value":56088,"formatted":"56088"}}

data: {"kind":"delta","content":"计"}
... (更多 delta)

data: {"kind":"done","usage":{...},"runId":"mock-..."}
```

### Response（`text/event-stream`）

每行一条 `data: {...}\n\n`，事件类型见 `AgentStep`：

| 事件 | 含义 |
|------|------|
| `plan` | Plan-and-Execute 的 todo 列表 |
| `thought` | Agent 思考片段 |
| `tool_call` | 工具调用 |
| `tool_result` | 工具结果 |
| `reflection` | 自评 |
| `delta` | 流式文本片段 |
| `hitl_request` | 请求人工确认 |
| `done` | 结束 + token 用量 + runId |
| `error` | 错误 |
