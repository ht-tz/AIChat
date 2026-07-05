# M24 — 生产加固：学习文档

## 概述

本里程碑聚焦于将项目从"可运行"提升到"可上线"。通过安全审计发现 37 项问题，分四阶段系统修复。

---

## 1. 环境变量强制校验

### 核心思路

生产环境最常见的安全事故之一是"忘记配置密钥导致使用默认值"。解决方案是**启动时校验**，而非运行时才发现。

### 技术实现

```typescript
// src/lib/env-validation.ts
export function validateEnv() {
  const errors: string[] = [];

  if (process.env.NODE_ENV === "production") {
    if (!process.env.JWT_SECRET) errors.push("JWT_SECRET is required");
    if (!process.env.ENCRYPTION_KEY) errors.push("ENCRYPTION_KEY is required");
  }

  if (errors.length > 0) {
    logger.error({ errors }, "Environment validation failed");
    throw new Error(`Missing required env vars: ${errors.join(", ")}`);
  }
}
```

### 关键学习点
- **Fail Fast**：启动时就失败，而不是运行到某个功能才报错
- **开发/生产分离**：开发环境允许警告，生产环境必须阻断
- **敏感值不能有回退**：`JWT_SECRET = 'fallback'` 等于没有密钥

---

## 2. 结构化日志（pino）

### 为什么不用 console.log

| 特性 | console.log | pino |
|------|-------------|------|
| 日志级别 | ❌ 无 | ✅ debug/info/warn/error/fatal |
| 结构化数据 | ❌ 字符串拼接 | ✅ JSON 对象 |
| 性能 | 一般 | ✅ 最快的 Node.js 日志库 |
| 敏感脱敏 | ❌ 手动处理 | ✅ 内置 redact |
| 生产格式 | ❌ 人类可读 | ✅ JSON（便于 ELK/Loki） |

### 核心实现

```typescript
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  redact: {
    paths: ["req.headers.authorization", "*.password", "*.token"],
    remove: true,  // 直接移除字段，而非替换为 [REDACTED]
  },
});
```

### 敏感字段脱敏
pino 的 `redact` 功能在序列化时就移除敏感字段，不会出现在任何输出中。比手动 `delete` 或 `replace` 更安全。

---

## 3. Redis 适配层

### 设计模式：策略模式 + 工厂模式

```typescript
// 接口定义
interface CacheAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  incr(key: string): Promise<number>;
}

// 工厂选择
function getCache(): CacheAdapter {
  if (process.env.REDIS_URL) return new RedisCacheAdapter(url);
  return new MemoryCacheAdapter();  // 开发/降级
}
```

### 关键学习点
- **接口抽象**：业务代码只依赖 `CacheAdapter` 接口，不关心底层是 Redis 还是内存
- **优雅降级**：没有 Redis 也能运行，只是不支持分布式
- **动态导入**：`await import("ioredis")` 避免未安装时启动报错

---

## 4. 性能监控 DB 持久化

### 双层架构

```
请求 → 内存缓冲（快速路径）
         ↓ 满 50 条
       批量写入 DB（持久化路径）
```

### 为什么用缓冲而非每次写 DB
- 每次 INSERT 的网络往返 ~1ms，1000 请求 = 1 秒额外延迟
- 批量 INSERT 一次搞定，吞吐量提升 50 倍
- 内存缓冲是快速路径，DB 是最终一致性

---

## 5. CSRF 双提交 Cookie 模式

### 原理

1. 服务端设置 Cookie：`csrf_token=<random>`
2. 前端 JS 读取 Cookie，放入请求头：`X-CSRF-Token: <random>`
3. 服务端校验：Cookie 中的值 === 请求头中的值

### 为什么安全
- 攻击者可以发起跨站请求，但**无法读取**目标站点的 Cookie
- 因此无法在请求头中放入正确的 CSRF Token

---

## 6. 全局错误边界（Next.js App Router）

### error.tsx vs not-found.tsx vs loading.tsx

| 文件 | 触发条件 | 作用 |
|------|----------|------|
| `error.tsx` | 运行时错误 | 捕获未处理异常，显示友好页面 |
| `not-found.tsx` | 404 | 不存在的路由 |
| `loading.tsx` | Suspense 加载中 | 骨架屏/加载动画 |

### `'use client'` 要求
`error.tsx` 必须是客户端组件（需要错误恢复交互），`loading.tsx` 和 `not-found.tsx` 可以是服务端组件。

---

## 7. Fly.io 部署配置

### fly.toml 关键配置

```toml
[http_service]
  memory_mb = 1024          # 1GB 内存（Next.js 需要）

  [http_service.checks]
    [http_service.checks.health]
      interval = "10s"       # 每 10 秒检查一次
      timeout = "5s"         # 5 秒超时
      path = "/api/health"   # 健康检查端点

[[services]]
  [services.concurrency]
    hard_limit = 50          # 硬限制
    soft_limit = 30          # 软限制（触发优雅关闭）
```

### .dockerignore
```
node_modules
.next
.git
*.md
tests
```
减小 Docker 镜像体积 50%+。

---

## 关键收获

1. **安全不是事后补的**：环境变量校验、认证覆盖、输入校验必须从第一天做起
2. **日志是可观测性的基础**：结构化日志 + 脱敏是生产环境标配
3. **适配器模式的价值**：Redis 适配层让开发环境零依赖，生产环境高性能
4. **缓冲是性能优化的万金油**：批量写入、减少网络往返
5. **错误边界是用户体验的底线**：白屏 vs 友好错误页，差距巨大
