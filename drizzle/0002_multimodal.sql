-- M4: 多模态+存储
-- 新增 enums: file_type, image_status
-- 新增表: files, file_chunks, images
-- messages 表新增 attachments 字段

-- 1. 创建枚举类型
CREATE TYPE "file_type" AS ENUM('text', 'image', 'audio', 'video', 'pdf', 'other');--> statement-breakpoint
CREATE TYPE "image_status" AS ENUM('pending', 'generating', 'success', 'error');--> statement-breakpoint

-- 2. messages 表添加 attachments 字段
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachments" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint

-- 3. 创建 files 表
CREATE TABLE IF NOT EXISTS "files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" varchar(64) NOT NULL,
  "filename" varchar(255) NOT NULL,
  "original_name" varchar(255) NOT NULL,
  "mime_type" varchar(127) NOT NULL,
  "file_type" "file_type" NOT NULL,
  "size" integer NOT NULL,
  "path" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- 4. 创建 file_chunks 表
CREATE TABLE IF NOT EXISTS "file_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "file_id" uuid NOT NULL,
  "chunk_index" integer NOT NULL,
  "content" text NOT NULL,
  "token_count" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- 5. 创建 images 表
CREATE TABLE IF NOT EXISTS "images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" varchar(64) NOT NULL,
  "run_id" uuid,
  "prompt" text NOT NULL,
  "model" varchar(64) NOT NULL,
  "status" "image_status" DEFAULT 'pending' NOT NULL,
  "url" text,
  "error" text,
  "duration_ms" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- 6. 创建索引
CREATE INDEX IF NOT EXISTS "files_session_idx" ON "files" ("session_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_chunks_file_idx" ON "file_chunks" ("file_id", "chunk_index");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "images_session_idx" ON "images" ("session_id", "created_at");--> statement-breakpoint

-- 7. 添加外键约束
DO $$ BEGIN
  ALTER TABLE "files" ADD CONSTRAINT "files_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "file_chunks" ADD CONSTRAINT "file_chunks_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "images" ADD CONSTRAINT "images_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
