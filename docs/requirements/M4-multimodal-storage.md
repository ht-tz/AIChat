# M4: 多模态 + 存储

> 需求文档，动手写代码前先填齐。

## 基本信息

- **里程碑**：M4
- **标题**：多模态 + 存储
- **负责人**：
- **创建日期**：2026-07-03
- **状态**：✅ 已完成

---

## 1. 背景与目标

M3 仅支持文本对话，无法上传文件或生成图片。本里程碑扩展为多模态交互系统。

## 2. 用户故事

- 作为用户，我希望上传图片和文件给 AI 分析
- 作为用户，我希望 AI 能根据提示词生成图片
- 作为用户，我希望通过 read_file 工具读取已上传文件内容

## 3. 功能范围

### 3.1 包含（In Scope）

- 文件上传（文本 + 图片，保存到 public/uploads/）
- 图片生成（占位图片，赛博风格）
- read_file 工具读取已上传文件
- 多模态消息（attachments 附件列表）
- 文件元数据持久化（files 表、file_chunks 表、images 表）

### 3.2 不包含（Out of Scope）

- 真实图片生成 API（DALL-E/Midjourney）
- OCR 文字识别
- 视频/音频处理

## 4. 验收标准

- [x] 文件上传 API 返回文件 URL
- [x] 图片生成返回赛博风格占位图
- [x] read_file 工具读取文件内容
- [x] messages.attachments 字段正确存储

## 5. 技术约束

- 影响的模块：src/server/db/schema.ts、src/app/api/upload/、src/server/tools/builtin/read_file.ts
- 存储：本地文件系统 public/uploads/ + PostgreSQL 元数据

## 6. 拆分与排期

| # | 子任务 | 状态 |
|---|--------|------|
| 1 | DB schema 扩展（files/file_chunks/images 表） | ✅ |
| 2 | 文件上传 API | ✅ |
| 3 | 图片生成工具 | ✅ |
| 4 | read_file 工具 | ✅ |
| 5 | 前端多模态消息渲染 | ✅ |

## 7. 关联文档

- 学习文档：`docs/learning/M4-multimodal-storage.md`
