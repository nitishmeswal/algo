/** Same-origin `/audit` when unset, or `VITE_BLOTTER_HTTP_URL` + `/audit`. */
export function getDeskAuditUrl(): string {
  const base = (import.meta.env.VITE_BLOTTER_HTTP_URL as string | undefined)?.trim() ?? ''
  if (!base) return '/audit'
  return `${base.replace(/\/$/, '')}/audit`
}

export type DeskAuditStreamFilter = 'orders' | 'agent' | 'breach' | 'nlp'

export type DeskAuditStreamQuery = 'all' | DeskAuditStreamFilter

export type DeskAuditSourceDto = 'LIVE' | 'BLOTTER' | 'AGENT'

export type DeskAuditRowDto = {
  id: string
  at: string
  stream: DeskAuditStreamFilter
  eventType: string
  summary: string
  source: DeskAuditSourceDto
  orderId: string | null
  sessionId: string | null
  agentDecisionOutcome: 'ok' | 'bad' | null
}

export type DeskAuditListResponse = {
  page: number
  pageSize: number
  hasMore: boolean
  rows: DeskAuditRowDto[]
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function parseRow(raw: unknown): DeskAuditRowDto | null {
  if (!isRecord(raw)) return null
  const id = raw.id
  const at = raw.at
  const stream = raw.stream
  const eventType = raw.eventType
  const summary = raw.summary
  const source = raw.source
  if (
    typeof id !== 'string' ||
    typeof at !== 'string' ||
    typeof stream !== 'string' ||
    typeof eventType !== 'string' ||
    typeof summary !== 'string' ||
    typeof source !== 'string'
  ) {
    return null
  }
  if (source !== 'LIVE' && source !== 'BLOTTER' && source !== 'AGENT') return null
  if (stream !== 'orders' && stream !== 'agent' && stream !== 'breach' && stream !== 'nlp') return null

  const orderId = raw.orderId
  const sessionId = raw.sessionId
  const agentDecisionOutcome = raw.agentDecisionOutcome
  return {
    id,
    at,
    stream,
    eventType,
    summary,
    source,
    orderId: typeof orderId === 'string' ? orderId : null,
    sessionId: typeof sessionId === 'string' ? sessionId : null,
    agentDecisionOutcome:
      agentDecisionOutcome === 'ok' || agentDecisionOutcome === 'bad' ? agentDecisionOutcome : null,
  }
}

export function parseDeskAuditListResponse(json: unknown): DeskAuditListResponse | null {
  if (!isRecord(json)) return null
  const page = json.page
  const pageSize = json.pageSize
  const hasMore = json.hasMore
  const rowsRaw = json.rows
  if (typeof page !== 'number' || typeof pageSize !== 'number' || typeof hasMore !== 'boolean' || !Array.isArray(rowsRaw)) {
    return null
  }
  const rows: DeskAuditRowDto[] = []
  for (const r of rowsRaw) {
    const parsed = parseRow(r)
    if (parsed) rows.push(parsed)
  }
  return { page, pageSize, hasMore, rows }
}

export async function fetchDeskAuditPage(params: {
  stream: DeskAuditStreamQuery
  page: number
  signal?: AbortSignal
}): Promise<DeskAuditListResponse> {
  const base = getDeskAuditUrl()
  const u = new URL(base, typeof window !== 'undefined' ? window.location.href : 'http://127.0.0.1/')
  u.searchParams.set('page', String(Math.max(1, params.page)))
  if (params.stream !== 'all') {
    u.searchParams.set('event_type', params.stream)
  }
  const res = await fetch(u.toString(), { signal: params.signal })
  if (!res.ok) {
    throw new Error(`Audit feed HTTP ${res.status}`)
  }
  const json: unknown = await res.json()
  const parsed = parseDeskAuditListResponse(json)
  if (!parsed) {
    throw new Error('Invalid audit feed response')
  }
  return parsed
}
