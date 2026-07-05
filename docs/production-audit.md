# 生产级差距审计报告

> 三遍全面审查结果汇总，按去重后优先级排列。
> 审计日期：2026-07-05 | 审计范围：全项目代码 + 20 份需求文档

---

## 统计总览

| 优先级 | 数量 | 说明 |
|--------|------|------|
| **P0 Critical** | 6 项 | 上线前必须修复，否则存在严重安全漏洞 |
| **P1 High** | 12 项 | 上线后一周内修复 |
| **P2 Medium** | 15 项 | 持续改进 |
| **P3 Low** | 4 项 | 锦上添花 |
| **合计** | **37 项** | |

---

## P0 Critical — 上线阻断（6 项）

### [SEC-01] JWT Secret 硬编码回退值
- **文件**: `src/server/auth/auth-service.ts:16`
- **代码**: `process.env.JWT_SECRET || "dev-secret-change-in-production"`
- **风险**: 攻击者可伪造任意用户 JWT Token
- **修复**: 启动时强制校验，缺失则 `process.exit(1)`

### [SEC-02] 加密密钥硬编码回退值
- **文件**: `src/server/crypto.ts:7-10`
- **代码**: `process.env.ENCRYPTION_KEY || "dev-encryption-key..."`
- **风险**: 攻击者可解密全部存储的 API Key
- **修复**: 启动时强制校验，缺失则 `process.exit(1)`

### [SEC-03] 大量 API 路由缺少认证保护
- **涉及**: 约 18 个路由（evaluation/performance/reasoning/memories/experiences/ab-test/playground/multi-agent/langchain 等）
- **风险**: 匿名用户可清空评估数据、消耗 LLM Token、查看所有记忆
- **修复**: 创建全局 `src/middleware.ts`，对 `/api/*` 强制认证（白名单除外）

### [SEC-04] optionalAuth 写操作不拒绝未认证用户
- **涉及**: chat/upload/memories/experiences/knowledge/evaluation 约 7 个路由
- **风险**: `optionalAuth` 仅解析身份不拒绝，POST/PUT/DELETE 对匿名开放
- **修复**: 写操作必须使用 `requireAuth`

### [SEC-05] PUT/DELETE 请求缺少 Zod 校验
- **文件**: `memories/route.ts:101,114`、`experiences/route.ts:56,69`、`knowledge/documents/route.ts:119,153`
- **代码**: `const { id, ...updates } = await req.json()` 无 schema 验证
- **风险**: 攻击者可注入任意字段篡改数据
- **修复**: 为所有写操作定义 Zod Schema + `.strict()`

### [SEC-06] XSS — 邮箱验证页面 HTML 注入
- **文件**: `src/app/api/auth/verify-email/route.ts:26,40`
- **代码**: `${result.error}` 直接嵌入 HTML 模板字符串
- **风险**: 恶意输入可执行 JavaScript
- **修复**: HTML 实体转义或改用 React SSR

---

## P1 High — 上线后一周内修复（12 项）

### [SEC-07] XSS — Mermaid securityLevel: "loose"
- **文件**: `src/components/ui/mermaid-diagram.tsx:25,74`
- **修复**: 改为 `securityLevel: "strict"`

### [SEC-08] 限流仅覆盖 4 个路由，login/register 无限流
- **修复**: 全局中间件统一限流

### [SEC-09] 限流/多智能体运行/OAuth state 用内存 Map
- **文件**: `rate-limiter.ts`、`run-store.ts`、`oauth-service.ts`
- **风险**: 重启清零，多实例不共享
- **修复**: 迁移到 Redis

### [PERF-01] 多个全局 Map 无界增长（内存泄漏）
- **涉及**: `memoryUsers`、`runStore`、`message-bus.messages`、`limits`、`memoryStates`
- **修复**: 添加 LRU 淘汰或 TTL 过期

### [REL-01] 无 React Error Boundary / error.tsx / not-found.tsx
- **风险**: 任何组件渲染错误导致整页白屏
- **修复**: 创建 `src/app/error.tsx` + `src/app/not-found.tsx` + 路由级 error.tsx

### [REL-02] 无 loading.tsx / Suspense 骨架屏
- **修复**: 为关键页面创建 loading.tsx

### [OBS-01] 无健康检查端点
- **修复**: 创建 `/api/health`，在 `fly.toml` 配置健康检查

### [OPS-01] 无启动时环境变量校验
- **修复**: 创建 `src/lib/env-validation.ts`，校验 DATABASE_URL/JWT_SECRET/ENCRYPTION_KEY

### [OPS-02] .dockerignore 缺失
- **修复**: 创建 `.dockerignore`，排除 .git/node_modules/.env*/docs

### [OPS-03] fly.toml 配置不足
- **问题**: `min_machines_running=0`、512MB 内存、无 kill_timeout
- **修复**: 设置 `min_machines_running=1`、`memory_mb=1024`、`kill_timeout=30s`

### [CODE-01] 需求文档提到但未实现的功能
- 多智能体运行控制（暂停/停止/重跑）— M15
- 记忆自动提取（聊天结束后触发）— M7

### [TEST-01] 测试覆盖率 < 5%
- **有测试**: 7 个文件 / 34 个用例
- **无测试**: dispatcher/openai-provider/tools-registry/rate-limiter/workflow-engine/all 48 API routes/all components
- **修复**: 为核心模块补充单元测试

---

## P2 Medium — 持续改进（15 项）

### 安全
| ID | 描述 | 文件 |
|----|------|------|
| SEC-10 | 无 CSRF 保护 | 全局 |
| SEC-11 | vm 沙箱逃逸风险 | `code_runner.ts` |
| SEC-12 | 登录无账户锁定机制 | `login/route.ts` |
| SEC-13 | 密码强度仅 6 字符 | `register/route.ts:12` |
| SEC-14 | Model Config 测试接口 SSRF | `model-configs/test/route.ts` |

### 性能
| ID | 描述 | 文件 |
|----|------|------|
| PERF-02 | listUsers 无 LIMIT | `auth-service.ts:669` |
| PERF-03 | listApiKeys 无 LIMIT | `auth-service.ts:540` |
| PERF-04 | validateApiKey N+1 查询 | `auth-service.ts:570-596` |
| PERF-05 | activateModel 非原子操作 | `model-config-service.ts:262-270` |

### 可靠性
| ID | 描述 | 文件 |
|----|------|------|
| REL-03 | OAuth fetch 无超时 | `oauth-service.ts:133,163,176,201` |
| REL-04 | LLM 请求无默认超时 | `openai.ts` |

### 可观测性
| ID | 描述 | 文件 |
|----|------|------|
| OBS-02 | 日志仅 console.log，无结构化 | 全局 35 处 |
| OBS-03 | 性能监控仅内存存储 | `performance.ts:26` |

### 代码质量
| ID | 描述 | 文件 |
|----|------|------|
| CODE-02 | OpenAI Provider 8 处 `as any` | `openai.ts` |
| CODE-03 | 多智能体状态未持久化（store 无 persist） | `stores/ma.ts` |

---

## P3 Low — 锦上添花（4 项）

| ID | 描述 |
|----|------|
| CODE-04 | `getClientIp()` 4 处重复定义 |
| CODE-05 | 依赖图可视化未实现（M8） |
| CODE-06 | 记忆知识图谱未实现（M7） |
| CODE-07 | Prompt 模板版本管理未实现（M6） |

---

## 修复优先级路线图

### 第一阶段：安全加固（P0，预计 2 天）
```
1. env-validation.ts — 启动强制校验 JWT_SECRET + ENCRYPTION_KEY
2. src/middleware.ts — 全局认证中间件
3. 所有写操作改为 requireAuth
4. PUT/DELETE 添加 Zod Schema
5. verify-email XSS 修复
6. Mermaid securityLevel 改 strict
```

### 第二阶段：可靠性 + 运维（P1，预计 3 天）
```
7. error.tsx + not-found.tsx + loading.tsx
8. /api/health 健康检查
9. fly.toml 优化
10. .dockerignore
11. 全局限流中间件
12. 核心模块单元测试
```

### 第三阶段：持久化 + 性能（P2，预计 5 天）
```
13. 内存 Map → Redis（限流/OAuth state/运行历史）
14. 性能监控 → DB 持久化
15. 结构化日志（pino）
16. 外部调用统一超时
17. 数据库查询优化（分页/事务）
```

### 第四阶段：质量提升（P2-P3，持续）
```
18. CSRF 保护
19. 登录限流 + 账户锁定
20. 代码沙箱加固
21. 类型安全（消除 any）
22. 测试覆盖率提升到 30%+
23. APM 集成（Sentry）
```

---

## 关联文档

- 需求文档：`docs/requirements/` (22 份)
- 待办池：`docs/backlog.md` (30 项)
- 进度记录：`docs/progress.md`
- 问题追踪：`docs/issues.md`
