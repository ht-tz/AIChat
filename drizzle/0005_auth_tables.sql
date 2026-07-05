-- 创建认证相关表 (M12-M15)

-- 枚举类型
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE api_key_status AS ENUM('active', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE oauth_provider AS ENUM('github', 'google');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE ma_team_type AS ENUM('research', 'creative', 'code', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE ma_run_status AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE ma_step_status AS ENUM('pending', 'running', 'completed', 'failed', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Users 表
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL UNIQUE,
  password_hash text,
  name varchar(128) DEFAULT '',
  role user_role DEFAULT 'user' NOT NULL,
  email_verified boolean DEFAULT false NOT NULL,
  avatar varchar(255),
  provider varchar(32),
  last_login_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);

-- API Keys 表
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(128) NOT NULL,
  key_hash text NOT NULL,
  key_prefix varchar(16) NOT NULL,
  status api_key_status DEFAULT 'active' NOT NULL,
  last_used_at timestamp,
  usage_count integer DEFAULT 0 NOT NULL,
  expires_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS api_keys_user_idx ON api_keys (user_id);
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys (key_hash);

-- OAuth Accounts 表
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider oauth_provider NOT NULL,
  provider_user_id varchar(255) NOT NULL,
  provider_email varchar(255),
  access_token text,
  refresh_token text,
  avatar_url text,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS oauth_accounts_user_idx ON oauth_accounts (user_id);
CREATE INDEX IF NOT EXISTS oauth_accounts_provider_idx ON oauth_accounts (provider, provider_user_id);

-- Email Verification Tokens 表
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  email varchar(255) NOT NULL,
  token varchar(128) NOT NULL UNIQUE,
  expires_at timestamp NOT NULL,
  verified_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS email_verification_tokens_token_idx ON email_verification_tokens (token);
CREATE INDEX IF NOT EXISTS email_verification_tokens_user_idx ON email_verification_tokens (user_id);

-- Multi-Agent Teams 表
CREATE TABLE IF NOT EXISTS ma_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(128) NOT NULL,
  description text DEFAULT '',
  team_type ma_team_type DEFAULT 'custom' NOT NULL,
  agents jsonb DEFAULT '[]' NOT NULL,
  workflow jsonb DEFAULT '[]' NOT NULL,
  user_id uuid,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ma_teams_user_idx ON ma_teams (user_id);
CREATE INDEX IF NOT EXISTS ma_teams_type_idx ON ma_teams (team_type);

-- Multi-Agent Runs 表
CREATE TABLE IF NOT EXISTS ma_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES ma_teams(id) ON DELETE SET NULL,
  goal text NOT NULL,
  status ma_run_status DEFAULT 'pending' NOT NULL,
  total_stages integer DEFAULT 0 NOT NULL,
  completed_stages integer DEFAULT 0 NOT NULL,
  total_steps integer DEFAULT 0 NOT NULL,
  completed_steps integer DEFAULT 0 NOT NULL,
  final_answer text,
  error text,
  duration_ms integer,
  started_at timestamp,
  completed_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ma_runs_team_idx ON ma_runs (team_id);
CREATE INDEX IF NOT EXISTS ma_runs_status_idx ON ma_runs (status);
CREATE INDEX IF NOT EXISTS ma_runs_created_at_idx ON ma_runs (created_at);

-- Multi-Agent Steps 表
CREATE TABLE IF NOT EXISTS ma_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES ma_runs(id) ON DELETE CASCADE,
  stage_index integer NOT NULL,
  step_index integer NOT NULL,
  agent_role varchar(64) NOT NULL,
  agent_name varchar(128) NOT NULL,
  status ma_step_status DEFAULT 'pending' NOT NULL,
  input text,
  output text,
  duration_ms integer,
  error text,
  started_at timestamp,
  completed_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ma_steps_run_idx ON ma_steps (run_id);
CREATE INDEX IF NOT EXISTS ma_steps_stage_idx ON ma_steps (run_id, stage_index);
