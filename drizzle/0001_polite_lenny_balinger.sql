-- M3 调整：sessions.id 和 messages.sessionId 改 varchar 兼容 nanoid
-- agent_runs.sessionId 改 varchar

-- 1. 删外键约束
ALTER TABLE "agent_runs" DROP CONSTRAINT IF EXISTS "agent_runs_session_id_sessions_id_fk";
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_session_id_sessions_id_fk";
ALTER TABLE "agent_steps" DROP CONSTRAINT IF EXISTS "agent_steps_run_id_agent_runs_id_fk";
ALTER TABLE "tool_calls" DROP CONSTRAINT IF EXISTS "tool_calls_message_id_messages_id_fk";
--> statement-breakpoint

-- 2. 改列类型
ALTER TABLE "sessions" ALTER COLUMN "id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "agent_runs" ALTER COLUMN "session_id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "session_id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "tool_calls" ALTER COLUMN "message_id" SET DATA TYPE varchar(64);--> statement-breakpoint
--> statement-breakpoint

-- 3. 重建外键
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "agent_steps" ADD CONSTRAINT "agent_steps_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade;--> statement-breakpoint
