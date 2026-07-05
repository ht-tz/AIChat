# M6 提示词工程中心 · 学习文档

> M6 建立了提示词模板管理系统、Playground 试验场和 A/B 测试能力。配套需求文档：[M6-prompt-engineering.md](../requirements/M6-prompt-engineering.md)。

## 1. 需求思路

### 1.1 M5 的局限

M1-M4 的 system prompt 硬编码在 Provider 中：
- 无法复用提示词
- 无法调试提示词效果
- 无法对比不同提示词版本
- 无法管理变量插值

### 1.2 M6 要解决什么

| 能力 | 体现 |
|------|------|
| **模板管理** | 创建、编辑、删除、复制提示词模板 |
| **变量插值** | `{{variable}}` 语法，自动提取和填充 |
| **版本管理** | 每次保存生成新版本，可回滚 |
| **Playground** | 选模板 → 填变量 → 执行 → 看输出 |
| **A/B 测试** | 两个模板同一输入，并排对比输出 |
| **预置模板** | 代码审查、翻译、总结、角色扮演 |

## 2. 代码思路

### 2.1 关键文件

| 文件 | 职责 |
|------|------|
| `src/server/prompts/variable-parser.ts` | 变量提取、插值、校验 |
| `src/server/prompts/builtin-templates.ts` | 4 个预置模板定义 |
| `src/server/prompts/playground-service.ts` | Playground 和 A/B 测试执行逻辑 |
| `src/server/prompts/index.ts` | 统一导出 |
| `src/app/api/playground/route.ts` | POST /api/playground |
| `src/app/api/ab-test/route.ts` | POST /api/ab-test |
| `src/stores/prompts.ts` | Zustand store + localStorage 持久化 |
| `src/features/prompt/prompt-manager.tsx` | 模板管理 UI（列表 + 编辑器 + 版本历史） |
| `src/features/prompt/playground.tsx` | Playground UI（单模板 + A/B 测试） |
| `src/app/prompts/page.tsx` | /prompts 页面路由 |
| `src/app/playground/page.tsx` | /playground 页面路由 |
| `src/server/db/schema.ts` | 新增 prompt_templates + prompt_versions 表 |
| `drizzle/0003_prompt_engineering.sql` | SQL 迁移文件 |

### 2.2 变量解析流程

```
模板文本: "你是一位{{role}}，请回答{{question}}"
            ↓
extractVariables() → ["role", "question"]
            ↓
用户填充: { role: "翻译官", question: "hello" }
            ↓
interpolate() → "你是一位翻译官，请回答hello"
```

**核心正则**：`/\{\{(\w+)\}\}/g`
- 匹配 `{{` + 字母数字下划线 + `}}`
- 不支持嵌套，保持简单可预测

### 2.3 模板版本管理

每次 `update()` 调用：
1. 递增 `currentVersion`
2. 将当前 `systemPrompt` + `variables` 存入 `versions[]` 数组
3. 记录 `changelog`

回滚操作不是删除版本，而是创建一个新版本（内容从目标版本复制），保持版本链完整。

```
v1 (初始) → v2 (修改 prompt) → v3 (修改变量) → v4 (回滚到 v2)
                                                    ↑
                                           内容 = v2 的内容
                                           changelog = "回滚到版本 2"
```

### 2.4 Playground 执行流程

```
前端: 选模板 → 填变量 → 点击执行
  ↓
POST /api/playground
  body: { systemPrompt, variables, variableValues, model, temperature }
  ↓
executePlayground():
  1. validateVariables() — 校验必填
  2. resolveVariables() — 合并默认值
  3. interpolate() — 替换 {{variable}}
  4. getProvider().complete() — 调用 LLM
  5. 返回 { output, usage, durationMs, resolvedPrompt }
  ↓
前端展示输出 + token 用量 + 耗时
```

### 2.5 A/B 测试流程

```
前端: 选模板 A + 模板 B → 填共享变量 → 执行
  ↓
POST /api/ab-test
  body: { templateA, templateB, variableValues, ... }
  ↓
executeABTest():
  Promise.all([
    executePlayground(templateA, ...),
    executePlayground(templateB, ...),
  ])
  ↓
前端并排展示 resultA 和 resultB
```

### 2.6 前端 Store 架构

```ts
usePromptsStore (Zustand + localStorage)
├── templates: Record<id, PromptTemplateData>
├── activeId: string | null
├── list()     → 返回 builtin + custom 模板列表
├── get(id)    → 获取单个模板（含 builtin 降级）
├── create()   → 新建模板
├── update()   → 更新模板（自动创建新版本）
├── remove()   → 删除模板（builtin 不可删）
├── duplicate()→ 复制模板
├── rollback() → 回滚到指定版本
└── setActive()→ 设置选中
```

**设计决策**：模板存储在前端 localStorage（与 session store 一致），而非数据库。原因：
1. 与现有 session store 模式一致
2. 无数据库也能使用
3. DB 表已建好，未来可迁移到服务端

## 3. 技术架构

### 3.1 页面结构

```
/prompts (PromptManager)
├── 左栏 w-72: 模板列表
│   ├── 搜索框
│   ├── "新建模板" 按钮
│   └── 模板项（名称、分类、版本数、内置标记）
└── 右栏: 编辑器
    ├── 基本信息（名称、描述、分类）
    ├── System Prompt 文本域
    ├── 变量管理（自动提取 + 手动编辑）
    ├── 标签管理
    ├── 保存栏（changelog + 保存按钮）
    ├── 版本历史面板
    └── 操作按钮（复制、删除、Playground 链接）

/playground (Playground)
├── 顶部: 返回链接 + 标题
├── Tab: 单模板测试 | A/B 测试
├── 配置区: 模型选择 + Temperature 滑块
├── 单模板:
│   ├── 模板选择器
│   ├── 变量输入区
│   ├── 用户消息（可选）
│   ├── 执行按钮
│   └── 输出区 + token 用量 + 解析后 prompt
└── A/B 测试:
    ├── 模板 A 选择器
    ├── 模板 B 选择器
    ├── 共享变量输入区
    ├── 执行按钮
    └── 并排输出对比
```

### 3.2 数据流

```
Playground 执行:
  前端 Store (模板数据)
      ↓
  /api/playground (POST)
      ↓
  playground-service.ts
      ↓
  variable-parser.ts (插值)
      ↓
  getProvider().complete() (LLM 调用)
      ↓
  返回 { output, usage, durationMs }
```

### 3.3 预置模板

| 模板 | 分类 | 变量 |
|------|------|------|
| 代码审查 | 开发 | language, code |
| 智能翻译 | 翻译 | sourceLang, targetLang, text |
| 内容总结 | 总结 | maxLength, content |
| 角色扮演 | 角色扮演 | roleName, personality, background, question |

## 4. 技术拓展

### 4.1 提示词自动优化（M7+）

当前需要手动对比模板效果，升级方向：

```ts
// 自动优化流程
interface OptimizationResult {
  originalScore: number;
  optimizedPrompt: string;
  optimizedScore: number;
  suggestions: string[];
}

async function autoOptimize(template: PromptTemplateData): Promise<OptimizationResult> {
  // 1. 用原始模板跑测试集
  // 2. 分析输出质量
  // 3. 用 LLM 生成改进建议
  // 4. 自动生成优化版本
  // 5. A/B 测试验证
}
```

### 4.2 提示词评估流水线（M10）

```ts
interface EvalSuite {
  id: string;
  name: string;
  cases: Array<{
    input: Record<string, string>;
    expectedOutput?: string;
    rubric?: string; // 评分标准
  }>;
}

async function runEvalSuite(template: PromptTemplateData, suite: EvalSuite) {
  const results = await Promise.all(
    suite.cases.map(c => executePlayground({
      systemPrompt: template.systemPrompt,
      variables: template.variables,
      variableValues: c.input,
    }))
  );
  // 评分对比
}
```

### 4.3 模板共享与市场（M9+）

```ts
// 模板发布到市场
interface PublishedTemplate {
  id: string;
  author: string;
  template: PromptTemplateData;
  downloads: number;
  rating: number;
  tags: string[];
}

// API
// GET  /api/templates/market — 浏览市场
// POST /api/templates/publish — 发布模板
// POST /api/templates/:id/install — 安装到本地
```

### 4.4 高级变量语法

当前只支持 `{{variable}}`，可扩展：

```ts
// 条件渲染
{{#if language === "typescript"}}
  请注意类型安全
{{/if}}

// 循环
{{#each items}}
  - {{this}}
{{/each}}

// 默认值
{{language|default:"javascript"}}

// 过滤器
{{text|uppercase|trim}}
```

## 5. 示例

### 5.1 创建模板

```bash
# API 方式（未来支持）
curl -X POST http://localhost:3000/api/prompts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bug 分析",
    "category": "开发",
    "systemPrompt": "你是一位 bug 分析专家。分析以下 {{language}} 代码中的 bug：\n\n{{code}}",
    "variables": [
      { "name": "language", "defaultValue": "typescript" },
      { "name": "code" }
    ]
  }'
```

### 5.2 Playground 执行

```bash
curl -X POST http://localhost:3000/api/playground \
  -H "Content-Type: application/json" \
  -d '{
    "systemPrompt": "你是一位翻译。将以下文本翻译为{{targetLang}}：\n\n{{text}}",
    "variables": [
      { "name": "targetLang", "defaultValue": "英文" },
      { "name": "text" }
    ],
    "variableValues": {
      "targetLang": "日文",
      "text": "你好世界"
    },
    "model": "mock-default",
    "temperature": 0.7
  }'
```

### 5.3 A/B 测试

```bash
curl -X POST http://localhost:3000/api/ab-test \
  -H "Content-Type: application/json" \
  -d '{
    "templateA": {
      "name": "简洁版",
      "systemPrompt": "简要总结：{{content}}",
      "variables": [{ "name": "content" }]
    },
    "templateB": {
      "name": "详细版",
      "systemPrompt": "请详细分析以下内容，分点表述：{{content}}",
      "variables": [{ "name": "content" }]
    },
    "variableValues": {
      "content": "Next.js 14 引入了 App Router"
    }
  }'
```

## 6. 验证结果

| 验证项 | 结果 |
|--------|------|
| `npx tsc --noEmit` | ✅ 0 error |
| `/prompts` 页面 | ✅ 模板列表 + 编辑器 + 版本历史 |
| `/playground` 页面 | ✅ 单模板 + A/B 测试 |
| 变量插值 | ✅ `{{variable}}` 正确提取和替换 |
| 版本管理 | ✅ 每次保存生成新版本，可回滚 |
| 预置模板 | ✅ 4 个内置模板可用 |
| Playground 执行 | ✅ 调用 Mock Provider 返回结果 |
| A/B 测试 | ✅ 并排展示两个输出 |
| 导航入口 | ✅ sidebar 添加模板和 Playground 链接 |

## 7. 待优化（M7+ 处理）

- **ISSUE-M6-001** 提示词自动优化 → M7 Agent 记忆与学习
- **ISSUE-M6-002** 模板评估流水线 → M10 Eval 体系
- **ISSUE-M6-003** 模板市场/共享 → M9 知识库增强
- **ISSUE-M6-004** 高级变量语法（条件、循环、过滤器）→ 后续迭代
- **ISSUE-M6-005** 模板导入/导出 JSON → 后续迭代
- **ISSUE-M6-006** DB 持久化迁移 → 当前后端 localStorage，DB 表已就绪

## 8. 关联文档

- 需求文档：[M6-prompt-engineering.md](../requirements/M6-prompt-engineering.md)
- 架构总览：[00-architecture.md](./00-architecture.md)
