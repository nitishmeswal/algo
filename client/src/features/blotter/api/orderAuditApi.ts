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

/** Successful JSON body from `GET /orders/:id/audit`. */
export type OrderAuditApiResponse = {
  orderId: string
  rowCount: number
  events: OrderAuditEventDto[]
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
  return { orderId, rowCount, events }
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
