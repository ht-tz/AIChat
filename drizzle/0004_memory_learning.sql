-- M7: Agent 记忆与学习
-- 新增表: memories, memory_chunks, experiences

-- 1. 创建枚举类型
CREATE TYPE "memory_kind" AS ENUM ('short', 'long', 'episodic');
CREATE TYPE "memory_status" AS ENUM ('active', 'archived', 'forgotten');
CREATE TYPE "experience_type" AS ENUM ('success', 'failure', 'insight');

-- 2. 创建 memories 表
CREATE TABLE IF NOT EXISTS "memories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" varchar(64) REFERENCES sessions(id) ON DELETE SET NULL,
  "kind" "memory_kind" NOT NULL,
  "content" text NOT NULL,
  "summary" text DEFAULT '',
  "topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "importance" integer DEFAULT 50 NOT NULL,
  "embedding" text DEFAULT '',
  "source" varchar(128) DEFAULT 'conversation' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" "memory_status" DEFAULT 'active' NOT NULL,
  "referenced_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "last_accessed_at" timestamp DEFAULT now() NOT NULL
);

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS "memories_kind_idx" ON "memories" ("kind");
CREATE INDEX IF NOT EXISTS "memories_status_idx" ON "memories" ("status");
CREATE INDEX IF NOT EXISTS "memories_session_idx" ON "memories" ("session_id");

-- 4. 创建 memory_chunks 表
CREATE TABLE IF NOT EXISTS "memory_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "memory_id" uuid REFERENCES memories(id) ON DELETE CASCADE NOT NULL,
  "chunk_index" integer NOT NULL,
  "content" text NOT NULL,
  "embedding" text DEFAULT '',
  "token_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- 5. 创建版本表索引
CREATE INDEX IF NOT EXISTS "memory_chunks_memory_idx" ON "memory_chunks" ("memory_id", "chunk_index");

-- 6. 创建 experiences 表
CREATE TABLE IF NOT EXISTS "experiences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" varchar(64) REFERENCES sessions(id) ON DELETE SET NULL,
  "run_id" uuid REFERENCES agent_runs(id) ON DELETE SET NULL,
  "type" "experience_type" NOT NULL,
  "title" varchar(200) NOT NULL,
  "description" text DEFAULT '',
  "lesson" text NOT NULL,
  "context" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "rating" integer DEFAULT 0 NOT NULL,
  "referenced_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- 7. 创建经验表索引
CREATE INDEX IF NOT EXISTS "experiences_type_idx" ON "experiences" ("type");
CREATE INDEX IF NOT EXISTS "experiences_session_idx" ON "experiences" ("session_id");
