---
name: database
description: 数据库操作技能。当需要执行 SQL、迁移、查询数据时使用。
---

# 数据库操作规范

## 连接信息
- 读 .env.local 获取 DATABASE_URL
- 使用 psql 命令行操作

## 迁移流程
1. 修改 src/server/db/schema.ts
2. pnpm db:generate 生成迁移文件
3. pnpm db:push 执行迁移
4. 验证: psql 查询 \dt 确认表已创建

## 禁止
- 禁止 DROP TABLE / DROP DATABASE
- 禁止 DELETE 不带 WHERE
- 禁止直接修改 drizzle/*.sql（由 drizzle-kit 生成）
