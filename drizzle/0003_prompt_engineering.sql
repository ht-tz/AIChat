-- M6: 提示词工程中心
-- 新增表: prompt_templates, prompt_versions

-- 1. 创建 prompt_templates 表
CREATE TABLE IF NOT EXISTS "prompt_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(128) NOT NULL,
  "description" text DEFAULT '',
  "category" varchar(64) DEFAULT 'custom' NOT NULL,
  "system_prompt" text NOT NULL,
  "variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_builtin" boolean DEFAULT false NOT NULL,
  "current_version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS "prompt_templates_category_idx" ON "prompt_templates" ("category");--> statement-breakpoint

-- 3. 创建 prompt_versions 表
CREATE TABLE IF NOT EXISTS "prompt_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "system_prompt" text NOT NULL,
  "variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "changelog" text DEFAULT '',
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- 4. 创建版本表索引
CREATE INDEX IF NOT EXISTS "prompt_versions_template_idx" ON "prompt_versions" ("template_id", "version");--> statement-breakpoint

-- 5. 外键约束
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_template_id_prompt_templates_id_fk"
  FOREIGN KEY ("template_id") REFERENCES "prompt_templates"("id") ON DELETE cascade;--> statement-breakpoint
