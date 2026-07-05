#!/bin/bash
# 推送 Drizzle migration 到 PostgreSQL
# 绕开 drizzle-kit 0.28.1 在 macOS 上的卡死 bug（要求交互输入）
# 用 psql 直接执行 drizzle/ 目录下的 SQL

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DRIZZLE_DIR="$ROOT_DIR/drizzle"

# 读 DATABASE_URL
if [ -f "$ROOT_DIR/.env.local" ]; then
  export $(grep -v '^#' "$ROOT_DIR/.env.local" | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL 未设置（在 .env.local 中配置）"
  exit 1
fi

# 解析连接参数
if [[ "$DATABASE_URL" =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
  PGUSER="${BASH_REMATCH[1]}"
  PGPASSWORD="${BASH_REMATCH[2]}"
  PGHOST="${BASH_REMATCH[3]}"
  PGPORT="${BASH_REMATCH[4]}"
  PGDATABASE="${BASH_REMATCH[5]}"
else
  echo "❌ DATABASE_URL 格式错误：$DATABASE_URL"
  exit 1
fi

# 应用所有 migration 文件（按文件名顺序）
for f in "$DRIZZLE_DIR"/*.sql; do
  if [ -f "$f" ]; then
    echo "📦 应用 $f"
    PGPASSWORD="$PGPASSWORD" psql \
      -h "$PGHOST" \
      -p "$PGPORT" \
      -U "$PGUSER" \
      -d "$PGDATABASE" \
      -f "$f" \
      -v ON_ERROR_STOP=1 \
      --quiet 2>&1 | tail -5
  fi
done

echo "✅ 迁移完成"
