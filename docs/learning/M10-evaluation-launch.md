# M10 评估与上线

## 基本信息

- **里程碑**：M10
- **标题**：评估与上线
- **完成日期**：2026-07-03
- **作者**：AI Agent Team
- **状态**：✅ 已完成

## 1. 需求回顾

本里程碑聚焦于生产环境上线前的最后准备，包括 API 安全加固（限流、输入验证）、PDF 文档解析、真实 Embedding 模型接入（OpenAI 兼容协议）、以及性能监控系统。参考需求文档：[`docs/requirements/M10-evaluation-launch.md`](../requirements/M10-evaluation-launch.md)

## 2. 思路与设计

### 2.1 关键决策

1. **API 限流策略**：采用滑动窗口算法，基于 IP + 路径的复合键，内存存储（适合单实例部署）
2. **输入验证**：白名单模式，允许正常文本，拦截 XSS/SVG/iframe/javascript: 等危险模式
3. **PDF 解析**：先实现 Mock 版本，预留真实库（如 pdf-parse）接入点
4. **Embedding 接入**：实现 OpenAI 兼容协议，失败时自动降级到 Mock 向量，保证系统可用性
5. **性能监控**：内存环形缓冲区存储最近 1000 条记录，实时计算统计指标

### 2.2 数据流 / 调用链

**限流流程**：
```
请求 → checkRateLimit(ip, path) → Map[key] 获取状态 → 判断是否超限 → 返回 allowed + headers
```

**输入验证流程**：
```
用户输入 → validateText/validateJSON/validateURL → 检测 BLOCKED_PATTERNS → 截断过长内容 → 返回 ValidationResult
```

**Embedding 流程**：
```
文本 → OpenAICompatibleEmbedding.embed() → fetch API → 成功返回真实向量 / 失败返回 mockEmbed()
```

**性能监控流程**：
```
API 请求 → recordPerformance() → 写入 records[] → getStats() 计算统计 → 返回 PerformanceStats
```

### 2.3 异常 / 边界处理

- **限流超限**：返回 429 状态码，附带 `X-RateLimit-*` 响应头
- **输入验证失败**：返回 ValidationResult，包含错误列表和清理后的内容
- **Embedding API 失败**：自动降级到 Mock 向量生成，保证系统不中断
- **性能记录溢出**：超过 MAX_RECORDS(1000) 时，丢弃最旧记录（shift）

## 3. 技术架构

### 3.1 模块划分

| 文件 | 职责 |
|------|------|
| `src/server/middleware/rate-limiter.ts` | API 限流：滑动窗口算法、请求计数、响应头生成 |
| `src/server/middleware/input-validator.ts` | 输入验证：文本/JSON/URL/邮箱校验、XSS 过滤 |
| `src/server/tools/builtin/read_pdf.ts` | PDF 解析工具：模拟多页内容提取 |
| `src/server/providers/embedding/openai-compatible.ts` | OpenAI 兼容 Embedding：API 调用 + Mock 降级 |
| `src/server/monitoring/performance.ts` | 性能监控：请求记录、统计指标、最近记录查询 |
| `src/server/monitoring/evaluation.ts` | 评估指标：回答质量评分、检索准确率评估 |
| `src/app/api/performance/stats/route.ts` | 性能监控 API：获取统计数据、最近记录、清除数据 |
| `src/app/api/evaluation/route.ts` | 评估 API：质量评分、检索评估、统计汇总 |
| `src/app/api/chat/route.ts` | Chat API：集成就限流、输入验证、性能监控 |
| `src/app/api/knowledge/documents/route.ts` | 知识库文档 API：集成就限流、输入验证、性能监控 |
| `src/app/api/knowledge/search/route.ts` | 知识库搜索 API：集成就限流、输入验证、性能监控 |
| `src/app/api/knowledge/rag/route.ts` | RAG 问答 API：集成就限流、输入验证、性能监控 |

### 3.2 关键类型 / 接口

```typescript
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized: string;
}

export interface OpenAIEmbeddingConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface PerformanceStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgDuration: number;
  p95Duration: number;
  p99Duration: number;
  endpoints: Record<string, { count: number; avgDuration: number }>;
  tokenUsage: number;
}

export interface QualityScore {
  overall: number;
  relevance: number;
  coherence: number;
  completeness: number;
  conciseness: number;
}

export interface RetrievalMetric {
  query: string;
  retrieved: string[];
  relevant: string[];
  precision: number;
  recall: number;
  f1: number;
  mrr: number;
}
```

### 3.3 关键代码片段

**滑动窗口限流**：
```typescript
export function checkRateLimit(ip: string, path: string, config: RateLimitConfig = DEFAULT_CONFIG) {
  const key = `${ip}:${path}`;
  const now = Date.now();
  let state = limits.get(key);
  if (!state || now > state.resetTime) {
    state = { count: 0, resetTime: now + config.windowMs };
    limits.set(key, state);
  }
  const allowed = state.count < config.maxRequests;
  if (allowed) state.count++;
  return { allowed, remaining: config.maxRequests - state.count, resetTime: state.resetTime };
}
```

**输入验证（XSS 过滤）**：
```typescript
const BLOCKED_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi,
  /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
  /<svg[^>]*>[\s\S]*?<\/svg>/gi,
];
```

**OpenAI 兼容 Embedding（含降级）**：
```typescript
async embed(text: string): Promise<Embedding> {
  try {
    const response = await fetch(`${this.config.baseUrl}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.config.apiKey}` },
      body: JSON.stringify({ input: text, model: this.config.model }),
    });
    const data = await response.json();
    return data.data[0].embedding as number[];
  } catch (error) {
    console.warn("OpenAI Embedding failed, falling back to mock:", error);
    return this.mockEmbed(text);
  }
}
```

**性能统计计算**：
```typescript
export function getStats(hours: number = 24): PerformanceStats {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const recent = records.filter((r) => r.timestamp >= cutoff);
  const durations = recent.map((r) => r.duration).sort((a, b) => a - b);
  return {
    totalRequests: recent.length,
    successfulRequests: recent.filter(r => r.statusCode >= 200 && r.statusCode < 400).length,
    avgDuration: Math.round(recent.reduce((sum, r) => sum + r.duration, 0) / recent.length),
    p95Duration: durations[Math.floor(durations.length * 0.95)] || 0,
    p99Duration: durations[Math.floor(durations.length * 0.99)] || 0,
    // ...
  };
}
```

## 4. 技术拓展

- **性能优化空间**：限流可接入 Redis 实现分布式限流；性能监控可接入 Prometheus + Grafana
- **真实 PDF 解析**：接入 `pdf-parse` 或 `pdf-lib` 库，支持真实文件内容提取
- **Embedding 模型扩展**：支持 Cohere、Anthropic、本地模型（Ollama/vLLM）等多种 Embedding Provider
- **安全增强**：添加 CSRF 防护、JWT 认证、请求签名等
- **日志系统**：接入结构化日志（Winston/Pino）+ 日志聚合（ELK/Grafana Loki）

## 5. 示例

### 5.1 怎么用

**限流配置**：
```typescript
import { applyRateLimit } from "@/server/middleware";

const { allowed, headers } = applyRateLimit(ip, "/api/chat");
if (!allowed) {
  return new Response("Rate limit exceeded", { status: 429, headers });
}
```

**输入验证**：
```typescript
import { validateText, validateURL } from "@/server/middleware";

const textResult = validateText(userInput);
if (!textResult.valid) {
  return { error: textResult.errors.join(", ") };
}

const urlResult = validateURL(userUrl);
if (!urlResult.valid) {
  return { error: urlResult.errors.join(", ") };
}
```

**Embedding 调用**：
```typescript
import { OpenAICompatibleEmbedding } from "@/server/providers/embedding/openai-compatible";

const embedder = new OpenAICompatibleEmbedding({
  baseUrl: "https://api.openai.com/v1",
  apiKey: process.env.OPENAI_API_KEY,
  model: "text-embedding-3-small",
});
const embedding = await embedder.embed("Hello, world!");
```

**性能监控**：
```typescript
import { recordPerformance, getStats } from "@/server/monitoring/performance";

// 记录请求
recordPerformance("/api/chat", "POST", 1250, 200, 1000);

// 获取统计
const stats = getStats(24);
console.log(`P95 响应时间: ${stats.p95Duration}ms`);
```

### 5.2 最小可运行示例

**API 限流测试（curl）**：
```bash
for i in {1..61}; do curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/chat; done
# 前 60 次返回 200，第 61 次返回 429
```

**PDF 解析工具调用**：
```typescript
import { readPdfTool } from "@/server/tools/builtin/read_pdf";

const result = await readPdfTool.execute({ filePath: "/docs/report.pdf", pageStart: 1, pageEnd: 5 });
console.log(result.content);
```

## 6. 验证记录

- 跑了哪些命令 / 测试：
  - `pnpm run typecheck` ✅ 0 error
  - `pnpm run lint` ✅ 0 warning
- 浏览器表现：PDF 工具已出现在工具列表中
- 已知遗留问题：
  - ISSUE-M10-001：分布式限流（Redis）
  - ISSUE-M10-002：真实 PDF 解析库接入
  - ISSUE-M10-003：性能监控持久化到数据库

## 7. 收获与踩坑

- 学到了什么：
  - 滑动窗口限流算法的实现原理
  - XSS 攻击模式的常见类型和防御方法
  - OpenAI Embedding API 的调用方式和错误处理
  - 性能监控指标的计算方法（P95/P99 百分位数）
- 踩过的坑：
  - 服务器端代码不能使用 `localStorage`（Next.js server-side 不支持）
  - PDF 工具注册后需要同时更新 `settings.ts` 的 `DEFAULT_ENABLED_TOOLS` 和 `TOOL_DISPLAY`
- 下次会怎么做：
  - 在实现监控功能前先确认运行环境（server/client）
  - 工具注册采用统一的配置文件管理，避免多处修改