# M5 报告与发布 · 学习文档

> M5 在 M4 多模态基础上升级：Markdown 报告生成、一键下载、主题切换、部署配置。配套需求文档：[M5-report-publish.md](../requirements/M5-report-publish.md)。

## 1. 需求思路

### 1.1 M4 的局限

M4 实现了文件上传和图片生成，但缺少：
- 对话结果无法沉淀为结构化报告
- 用户无法下载对话记录
- 只有深色主题，白天使用刺眼
- 缺少生产环境部署配置

### 1.2 M5 要解决什么

| 能力 | 体现 |
|------|------|
| **报告生成** | 将对话历史汇总为 Markdown 报告，包含摘要、附件列表、完整对话 |
| **报告下载** | 一键导出 `.md` 文件到本地 |
| **主题切换** | cyber-dark（默认）/ cyber-light 两套主题，即时切换 |
| **部署配置** | Dockerfile、nginx.conf、fly.toml，支持容器化部署 |

## 2. 代码思路

### 2.1 关键文件

| 文件 | 职责 |
|------|------|
| `src/server/tools/builtin/summarize_report.ts` | summarize_report 工具，生成 Markdown 报告内容 |
| `src/app/api/export/route.ts` | POST /api/export，从数据库读取会话消息生成报告并触发下载 |
| `src/components/layout/top-bar.tsx` | 新增"导出报告"按钮，调用 /api/export 并下载 |
| `src/app/globals.css` | 新增 `[data-theme="cyber-light"]` 样式覆盖 |
| `tailwind.config.ts` | 新增 `cyber.light` 颜色变量 |
| `src/app/layout.tsx` | 使用 ThemeProvider 包裹子组件 |
| `src/components/theme-provider.tsx` | 监听 theme 变化，设置 `data-theme` 属性 |
| `src/app/settings/page.tsx` | 新增主题选择区域（赛博深色/赛博亮色） |
| `Dockerfile` | 多阶段构建，production 镜像 |
| `nginx.conf` | 反向代理配置 |
| `fly.toml` | Fly.io 部署配置 |

### 2.2 报告生成流程

```
用户：点击顶部栏"导出报告"按钮
  ↓
TopBar.handleExport():
  1. 检查 activeId 和会话消息
  2. fetch POST /api/export { sessionId, format: "markdown", ... }
  3. 响应返回 blob（Content-Type: text/markdown）
  4. 创建 <a> 标签，触发浏览器下载
  ↓
/api/export/route.ts:
  1. Zod 验证请求体
  2. db.select().from(sessions) 查询会话
  3. db.select().from(messages) 查询消息列表
  4. summarizeReportTool.execute() 生成报告内容
  5. 返回 NextResponse(report, { headers: { Content-Disposition, Content-Type } })
```

### 2.3 主题切换流程

```ts
// ThemeProvider.tsx
useEffect(() => {
  if (theme === "cyber-light") {
    document.documentElement.setAttribute("data-theme", "cyber-light");
    document.documentElement.classList.remove("dark");
  } else {
    document.documentElement.setAttribute("data-theme", "cyber-dark");
    document.documentElement.classList.add("dark");
  }
}, [theme]);
```

样式通过 `[data-theme="cyber-light"]` 选择器覆盖：

```css
[data-theme="cyber-light"] body {
  background: #f8fafc;
  color: #1e293b;
}

[data-theme="cyber-light"] .glass {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 240, 255, 0.2);
}
```

## 3. 验证结果

| 验证项 | 结果 |
|--------|------|
| `npx tsc --noEmit` | ✅ 0 error |
| 报告导出 API | ✅ 返回 text/markdown，Content-Disposition 正确 |
| 报告下载 | ✅ 点击按钮自动下载 .md 文件 |
| 报告内容 | ✅ 包含基本信息、摘要、附件列表、完整对话 |
| 主题切换 | ✅ 设置页切换即时生效，localStorage 持久化 |
| 亮色主题 | ✅ 所有组件样式正常 |
| Docker 构建 | ✅ 多阶段构建配置完整 |

## 4. 关联文档

- 需求文档：[M5-report-publish.md](../requirements/M5-report-publish.md)
- M4 学习文档：[M4-multimodal-storage.md](../learning/M4-multimodal-storage.md)
