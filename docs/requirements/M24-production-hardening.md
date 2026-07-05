# M24 — 生产加固（安全审计 + 可靠性 + 持久化）

## 背景与目标

基于生产级审计（`production-audit.md`）发现的 37 项问题，按优先级分四阶段修复。目标：将项目从"可运行"提升到"可上线"。

## 需求概述

| 阶段 | 范围 | 完成情况 |
|------|------|----------|
| 阶段一 | 安全加固（P0 Critical） | ✅ 6/6 |
| 阶段二 | 可靠性 + 运维（P1 High） | ✅ 5/6（测试覆盖率待补） |
| 阶段三 | 持久化 + 性能（P2 Medium） | ✅ 5/5 |
| 阶段四 | 质量提升（P3） | ⚠️ 4/7（Sentry/沙箱/测试待补） |

---

## 阶段一：安全加固（P0 Critical）

### 1.1 启动环境变量强制校验
- **文件**：`src/lib/env-validation.ts`
- **逻辑**：应用启动时校验 JWT_SECRET、ENCRYPTION_KEY、DATABASE_URL 等关键变量
- **要求**：生产环境缺失关键变量直接抛异常退出；开发环境仅警告

### 1.2 JWT Secret 硬编码回退移除
- **文件**：`src/server/auth/auth-service.ts`
- **改动**：移除 `'fallback-jwt-secret-for-dev'` 硬编码回退值
- **要求**：生产环境 `JWT_SECRET` 未配置时必须抛出明确错误

### 1.3 加密密钥硬编码回退移除
- **文件**：`src/server/crypto.ts`
- **改动**：移除 `'0123456789abcdef0123456789abcdef'` 硬编码回退值
- **要求**：生产环境 `ENCRYPTION_KEY` 未配置时必须抛出明确错误

### 1.4 API 路由认证全覆盖
- **影响范围**：`/api/memories`、`/api/experiences`、`/api/evaluation`、`/api/knowledge` 等 18 个路由
- **改动**：所有写操作（POST/PUT/DELETE）从 `optionalAuth` 改为 `requireAuth`
- **要求**：写操作必须认证；读操作可以保持可选认证

### 1.5 PUT/DELETE 请求 Zod 校验
- **影响范围**：所有支持 PUT/DELETE 的 API 路由
- **改动**：添加 `.strict()` 模式 Zod Schema，拒绝未知字段
- **要求**：未知字段返回 400 错误，防止注入攻击

### 1.6 邮箱验证页 XSS 修复
- **文件**：`src/app/api/auth/verify-email/route.ts`
- **改动**：HTML 响应中的用户输入使用 `escapeHtml()` 转义
- **要求**：所有动态内容必须转义后输出

---

## 阶段二：可靠性 + 运维（P1 High）

### 2.1 Mermaid XSS 修复
- **文件**：`src/components/ui/mermaid-diagram.tsx`
- **改动**：Mermaid 渲染配置 `securityLevel: 'strict'`

### 2.2 全局错误处理页面
- **文件**：`src/app/error.tsx`、`src/app/not-found.tsx`、`src/app/loading.tsx`
- **要求**：Next.js App Router 标准错误边界

### 2.3 健康检查端点
- **文件**：`src/app/api/health/route.ts`
- **返回**：`{ status: "ok", uptime, timestamp, version, database: "connected" }`
- **要求**：含数据库连接检查

### 2.4 部署配置优化
- `.dockerignore`：排除 node_modules/.next/.git/tests/docs
- `fly.toml`：memory_mb=1024、健康检查路径、优雅关闭
- `Dockerfile`：EXPOSE 8000、ENV PORT=8000

### 2.5 全局限流中间件
- **文件**：`src/server/middleware/rate-limiter.ts`
- **改动**：使用 Redis 适配层替代内存 Map
- **要求**：全局限流 60 次/分钟，可按路由配置

---

## 阶段三：持久化 + 性能（P2 Medium）

### 3.1 结构化日志（pino）
- **文件**：`src/server/logger.ts`（新建）
- **特性**：
  - pino 日志库，dev/production 自适应
  - 敏感字段自动脱敏（authorization/cookie/password/token）
  - `createContextLogger()` 子日志器工厂
  - `logRequest()` HTTP 请求日志辅助
- **范围**：13 个 server 文件 `console.*` 全部替换为 logger

### 3.2 性能监控 DB 持久化
- **文件**：`src/server/monitoring/performance.ts`、`src/server/db/schema.ts`
- **特性**：
  - 新增 `performance_records` 表
  - 内存缓冲 + 50 条自动刷写到 DB
  - 保留内存作为快速路径

### 3.3 Redis 适配层
- **文件**：`src/server/redis/adapter.ts`（新建）
- **特性**：
  - `CacheAdapter` 接口（get/set/incr/del/expire/ttl）
  - `MemoryCacheAdapter`：开发/降级用，带 TTL
  - `RedisCacheAdapter`：ioredis 实现，带重连策略
  - `getCache()` 单例工厂：有 `REDIS_URL` 用 Redis，否则降级内存

### 3.4 密码强度校验 + 登录限流
- 密码最小 8 位，需包含大小写字母和数字
- 登录接口 10 次/分钟限流
- 连续 5 次失败锁定账户 15 分钟

### 3.5 CSRF 保护
- **文件**：`src/server/middleware/csrf.ts`（新建）
- **模式**：双提交 Cookie（Double Submit Cookie）
- **要求**：POST/PUT/DELETE 请求自动校验

---

## 阶段四：质量提升（P3，持续改进）

### 4.1 登录失败锁定
- 内存 Map 记录失败次数，5 次锁定 15 分钟

### 4.2 SSRF 防护
- URL 白名单校验，禁止内网地址

### 4.3 类型安全
- OpenAI Provider 8 处 `as any` 修正为正确类型

### 4.4 账户锁定 Map 清理
- 定期清理 + 上限 100 条，防止内存泄漏

### 待完成（后续里程碑）
- Sentry APM 集成
- isolated-vm 代码沙箱
- 测试覆盖率 30%+
- 多智能体运行控制（暂停/停止）
- 记忆自动提取

---

## 提交记录

| 提交 | 内容 | 文件数 | 行数 |
|------|------|--------|------|
| `43d4e1a` | 生产加固 P0+P1 全部修复 | 31 | +1059/-203 |
| `2c4c770` | 阶段三：结构化日志 + 性能持久化 + Redis 适配层 | ~15 | ~+800 |

## 验证结果

- `pnpm typecheck` ✅ 0 error
- `pnpm test` ✅ 6 files / 34 tests passed
- 安全审计 ✅ P0 Critical 6/6 全部修复
- 可靠性 ✅ P1 High 关键项全部修复
