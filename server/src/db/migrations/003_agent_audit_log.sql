-- Agentic / NLP / breach audit log (separate from order_audit_events).
-- Run after 001_init / 002_order_submit_fields. Inserts wired in a follow-up change.

CREATE TABLE IF NOT EXISTS agent_audit_log (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  event_type TEXT NOT NULL,
  -- Examples: nlp_filter | breach_detected | breach_insight | agent_tool_call | agent_decision

  session_id TEXT,
  user_id TEXT,

  order_id TEXT REFERENCES orders (id) ON DELETE SET NULL,

  input_text TEXT,
  filter_query TEXT,
  filter_result JSONB,

  tool_name TEXT,
  tool_input JSONB,
  tool_output JSONB,
  tool_status TEXT,

  decision TEXT,
  decision_reason TEXT,

  breach_type TEXT,
  breach_value NUMERIC(20, 6),
  breach_threshold NUMERIC(20, 6),

  llm_insight TEXT,

  duration_ms INTEGER,
  model_used TEXT,

  payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_agent_audit_log_created_at
  ON agent_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_audit_log_order_id_created_at
  ON agent_audit_log (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_audit_log_session_id_created_at
  ON agent_audit_log (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_audit_log_event_type_created_at
  ON agent_audit_log (event_type, created_at DESC);
