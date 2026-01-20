-- Elio OS Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============ Workflow Runs ============
-- Stores execution history of all workflow runs

CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_name TEXT NOT NULL,
  trigger TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  input JSONB DEFAULT '{}',
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER GENERATED ALWAYS AS (
    CASE WHEN completed_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000
    END
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_runs_workflow ON workflow_runs(workflow_name);
CREATE INDEX idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX idx_workflow_runs_created ON workflow_runs(created_at DESC);

-- ============ Scheduled Tasks ============
-- Schedule definitions for recurring workflows

CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  workflow_name TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('once', 'hourly', 'daily', 'weekly', 'cron')),
  cron_expression TEXT,
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ,
  last_run_id UUID REFERENCES workflow_runs(id),
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_tasks_next_run ON scheduled_tasks(next_run_at) WHERE enabled = true;
CREATE INDEX idx_scheduled_tasks_workflow ON scheduled_tasks(workflow_name);

-- ============ Messages (Inbox) ============
-- All incoming messages from various sources

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL CHECK (source IN ('telegram', 'email', 'slack', 'web')),
  external_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  action_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, external_id)
);

CREATE INDEX idx_messages_unprocessed ON messages(source, created_at) WHERE processed = false;
CREATE INDEX idx_messages_sender ON messages(sender);

-- ============ Tasks (GTD) ============
-- Task management

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox', 'next', 'waiting', 'someday', 'done')),
  context TEXT,
  project TEXT,
  due_date DATE,
  scheduled_date DATE,
  completed_at TIMESTAMPTZ,
  source_message_id UUID REFERENCES messages(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_status ON tasks(status) WHERE status != 'done';
CREATE INDEX idx_tasks_due ON tasks(due_date) WHERE due_date IS NOT NULL AND status != 'done';
CREATE INDEX idx_tasks_project ON tasks(project) WHERE project IS NOT NULL;

-- ============ People (CRM) ============
-- Contact management

CREATE TABLE IF NOT EXISTS people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  role TEXT,
  linkedin_url TEXT,
  telegram_id TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  last_contact_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_people_name ON people(name);
CREATE INDEX idx_people_company ON people(company) WHERE company IS NOT NULL;
CREATE INDEX idx_people_email ON people(email) WHERE email IS NOT NULL;
CREATE INDEX idx_people_telegram ON people(telegram_id) WHERE telegram_id IS NOT NULL;

-- ============ Conversation Memory ============
-- Long-term conversation history

CREATE TABLE IF NOT EXISTS conversation_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversation_session ON conversation_memory(session_id, created_at);

-- ============ System State ============
-- Key-value store for system state

CREATE TABLE IF NOT EXISTS system_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ Functions ============

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER trigger_scheduled_tasks_updated
  BEFORE UPDATE ON scheduled_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_tasks_updated
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_people_updated
  BEFORE UPDATE ON people
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ Views ============

-- Daily runs summary
CREATE OR REPLACE VIEW daily_runs_summary AS
SELECT
  DATE(created_at) as date,
  workflow_name,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE status = 'running') as running,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL) as avg_duration_ms
FROM workflow_runs
GROUP BY DATE(created_at), workflow_name
ORDER BY date DESC, workflow_name;

-- Active tasks view
CREATE OR REPLACE VIEW active_tasks AS
SELECT * FROM tasks
WHERE status NOT IN ('done', 'someday')
ORDER BY
  CASE priority
    WHEN 'urgent' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  due_date NULLS LAST,
  created_at;

-- ============ Row Level Security ============
-- Enable RLS for production use

ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_state ENABLE ROW LEVEL SECURITY;

-- Policies for service role (full access)
CREATE POLICY "Service role full access" ON workflow_runs FOR ALL USING (true);
CREATE POLICY "Service role full access" ON scheduled_tasks FOR ALL USING (true);
CREATE POLICY "Service role full access" ON messages FOR ALL USING (true);
CREATE POLICY "Service role full access" ON tasks FOR ALL USING (true);
CREATE POLICY "Service role full access" ON people FOR ALL USING (true);
CREATE POLICY "Service role full access" ON conversation_memory FOR ALL USING (true);
CREATE POLICY "Service role full access" ON system_state FOR ALL USING (true);

-- Grant access to service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
