import { dbPool } from '../connection.js'

/** Filter for `GET /audit?event_type=…` (omit or empty = all). */
export type DeskAuditStreamFilter = 'orders' | 'agent' | 'breach' | 'nlp'

export type DeskAuditMergedRow = {
  id: string
  ts: Date
  stream: string
  event_type: string
  raw_source: string
  summary: string
  order_id: string | null
  session_id: string | null
  tool_status: string | null
  decision: string | null
}

const STREAM_SQL = `
  WITH unioned AS (
    SELECT
      o.id::text AS id,
      o.emitted_at AS ts,
      'orders'::text AS stream,
      o.event_type::text AS event_type,
      o.source::text AS raw_source,
      o.summary AS summary,
      o.order_id::text AS order_id,
      NULL::text AS session_id,
      NULL::text AS tool_status,
      NULL::text AS decision
    FROM order_audit_events o
    WHERE o.event_type IS DISTINCT FROM 'heartbeat'

    UNION ALL

    SELECT
      a.id::text,
      a.created_at,
      CASE
        WHEN a.event_type = 'nlp_filter' THEN 'nlp'
        WHEN a.event_type IN ('breach_detected', 'breach_insight') THEN 'breach'
        ELSE 'agent'
      END,
      a.event_type::text,
      'agent'::text AS raw_source,
      CASE a.event_type
        WHEN 'agent_tool_call' THEN (COALESCE(a.tool_name, 'tool') || ' · ' || COALESCE(a.tool_status, '—'))
        WHEN 'agent_decision' THEN (
          CASE
            WHEN a.decision_reason IS NOT NULL AND btrim(a.decision_reason) <> '' THEN
              (COALESCE(a.decision, 'decision') || ' — ' || left(a.decision_reason, 160))
            ELSE COALESCE(a.decision, 'decision')
          END
        )
        WHEN 'nlp_filter' THEN ('Applied filter: ' || COALESCE(left(a.filter_query, 200), '—'))
        WHEN 'breach_detected' THEN (
          'Threshold crossed' || CASE WHEN a.breach_type IS NOT NULL THEN (' — ' || a.breach_type) ELSE '' END
        )
        WHEN 'breach_insight' THEN COALESCE(left(a.llm_insight, 240), 'Insight')
        ELSE a.event_type::text
      END,
      a.order_id::text,
      a.session_id::text,
      a.tool_status::text,
      a.decision::text
    FROM agent_audit_log a
  )
  SELECT id, ts, stream, event_type, raw_source, summary, order_id, session_id, tool_status, decision
  FROM unioned u
  WHERE ($1::text IS NULL OR u.stream = $1)
  ORDER BY u.ts DESC, u.id DESC
  LIMIT $2 OFFSET $3
`

export async function listDeskAuditMerged(params: {
  stream: DeskAuditStreamFilter | null
  limit: number
  offset: number
}): Promise<DeskAuditMergedRow[]> {
  const streamParam = params.stream ?? null
  const result = await dbPool.query<DeskAuditMergedRow>(STREAM_SQL, [streamParam, params.limit, params.offset])
  return result.rows
}
