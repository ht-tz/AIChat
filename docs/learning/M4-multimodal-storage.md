# M4 多模态 + 存储 · 学习文档

> M4 在 M3 ReAct 基础上升级为多模态交互系统，支持文件上传、图片生成、多模态消息渲染。配套需求文档：[M4-multimodal-storage.md](../requirements/M4-multimodal-storage.md)。

## 1. 需求思路

### 1.1 M3 的局限

M3 实现了 ReAct 推理 + 数据库持久化，但仅支持文本对话：
- 无法上传文件或图片
- AI 只能输出文本，无法生成图片
- 消息只有纯文本内容

### 1.2 M4 要解决什么

| 能力 | 体现 |
|------|------|
| **文件上传** | 支持文本和图片文件上传，保存到 `public/uploads/` |
| **图片生成** | AI 根据提示词生成赛博风格占位图片 |
| **文件读取** | read_file 工具读取已上传文件内容 |
| **多模态消息** | 消息支持 attachments（附件列表） |
| **文件持久化** | 文件元数据写入 `files` 表，图片记录写入 `images` 表 |

## 2. 代码思路

### 2.1 关键文件

| 文件 | 职责 |
|------|------|
| `src/server/db/schema.ts` | 新增 `fileTypeEnum`、`imageStatusEnum`、`files` 表、`fileChunks` 表、`images` 表，`messages` 新增 `attachments` jsonb |
| `drizzle/0002_multimodal.sql` | SQL 迁移文件 |
| `src/app/api/upload/route.ts` | POST multipart/form-data 上传，保存到 `public/uploads/`，写入 `files` 表 |
| `src/app/api/files/[id]/route.ts` | 根据 id 查询文件信息 |
| `src/server/tools/builtin/read_file.ts` | read_file 工具：读取文本文件内容或返回图片 URL |
| `src/server/tools/builtin/generate_image.ts` | generate_image 工具：生成赛博风格 SVG data URL，记录到 `images` 表 |
| `src/lib/types.ts` | 新增 `Attachment` 接口，`Message` 新增 `attachments` |
| `src/components/chat/composer.tsx` | 启用 Paperclip 按钮、拖拽上传、附件预览、上传状态 |
| `src/components/chat/file-attachment-card.tsx` | 文件/图片附件卡片组件 |
| `src/components/chat/message-bubble.tsx` | 渲染消息 attachments，图片可点击预览 |
| `src/stores/settings.ts` | `TOOL_DISPLAY` 新增 read_file、generate_image |

### 2.2 文件上传流程

```
用户：拖拽文件到输入框 / 点击 Paperclip 按钮
  ↓
Composer.handleFileUpload():
  1. 验证文件类型（text/* 或 image/*）
  2. 验证文件大小（≤ 10MB）
  3. fetch POST /api/upload { file, sessionId }
  ↓
/api/upload/route.ts:
  1. 解析 multipart formData
  2. nanoid() 生成唯一文件名
  3. 写入 public/uploads/
  4. db.insert(files) 写入元数据
  5. 返回 { id, url, filename, ... }
  ↓
前端：将 attachment 加入消息，发送时携带
```

### 2.3 图片生成流程

```
用户："画一只赛博朋克猫"
  ↓
MockProvider：匹配关键词 "画/生成/创建一张" → 触发 generate_image
  ↓
generate_image 工具：
  1. 生成赛博风格 SVG（渐变背景 + 网格 + 霓虹圆环 + 文字）
  2. base64 编码为 data URL
  3. db.insert(images) 记录生成历史
  4. 返回 { prompt, url, size, status }
  ↓
前端：将图片 URL 加入 AI 消息的 attachments，渲染为缩略图
```

### 2.4 多模态消息数据结构

```ts
interface Attachment {
  id: string;
  type: "text" | "image" | "audio" | "video" | "pdf" | "other";
  name: string;
  url: string;
  mimeType: string;
  size: number;
  fileId?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  attachments?: Attachment[];  // M4 新增
}
```

## 3. 技术架构

### 3.1 数据库表设计

```
files（文件元数据）
├── id: uuid PK
├── sessionId: varchar FK → sessions
├── filename: varchar（nanoid 生成）
├── originalName: varchar（原始文件名）
├── mimeType: varchar
├── fileType: fileTypeEnum（text/image/audio/video/pdf/other）
├── size: bigint
├── path: text（绝对路径）
└── createdAt: timestamp

images（AI 生成图片记录）
├── id: uuid PK
├── sessionId: varchar FK → sessions
├── runId: uuid FK → agent_runs
├── prompt: text
├── model: varchar（mock-image-gen）
├── status: imageStatusEnum（pending/generating/success/error）
├── url: text（data URL）
├── error: text
└── createdAt: timestamp

messages（扩展）
├── ...原有字段...
└── attachments: jsonb（附件列表）
```

### 3.2 前端附件渲染

```
MessageBubble:
  ├── 文本内容（Markdown）
  └── attachments[]:
      ├── image → <img> 缩略图，点击放大预览
      └── text → FileAttachmentCard（图标+名称+大小+删除按钮）
```

## 4. 验证结果

| 验证项 | 结果 |
|--------|------|
| `pnpm typecheck` | ✅ 0 error |
| `pnpm lint` | ✅ 0 warning |
| 文件上传 | ✅ 支持文本和图片，10MB 限制 |
| 文件读取 | ✅ read_file 工具返回内容或 URL |
| 图片生成 | ✅ Mock SVG 占位图，data URL |
| 多模态消息 | ✅ attachments 正常渲染 |
| DB 持久化 | ✅ files/images 表写入成功 |

## 5. 待优化（M5+ 处理）

- **ISSUE-M4-001** PDF/Word/Excel 解析 → M10 接入 pdf-parse/mammoth
- **ISSUE-M4-002** 语音输入 ASR → Whisper + ffmpeg
- **ISSUE-M4-003** 对象存储 S3/OSS → 当前本地 public/uploads
- **ISSUE-M4-004** 图片理解 Vision 模型 → M10 接入
- **ISSUE-M4-005** 文件切片向量化 → file_chunks 表已建，RAG 时填数据
