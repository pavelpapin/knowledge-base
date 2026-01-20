-- Elio OS Extended Schema
-- Additional tables for full AI OS functionality

-- ============ Skill Executions ============
-- Track all skill runs with parameters and output

CREATE TABLE IF NOT EXISTS skill_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  skill_name TEXT NOT NULL,
  parameters JSONB DEFAULT '{}',
  output JSONB,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'error')),
  error TEXT,
  duration_ms INTEGER,
  triggered_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_skill_executions_skill ON skill_executions(skill_name);
CREATE INDEX idx_skill_executions_status ON skill_executions(status);
CREATE INDEX idx_skill_executions_created ON skill_executions(created_at DESC);

-- ============ Audit Log ============
-- Security and tracking for all operations

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  user_id TEXT,
  details JSONB DEFAULT '{}',
  result TEXT NOT NULL CHECK (result IN ('success', 'failure', 'blocked')),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_result ON audit_log(result) WHERE result != 'success';

-- ============ Self-Improvement Logs ============
-- Track corrections and improvements

CREATE TABLE IF NOT EXISTS improvements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('factual', 'style', 'preference', 'technical', 'context', 'tone', 'format')),
  original TEXT NOT NULL,
  corrected TEXT NOT NULL,
  reasoning TEXT,
  impact_area TEXT,
  applied BOOLEAN DEFAULT false,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_improvements_type ON improvements(type);
CREATE INDEX idx_improvements_applied ON improvements(applied) WHERE applied = false;
CREATE INDEX idx_improvements_created ON improvements(created_at DESC);

-- ============ Knowledge Graph: Entities ============
-- Named entities extracted from conversations

CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('person', 'company', 'project', 'concept', 'event', 'location', 'tool')),
  aliases TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  mention_count INTEGER DEFAULT 1,
  first_mentioned TIMESTAMPTZ DEFAULT NOW(),
  last_mentioned TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, type)
);

CREATE INDEX idx_entities_name ON entities(name);
CREATE INDEX idx_entities_type ON entities(type);
CREATE INDEX idx_entities_mention ON entities(mention_count DESC);

-- ============ Knowledge Graph: Relationships ============
-- Connections between entities

CREATE TABLE IF NOT EXISTS relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  strength FLOAT DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, target_id, type)
);

CREATE INDEX idx_relationships_source ON relationships(source_id);
CREATE INDEX idx_relationships_target ON relationships(target_id);
CREATE INDEX idx_relationships_type ON relationships(type);

-- ============ Integration State ============
-- Track state for external integrations

CREATE TABLE IF NOT EXISTS integration_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_name TEXT NOT NULL UNIQUE,
  state JSONB DEFAULT '{}',
  last_sync TIMESTAMPTZ,
  next_sync TIMESTAMPTZ,
  error TEXT,
  error_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_integration_name ON integration_state(integration_name);
CREATE INDEX idx_integration_sync ON integration_state(next_sync) WHERE next_sync IS NOT NULL;

-- ============ Content Artifacts ============
-- Generated documents, reports, code

CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('document', 'code', 'report', 'email_draft', 'summary', 'research')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  format TEXT DEFAULT 'markdown',
  metadata JSONB DEFAULT '{}',
  source_execution_id UUID,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_artifacts_type ON artifacts(type);
CREATE INDEX idx_artifacts_created ON artifacts(created_at DESC);
CREATE INDEX idx_artifacts_tags ON artifacts USING GIN(tags);

-- ============ Apply RLS to new tables ============

ALTER TABLE skill_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE improvements ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON skill_executions FOR ALL USING (true);
CREATE POLICY "Service role full access" ON audit_log FOR ALL USING (true);
CREATE POLICY "Service role full access" ON improvements FOR ALL USING (true);
CREATE POLICY "Service role full access" ON entities FOR ALL USING (true);
CREATE POLICY "Service role full access" ON relationships FOR ALL USING (true);
CREATE POLICY "Service role full access" ON integration_state FOR ALL USING (true);
CREATE POLICY "Service role full access" ON artifacts FOR ALL USING (true);

-- ============ Useful Views ============

-- Skills summary
CREATE OR REPLACE VIEW skill_summary AS
SELECT
  skill_name,
  COUNT(*) as total_runs,
  COUNT(*) FILTER (WHERE status = 'success') as success_count,
  COUNT(*) FILTER (WHERE status = 'error') as error_count,
  AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL) as avg_duration_ms,
  MAX(created_at) as last_run
FROM skill_executions
GROUP BY skill_name
ORDER BY total_runs DESC;

-- Entity connections (graph view)
CREATE OR REPLACE VIEW entity_connections AS
SELECT
  e1.name as source_name,
  e1.type as source_type,
  r.type as relationship_type,
  e2.name as target_name,
  e2.type as target_type,
  r.strength
FROM relationships r
JOIN entities e1 ON r.source_id = e1.id
JOIN entities e2 ON r.target_id = e2.id
ORDER BY r.strength DESC;

-- Recent improvements to apply
CREATE OR REPLACE VIEW pending_improvements AS
SELECT * FROM improvements
WHERE applied = false
ORDER BY created_at DESC;

-- Integration health
CREATE OR REPLACE VIEW integration_health AS
SELECT
  integration_name,
  last_sync,
  next_sync,
  error_count,
  CASE
    WHEN error_count > 5 THEN 'critical'
    WHEN error_count > 0 THEN 'warning'
    WHEN last_sync IS NULL THEN 'unknown'
    WHEN last_sync < NOW() - INTERVAL '1 day' THEN 'stale'
    ELSE 'healthy'
  END as health_status
FROM integration_state
ORDER BY error_count DESC, last_sync DESC NULLS LAST;

-- Grant access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
