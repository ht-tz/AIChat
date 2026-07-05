# M22: 工程化能力补全 + Claude Code Harness

> 学习文档：记录工程化工具链和 Claude Code Harness 的设计思路、关键决策和实践经验。

## 一、需求思路

### 为什么需要工程化？

M1-M20 完成了全部业务功能，但开发流程缺少"护栏"：
- 没有代码格式化，不同人写的代码风格不一致
- 没有 pre-commit hooks，低级错误直接进入代码库
- 没有 CI，构建质量完全依赖本地环境
- 没有测试框架，重构时无法快速验证

### 为什么需要 Claude Code Harness？

Anthropic 官方提出的 Harness 架构核心观点：**不要让 AI 带着通用知识直接进入项目，给它一整套项目专属的"操作手册"**。

没有 Harness 时，Claude Code 每次都要重新理解项目：用 pnpm 还是 npm？主题色是什么？API 返回格式是什么？有了 Harness，这些规矩写在 CLAUDE.md 里，Claude 每次启动自动读取。

---

## 二、代码思路

### 2.1 工程化工具链选型

| 工具 | 选型 | 理由 |
|------|------|------|
| Lint | ESLint 8 + next/core-web-vitals | Next.js 官方推荐 |
| Format | Prettier 3 + tailwindcss 插件 | 自动排序 Tailwind 类名 |
| Git Hooks | Husky 9 + lint-staged 15 | 主流方案，轻量 |
| Test | Vitest 2 + V8 coverage | 比 Jest 快 10x，原生 ESM |
| CI | GitHub Actions | 免费，与 GitHub 深度集成 |
| Bundle 分析 | @next/bundle-analyzer | Next.js 官方方案 |
| 未用代码检测 | Knip | 比 ts-prune 更全面 |

### 2.2 Webpack Chunk 拆分策略

大型依赖独立为 chunk，命中缓存后不重复下载：

```
framework (react/react-dom)  ← 几乎不变，长期缓存
mermaid (~2MB)               ← 按需加载，不影响首屏
highlight.js                 ← 按需加载
markdown (react-markdown等)  ← 代码消息时才需要
vendors (其余 node_modules)  ← 通用依赖
```

### 2.3 Claude Code Harness 架构

```
CLAUDE.md                    ← 入职手册（每次会话自动读取）
.claude/
  settings.json              ← 安全红线（强制执行）
  commands/
    review.md                ← /review 代码审查
    test.md                  ← /test 测试编写
    feature.md               ← /feature 功能开发
    deploy.md                ← /deploy 部署检查
  agents/
    code-reviewer.md         ← 代码审查子智能体
    test-writer.md           ← 测试编写子智能体
```

---

## 三、技术架构

### 3.1 工程化工具链全景

```
开发者写代码
  ↓
pre-commit hook (Husky)
  ↓
lint-staged
  ├── ESLint --fix（自动修复 lint 问题）
  └── Prettier --write（自动格式化）
  ↓
git commit
  ↓
GitHub Actions CI
  ├── pnpm lint
  ├── pnpm typecheck
  ├── pnpm test
  └── pnpm build
  ↓
部署
```

### 3.2 Claude Code Harness 数据流

```
Claude Code 启动
  ↓
读取 CLAUDE.md（项目规范）
  ↓
读取 .claude/settings.json（权限红线）
  ↓
开发者输入 /review
  ↓
读取 .claude/commands/review.md（审查流程）
  ↓
调度 .claude/agents/code-reviewer.md（子智能体）
  ↓
输出分级审查报告（🔴🟡🟢）
```

---

## 四、技术扩展

### 4.1 CLAUDE.md 写作要点

| ✅ 应该写 | ❌ 不应该写 |
|-----------|------------|
| 包管理器是 pnpm，禁止 npm | TypeScript 的基本语法 |
| API 返回 `{ data?, error? }` 格式 | 每个文件的详细说明 |
| 主题色用 cyber-* 前缀 | 通用编码规范（如"写干净代码"） |
| 客户端组件必须加 "use client" | 频繁变化的信息 |
| 改完代码必须跑 pnpm typecheck | 长篇教程 |

**关键原则**：每条规则问自己"去掉这条 Claude 会犯错吗？"，不会就删。

### 4.2 settings.json 权限模型

```json
{
  "permissions": {
    "deny": ["rm -rf", "DROP TABLE"],    // 硬性禁止，无法覆盖
    "allow": ["pnpm test", "git status"] // 白名单，无需确认
  }
}
```

与 CLAUDE.md 的区别：CLAUDE.md 是"建议"，settings.json 是"强制"。

### 4.3 子智能体 vs 自定义命令

| 维度 | 自定义命令 (/review) | 子智能体 (code-reviewer) |
|------|---------------------|------------------------|
| 上下文 | 共享主对话上下文 | 独立上下文 |
| 适用场景 | 简单流程 | 复杂任务 |
| 配置方式 | commands/*.md | agents/*.md |
| 工具限制 | 使用全部工具 | 可限制工具列表 |

---

## 五、示例

### 5.1 使用 /review 命令

```
> /review

Claude 自动执行：
1. git diff 查看改动
2. pnpm typecheck 检查类型
3. pnpm lint 检查规范
4. pnpm test 运行测试
5. 逐文件审查，输出分级报告
```

### 5.2 CLAUDE.md 片段

```markdown
## 禁止事项
- 禁止使用 npm install / yarn install，只用 pnpm
- 禁止使用 any 类型，除非有充分理由并加注释
- 禁止在客户端组件中导入服务端模块 (src/server/*)
- 禁止在生产代码中使用 console.log
```

---

## 六、验收结果

| 检查项 | 结果 |
|--------|------|
| pnpm typecheck | ✅ 0 error |
| pnpm test | ✅ 6 files / 34 tests passed |
| pnpm lint | ✅ 0 error |
| pnpm build | ✅ Compiled successfully |
| CLAUDE.md 完整性 | ✅ 项目概述/技术栈/规范/目录/架构/禁止事项 |
| .claude/ 完整性 | ✅ settings.json + 4 commands + 2 agents |
| MiMo API | ✅ token-plan-cn.xiaomimimo.com/v1 调通 |
| 数据库 | ✅ model_configs.baseUrl 已更新 |

---

## 七、关键学习点

1. **Harness 的核心是"减少沟通成本"**：把反复交代的规矩写成文件，让 AI 每次自动遵守
2. **CLAUDE.md 要精简**：太长反而会被忽略，只写"去掉会犯错"的规则
3. **settings.json 是硬约束**：CLAUDE.md 是建议，settings.json 是强制，危险操作必须放 deny
4. **子智能体保持主对话轻量**：复杂任务（代码审查、测试编写）交给子智能体在独立上下文完成
5. **工程化工具链要渐进式引入**：先 ESLint + Prettier（立竿见影），再 Hooks（强制保障），最后 CI（自动化）
6. **Bundle 拆分按依赖体积排序**：mermaid (2MB) > highlight.js > markdown > 其余，大依赖独立 chunk

---

## 八、Anthropic 官方最佳实践摘要

来源：https://www.anthropic.com/engineering/claude-code-best-practices

1. **给 Claude 验证手段**：测试、构建、截图对比，让它能自我检查
2. **先探索，再计划，再编码**：用 plan mode 分离研究和实现
3. **提供具体上下文**：引用文件路径、指出约束、指向示例模式
4. **配置环境**：CLAUDE.md + 权限 + MCP + Hooks + Skills + 子智能体
5. **管理上下文窗口**：上下文填满后性能下降，积极使用子智能体分担
6. **自动化扩展**：非交互模式 + 并行会话 + 对抗性审查
