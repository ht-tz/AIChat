# M6 · 提示词工程中心

## 基本信息

- **里程碑**：M6
- **标题**：提示词工程中心（Prompt Engineering Center）
- **负责人**：AI Agent
- **创建日期**：2026-07-03
- **状态**：🚧 进行中

## 1. 背景与目标

M1-M4 实现了对话、工具调用、ReAct 推理、多模态。但所有 system prompt 硬编码在 Provider 中，无法管理和复用。M6 建立提示词工程中心，让用户能：

- 创建、编辑、管理提示词模板（含变量插值）
- 在 Playground 中测试模板效果
- 对比不同模板版本的输出（A/B 测试）

## 2. 用户故事

1. 作为开发者，我想创建提示词模板并定义变量，以便复用 system prompt
2. 作为开发者，我想在 Playground 中填入变量并测试模板，以便调试提示词效果
3. 作为开发者，我想查看模板的历史版本，以便追溯修改
4. 作为开发者，我想对比两个模板的输出，以便选择最佳提示词

## 3. 功能范围

### 3.1 包含（In Scope）

- 提示词模板 CRUD（名称、描述、分类、system prompt、变量定义）
- 变量插值（`{{variable}}` 语法）
- 模板版本管理（每次保存生成新版本，可回滚）
- Playground 页面（选模板 → 填变量 → 执行 → 看输出）
- A/B 测试（选两个模板/版本 → 同一输入 → 对比输出）
- 预置模板库（代码审查、翻译、总结、角色扮演等）

### 3.2 不包含（Out of Scope）

- 提示词自动优化（M7+）
- 模板市场/共享（M9+）
- 提示词评估流水线（M10）
- 真实 LLM 调用（默认 Mock，支持切换 OpenAI）

## 4. 验收标准

- [ ] `/prompts` 页面能创建、编辑、删除模板
- [ ] 模板支持 `{{variable}}` 变量定义和插值
- [ ] 每次编辑保存生成新版本，可查看版本历史
- [ ] `/playground` 页面能选模板、填变量、执行并查看输出
- [ ] Playground 支持 temperature / model 参数调整
- [ ] A/B 测试能同时执行两个模板并并排展示结果
- [ ] 预置至少 4 个模板（代码审查、翻译、总结、角色扮演）
- [ ] `pnpm typecheck` 0 error

## 5. 交互 / UI 说明

### 页面结构

- `/prompts` - 模板管理页（左侧列表 + 右侧编辑器）
- `/playground` - Playground 页面（模板选择 + 变量输入 + 输出区）

### 关键组件

- `PromptList` - 模板列表，支持搜索和分类过滤
- `PromptEditor` - 模板编辑器（名称、描述、分类、system prompt、变量定义）
- `VersionHistory` - 版本历史面板
- `PlaygroundRunner` - Playground 执行区
- `ABTestPanel` - A/B 测试对比面板

### 状态

- 列表空：显示"创建第一个模板"引导
- 执行中：loading 动画 + 可取消
- 执行完成：展示输出 + token 用量
- A/B 测试：并排展示两个输出

## 6. 技术约束

- 数据库：新增 `prompt_templates` + `prompt_versions` 两张表
- 变量解析：正则匹配 `{{variable}}`，运行时替换
- Provider 复用：Playground 调用现有 `getProvider()` 的 `complete()` 方法
- 前端路由：Next.js App Router，`/prompts` 和 `/playground` 两个页面
- 状态管理：Zustand store + localStorage 持久化（离线可用）

## 7. 风险与备选

- **风险**：无数据库连接时模板无法持久化 → 备选：localStorage 降级
- **风险**：Mock Provider 输出不够直观 → 备选：为 Playground 专门设计 Mock 响应
- **风险**：变量插值边界情况 → 备选：先支持简单 `{{name}}` 语法，不支持嵌套

## 8. 拆分与排期

1. 数据库 schema 扩展（prompt_templates + prompt_versions）
2. 提示词管理服务层（CRUD + 变量解析）
3. API 路由（/api/prompts + /api/playground + /api/ab-test）
4. 前端 Store + 页面 + 组件
5. 导航入口
6. 验证 + 学习文档

## 9. 自测计划

- `pnpm typecheck` 0 error
- `/prompts` 页面创建模板 → 编辑 → 查看版本历史
- `/playground` 选模板 → 填变量 → 执行 → 查看输出
- A/B 测试选两个模板 → 执行 → 对比输出
- 预置模板可见可用

## 10. 关联文档

- 对应学习文档：`docs/learning/M6-prompt-engineering.md`
- 对应架构文档：`docs/learning/00-architecture.md`
