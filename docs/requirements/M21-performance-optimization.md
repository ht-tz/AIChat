# M21: 性能优化

> 需求文档，动手写代码前先填齐。

## 基本信息

- **里程碑**：M21
- **标题**：性能优化
- **负责人**：
- **创建日期**：2026-07-05
- **状态**：✅ 已完成

---

## 1. 背景与目标

M20 完成后项目功能完整，但存在冗余依赖、构建体积过大、渲染性能不足等问题。本里程碑从构建、渲染、状态、流式、数据库五个维度进行全面优化。

## 2. 用户故事

- 作为用户，我希望页面加载更快（首屏 < 2s）
- 作为用户，我希望长对话时不卡顿
- 作为开发者，我希望构建产物更小、依赖更干净

## 3. 功能范围

### 3.1 包含（In Scope）

**构建优化**：
- 冗余依赖清理（移除 reactflow/framer-motion/ioredis/bullmq 等 6 个未使用包）
- Next.js standalone 输出模式
- 动态 import（mermaid 按需加载）
- optimizePackageImports 配置

**渲染性能**：
- MessageList 虚拟化（react-window）
- MessageBubble React.memo 优化
- useMemo/useCallback 关键路径缓存

**状态管理**：
- Zustand 选择器优化（避免不必要的重渲染）
- localStorage 序列化优化

**流式传输**：
- SSE 解码优化（TextDecoder 流式解码）
- 流式消息增量更新

**数据库**：
- 查询索引优化
- 连接池配置

### 3.2 不包含（Out of Scope）

- Redis 缓存（M10 待优化项）
- CDN 静态资源加速
- SSR/ISR 页面级优化

## 4. 验收标准

- [x] pnpm typecheck 0 error
- [x] pnpm build 成功，standalone 输出
- [x] 冗余依赖已清理（6 个包）
- [x] mermaid 按需加载（不影响首屏）
- [x] MessageList 使用虚拟化

## 5. 技术约束

- 依赖：react-window（虚拟化）、@next/bundle-analyzer（分析）
- 影响：package.json、next.config.mjs、src/components/chat/message-list.tsx

## 6. 拆分与排期

| # | 子任务 | 状态 |
|---|--------|------|
| 1 | 冗余依赖清理 | ✅ |
| 2 | Next.js standalone + 动态 import | ✅ |
| 3 | MessageList 虚拟化 | ✅ |
| 4 | React.memo + useMemo 优化 | ✅ |
| 5 | Zustand 选择器优化 | ✅ |
| 6 | DB 索引优化 | ✅ |

## 7. 关联文档

- 学习文档：`docs/learning/M21-performance-optimization.md`
