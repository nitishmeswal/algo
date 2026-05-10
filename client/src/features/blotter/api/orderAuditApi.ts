import { getBlotterOrdersListUrl } from '../realtime/useBlotterLiveBootstrap'

/** One persisted row from `GET /orders/:id/audit` (matches server `AuditEventDto`). */
export type OrderAuditEventDto = {
  id: string
  orderId: string
  sequence: number
  eventType: string
  source: string
  emittedAt: string
  summary: string
  reason: string | null
  patch: Record<string, unknown> | null
  orderSnapshot: Record<string, unknown> | null
  createdAt: string
}

/** One row from `agent_audit_log` returned with `GET /orders/:id/audit`. */
export type AgentAuditEventDto = {
  id: string
  orderId: string | null
  createdAt: string
  eventType: string
  sessionId: string | null
  userId: string | null
  inputText: string | null
  filterQuery: string | null
  filterResult: unknown | null
  toolName: string | null
  toolInput: unknown | null
  toolOutput: unknown | null
  toolStatus: string | null
  decision: string | null
  decisionReason: string | null
  breachType: string | null
  breachValue: string | null
  breachThreshold: string | null
  llmInsight: string | null
  durationMs: number | null
  modelUsed: string | null
  payload: unknown | null
}

/** Successful JSON body from `GET /orders/:id/audit`. */
export type OrderAuditApiResponse = {
  orderId: string
  rowCount: number
  events: OrderAuditEventDto[]
  agentEvents: AgentAuditEventDto[]
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function parseAuditEvent(raw: unknown): OrderAuditEventDto | null {
  if (!isRecord(raw)) return null
  const id = raw.id
  const orderId = raw.orderId
  const sequence = raw.sequence
  const eventType = raw.eventType
  const source = raw.source
  const emittedAt = raw.emittedAt
  const summary = raw.summary
  if (
    typeof id !== 'string' ||
    typeof orderId !== 'string' ||
    typeof sequence !== 'number' ||
    !Number.isFinite(sequence) ||
    typeof eventType !== 'string' ||
    typeof source !== 'string' ||
    typeof emittedAt !== 'string' ||
    typeof summary !== 'string'
  ) {
    return null
  }
  const reason = raw.reason
  const patch = raw.patch
  const orderSnapshot = raw.orderSnapshot
  const createdAt = raw.createdAt
  const reasonNorm: string | null = typeof reason === 'string' ? reason : null
  return {
    id,
    orderId,
    sequence,
    eventType,
    source,
    emittedAt,
    summary,
    reason: reasonNorm,
    patch: patch !== null && patch !== undefined && isRecord(patch) ? patch : null,
    orderSnapshot:
      orderSnapshot !== null && orderSnapshot !== undefined && isRecord(orderSnapshot) ? orderSnapshot : null,
    createdAt: typeof createdAt === 'string' ? createdAt : emittedAt,
  }
}

function parseJsonish(value: unknown): unknown | null {
  if (value === null || value === undefined) return null
  return value
}

function parseAgentAuditEvent(raw: unknown): AgentAuditEventDto | null {
  if (!isRecord(raw)) return null
  const id = raw.id
  const createdAt = raw.createdAt
  const eventType = raw.eventType
  if (typeof id !== 'string' || typeof createdAt !== 'string' || typeof eventType !== 'string') return null
  const orderId = raw.orderId
  const numOrNull = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
    return null
  }
  return {
    id,
    orderId: typeof orderId === 'string' ? orderId : null,
    createdAt,
    eventType,
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : null,
    userId: typeof raw.userId === 'string' ? raw.userId : null,
    inputText: typeof raw.inputText === 'string' ? raw.inputText : null,
    filterQuery: typeof raw.filterQuery === 'string' ? raw.filterQuery : null,
    filterResult: parseJsonish(raw.filterResult),
    toolName: typeof raw.toolName === 'string' ? raw.toolName : null,
    toolInput: parseJsonish(raw.toolInput),
    toolOutput: parseJsonish(raw.toolOutput),
    toolStatus: typeof raw.toolStatus === 'string' ? raw.toolStatus : null,
    decision: typeof raw.decision === 'string' ? raw.decision : null,
    decisionReason: typeof raw.decisionReason === 'string' ? raw.decisionReason : null,
    breachType: typeof raw.breachType === 'string' ? raw.breachType : null,
    breachValue: typeof raw.breachValue === 'string' ? raw.breachValue : null,
    breachThreshold: typeof raw.breachThreshold === 'string' ? raw.breachThreshold : null,
    llmInsight: typeof raw.llmInsight === 'string' ? raw.llmInsight : null,
    durationMs: numOrNull(raw.durationMs),
    modelUsed: typeof raw.modelUsed === 'string' ? raw.modelUsed : null,
    payload: parseJsonish(raw.payload),
  }
}

function parseOrderAuditResponse(json: unknown): OrderAuditApiResponse | null {
  if (!isRecord(json)) return null
  const orderId = json.orderId
  const rowCount = json.rowCount
  const eventsRaw = json.events
  if (
    typeof orderId !== 'string' ||
    typeof rowCount !== 'number' ||
    !Number.isFinite(rowCount) ||
    !Array.isArray(eventsRaw)
  ) {
    return null
  }
  const events: OrderAuditEventDto[] = []
  for (const row of eventsRaw) {
    const ev = parseAuditEvent(row)
    if (!ev) return null
    events.push(ev)
  }
  const agentEvents: AgentAuditEventDto[] = []
  const agentRaw = json.agentEvents
  if (Array.isArray(agentRaw)) {
    for (const row of agentRaw) {
      const a = parseAgentAuditEvent(row)
      if (!a) return null
      agentEvents.push(a)
    }
  }
  return { orderId, rowCount, events, agentEvents }
}

function orderAuditUrl(orderId: string): string {
  const base = getBlotterOrdersListUrl().replace(/\/$/, '')
  return `${base}/${encodeURIComponent(orderId)}/audit`
}

/**
 * Loads persisted audit events for one order (`GET /orders/:id/audit`).
 * Uses the same base URL as order list hydration (`VITE_BLOTTER_HTTP_URL` or same-origin `/orders`).
 */
export async function fetchOrderAudit(orderId: string): Promise<OrderAuditApiResponse> {
  const res = await fetch(orderAuditUrl(orderId))
  let json: unknown
  try {
    json = await res.json()
  } catch {
    json = null
  }

  if (res.status === 404) {
    const msg =
      isRecord(json) && typeof json.message === 'string' && json.message.trim() !== ''
        ? json.message
        : 'Order not found'
    throw new Error(msg)
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const parsed = parseOrderAuditResponse(json)
  if (!parsed) {
    throw new Error('Invalid audit response')
  }
  return parsed
}
