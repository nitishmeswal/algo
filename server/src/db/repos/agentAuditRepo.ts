import { dbPool } from '../connection.js'

const MAX_JSON_CHARS = 65_000

/** Row shape from `agent_audit_log` (read path). */
export type AgentAuditLogRow = {
  id: string
  created_at: Date
  event_type: string
  session_id: string | null
  user_id: string | null
  order_id: string | null
  input_text: string | null
  filter_query: string | null
  filter_result: unknown | null
  tool_name: string | null
  tool_input: unknown | null
  tool_output: unknown | null
  tool_status: string | null
  decision: string | null
  decision_reason: string | null
  breach_type: string | null
  breach_value: string | null
  breach_threshold: string | null
  llm_insight: string | null
  duration_ms: number | null
  model_used: string | null
  payload: unknown | null
}

const AGENT_AUDIT_SELECT_COLUMNS = `
  id, created_at, event_type, session_id, user_id, order_id,
  input_text, filter_query, filter_result,
  tool_name, tool_input, tool_output, tool_status,
  decision, decision_reason,
  breach_type, breach_value, breach_threshold,
  llm_insight, duration_ms, model_used, payload
`

/** Agentic / NLP rows tied to an order, oldest first (capped). */
export async function listAgentAuditLogsByOrderId(orderId: string, limit = 500): Promise<AgentAuditLogRow[]> {
  const result = await dbPool.query<AgentAuditLogRow>(
    `
    SELECT ${AGENT_AUDIT_SELECT_COLUMNS}
    FROM agent_audit_log
    WHERE order_id = $1
    ORDER BY created_at ASC
    LIMIT $2
    `,
    [orderId, limit],
  )
  return result.rows
}

/** Terminal trade-booking agent rows (`agent_decision`), newest first. */
export type AgentDecisionAuditRow = {
  id: string
  created_at: Date
  session_id: string | null
  order_id: string | null
  decision: string | null
  decision_reason: string | null
  payload: unknown | null
}

export async function listAgentDecisionsRecent(limit = 50): Promise<AgentDecisionAuditRow[]> {
  const result = await dbPool.query<AgentDecisionAuditRow>(
    `
    SELECT id, created_at, session_id, order_id, decision, decision_reason, payload
    FROM agent_audit_log
    WHERE event_type = 'agent_decision'
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [limit],
  )
  return result.rows
}

export type AgentAuditEventType =
  | 'nlp_filter'
  | 'breach_detected'
  | 'breach_insight'
  | 'agent_tool_call'
  | 'agent_decision'

export type InsertAgentAuditLogInput = {
  eventType: AgentAuditEventType
  sessionId?: string | null
  userId?: string | null
  orderId?: string | null
  inputText?: string | null
  filterQuery?: string | null
  filterResult?: unknown | null
  toolName?: string | null
  toolInput?: unknown | null
  toolOutput?: unknown | null
  toolStatus?: string | null
  decision?: string | null
  decisionReason?: string | null
  breachType?: string | null
  breachValue?: number | null
  breachThreshold?: number | null
  llmInsight?: string | null
  durationMs?: number | null
  modelUsed?: string | null
  payload?: unknown | null
}

function jsonParam(value: unknown): string | null {
  if (value === undefined || value === null) return null
  let s: string
  try {
    s = JSON.stringify(value)
  } catch {
    return JSON.stringify({ error: 'unserializable_payload' })
  }
  if (s.length > MAX_JSON_CHARS) {
    return JSON.stringify({ truncated: true, preview: s.slice(0, MAX_JSON_CHARS) })
  }
  return s
}

/** Persists one row to `agent_audit_log`. */
export async function insertAgentAuditLog(input: InsertAgentAuditLogInput): Promise<void> {
  await dbPool.query(
    `
    INSERT INTO agent_audit_log (
      event_type, session_id, user_id, order_id,
      input_text, filter_query, filter_result,
      tool_name, tool_input, tool_output, tool_status,
      decision, decision_reason,
      breach_type, breach_value, breach_threshold,
      llm_insight, duration_ms, model_used, payload
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7::jsonb,
      $8, $9::jsonb, $10::jsonb, $11,
      $12, $13,
      $14, $15, $16,
      $17, $18, $19, $20::jsonb
    )
    `,
    [
      input.eventType,
      input.sessionId ?? null,
      input.userId ?? null,
      input.orderId ?? null,
      input.inputText ?? null,
      input.filterQuery ?? null,
      jsonParam(input.filterResult),
      input.toolName ?? null,
      jsonParam(input.toolInput),
      jsonParam(input.toolOutput),
      input.toolStatus ?? null,
      input.decision ?? null,
      input.decisionReason ?? null,
      input.breachType ?? null,
      input.breachValue ?? null,
      input.breachThreshold ?? null,
      input.llmInsight ?? null,
      input.durationMs ?? null,
      input.modelUsed ?? null,
      jsonParam(input.payload),
    ],
  )
}

export function insertAgentAuditLogFireAndForget(input: InsertAgentAuditLogInput): void {
  void insertAgentAuditLog(input).catch((err) => {
    console.error('[agent_audit_log] insert failed', err)
  })
}
