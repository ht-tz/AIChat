CREATE TYPE "public"."agent_run_status" AS ENUM('running', 'success', 'error', 'aborted');--> statement-breakpoint
CREATE TYPE "public"."agent_step_kind" AS ENUM('plan', 'thought', 'tool_call', 'tool_result', 'reflection', 'delta', 'hitl_request', 'done', 'error');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('system', 'user', 'assistant', 'tool');--> statement-breakpoint
CREATE TYPE "public"."tool_call_status" AS ENUM('pending', 'running', 'success', 'error');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"agent_id" uuid,
	"user_message" text NOT NULL,
	"model" varchar(64) NOT NULL,
	"status" "agent_run_status" DEFAULT 'running' NOT NULL,
	"total_rounds" integer DEFAULT 0 NOT NULL,
	"plan" jsonb,
	"reflection_score" integer,
	"reflection_critique" text,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_usd_micros" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"step_index" integer NOT NULL,
	"kind" "agent_step_kind" NOT NULL,
	"tool_call_id" varchar(64),
	"content" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" text DEFAULT '',
	"system_prompt" text DEFAULT '',
	"enabled_tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_model" varchar(64) DEFAULT 'mock-default' NOT NULL,
	"temperature" integer DEFAULT 7 NOT NULL,
	"enable_plan" boolean DEFAULT false NOT NULL,
	"enable_reflection" boolean DEFAULT false NOT NULL,
	"require_hitl" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"avatar" varchar(8) DEFAULT '🤖' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"name" varchar(64),
	"run_id" uuid,
	"thoughts" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) DEFAULT 'default' NOT NULL,
	"agent_id" uuid,
	"title" varchar(200) DEFAULT '新会话' NOT NULL,
	"preview" text DEFAULT '',
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tool_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"message_id" uuid,
	"call_id" varchar(64) NOT NULL,
	"tool_name" varchar(64) NOT NULL,
	"args" jsonb NOT NULL,
	"result" jsonb,
	"error" text,
	"status" "tool_call_status" DEFAULT 'pending' NOT NULL,
	"duration_ms" integer,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" text NOT NULL,
	"definition" jsonb NOT NULL,
	"impl" varchar(16) DEFAULT 'builtin' NOT NULL,
	"endpoint" text,
	"call_count" integer DEFAULT 0 NOT NULL,
	"avg_duration_ms" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tools_name_unique" UNIQUE("name")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_steps" ADD CONSTRAINT "agent_steps_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_session_idx" ON "agent_runs" USING btree ("session_id","started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_status_idx" ON "agent_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_steps_run_idx" ON "agent_steps" USING btree ("run_id","step_index");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_session_idx" ON "messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_run_idx" ON "messages" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_updated_idx" ON "sessions" USING btree ("updated_at");