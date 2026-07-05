# 环境与启动

> **当前里程碑**：M2 工具调用 ✅，M3 ReAct 待启动。

## 1. 前置依赖

- **Node.js**：>= 20（推荐 22）
- **pnpm**：>= 9（推荐 10）
- **PostgreSQL 16** + 扩展 `pgvector`（开发期可暂时不用连接，但代码里已就位）
- **Redis**（可选，定时任务 / 队列用）

## 2. 安装

```bash
pnpm install
cp .env.example .env
```

`.env` 中的关键项：

| 变量 | 默认 | 说明 |
|------|------|------|
| `LLM_PROVIDER` | `mock` | 默认无需 API Key，切到 `openai` 用真实模型 |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | 兼容国内厂商时可改 |
| `OPENAI_API_KEY` | 空 | 真实厂商 key |
| `DEFAULT_MODEL` | `gpt-4o-mini` | 默认模型 |
| `DATABASE_URL` | postgres://... | 暂未启用，开发期不会真的连 |

## 3. 启动

```bash
pnpm dev
```

打开 http://localhost:3000

## 4. 切换到真实大模型

```ini
# .env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1   # 或 https://api.deepseek.com/v1
DEFAULT_MODEL=gpt-4o-mini
```

重启 `pnpm dev` 即可。

## 5. 脚本

| 命令 | 作用 |
|------|------|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 生产构建 |
| `pnpm start` | 运行生产服务 |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TS 类型检查 |
| `pnpm test` | 运行 vitest 单元测试（M2 接入） |
| `pnpm test:watch` | 监听模式运行测试 |
| `pnpm db:push` | 把 Drizzle schema 推到数据库 |
| `pnpm db:studio` | 打开 Drizzle Studio |

## 6. 数据库

用户提供的本地 PostgreSQL 实例（M4 接入）：

```
DATABASE_URL=postgresql://tizen:root@localhost:5432/postgres
```

密码：`root`
