-- Elio OS: Backlog Items
-- Technical and Product backlog with Notion sync

-- ============ Backlog Items ============
-- Stores backlog tasks for CTO/CPO with Notion sync

CREATE TABLE IF NOT EXISTS backlog_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Core fields
  title TEXT NOT NULL,
  description TEXT,

  -- Classification
  backlog_type TEXT NOT NULL CHECK (backlog_type IN ('technical', 'product')),
  category TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog', 'in_progress', 'done', 'blocked', 'cancelled')),

  -- Estimation
  effort TEXT CHECK (effort IN ('xs', 's', 'm', 'l', 'xl')),
  impact TEXT CHECK (impact IN ('high', 'medium', 'low')),

  -- Source tracking
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('cto_review', 'cpo_review', 'user_feedback', 'manual', 'bug_report', 'correction_log')),
  source_quote TEXT,  -- Original user quote if from feedback

  -- Notion sync
  notion_page_id TEXT UNIQUE,
  notion_db_id TEXT,
  notion_synced_at TIMESTAMPTZ,
  notion_url TEXT,

  -- Metadata
  tags TEXT[] DEFAULT '{}',
  assignee TEXT,  -- 'cto', 'cpo', 'user', etc.

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_backlog_type ON backlog_items(backlog_type);
CREATE INDEX idx_backlog_status ON backlog_items(status) WHERE status NOT IN ('done', 'cancelled');
CREATE INDEX idx_backlog_priority ON backlog_items(priority);
CREATE INDEX idx_backlog_notion ON backlog_items(notion_page_id) WHERE notion_page_id IS NOT NULL;
CREATE INDEX idx_backlog_source ON backlog_items(source);

-- Trigger for updated_at
CREATE TRIGGER trigger_backlog_items_updated
  BEFORE UPDATE ON backlog_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE backlog_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON backlog_items FOR ALL USING (true);
GRANT ALL ON backlog_items TO service_role;

-- ============ Notion Sync Log ============
-- Track sync operations for debugging

CREATE TABLE IF NOT EXISTS notion_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,  -- 'backlog_item', 'report', etc.
  entity_id UUID NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('to_notion', 'from_notion')),
  notion_page_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_log_entity ON notion_sync_log(entity_type, entity_id);
CREATE INDEX idx_sync_log_created ON notion_sync_log(created_at DESC);

-- RLS
ALTER TABLE notion_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON notion_sync_log FOR ALL USING (true);
GRANT ALL ON notion_sync_log TO service_role;

-- ============ Views ============

-- Active backlog items view
CREATE OR REPLACE VIEW active_backlog AS
SELECT
  id,
  title,
  backlog_type,
  category,
  priority,
  status,
  effort,
  impact,
  source,
  notion_url,
  created_at,
  updated_at
FROM backlog_items
WHERE status NOT IN ('done', 'cancelled')
ORDER BY
  CASE priority
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  created_at DESC;

-- Backlog stats view
CREATE OR REPLACE VIEW backlog_stats AS
SELECT
  backlog_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'backlog') as backlog,
  COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
  COUNT(*) FILTER (WHERE status = 'done') as done,
  COUNT(*) FILTER (WHERE status = 'blocked') as blocked,
  COUNT(*) FILTER (WHERE priority IN ('critical', 'high')) as high_priority
FROM backlog_items
GROUP BY backlog_type;
