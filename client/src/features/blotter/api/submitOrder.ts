import { useBlotterStore } from '../store/useBlotterStore'
import {
  orderId,
  streamSequence,
  type Order,
  type OrderCreatedEvent,
  type OrderType,
  type Side,
  type TimeInForce,
} from '../types'
import { getBlotterOrdersListUrl } from '../realtime/useBlotterLiveBootstrap'

/** Raw shape from Ant form values (validated before submit). */
export type OrderEntryPayload = {
  account?: string
  counterparty?: string
  symbol: string
  side: Side
  orderType?: OrderType
  quantity: number
  limitPrice?: number
  stopPrice?: number
  timeInForce: TimeInForce
  expireAt?: string
  venue?: string
  /** Optional ClOrdID; when empty, a synthetic id is generated. */
  clientOrderId?: string
  strategyTag?: string
  displayQuantity?: number
}

function nextSequence() {
  const last = useBlotterStore.getState().lastStreamSequence
  const n = last == null ? 1 : Number(last) + 1
  return streamSequence(n)
}

type OrderDto = {
  id: string
  clientOrderId?: string
  symbol: string
  side: Side
  orderType?: OrderType
  quantity: number
  limitPrice?: number
  stopPrice?: number
  expireAt?: string
  strategyTag?: string
  displayQuantity?: number
  filledQuantity: number
  averageFillPrice?: number
  pnl: number
  status: Order['status']
  timeInForce: TimeInForce
  venue?: string
  account?: string
  counterparty?: string
  rejectionReason?: string
  createdAt: string
  updatedAt: string
}

function asNonEmpty(s: unknown): string | undefined {
  if (typeof s !== 'string') return undefined
  const t = s.trim()
  return t === '' ? undefined : t
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function parseOrderDto(raw: unknown): Order | null {
  // TODO: use zod to validate and coerce the POST /orders `order` payload into client Order shape.
  if (!isRecord(raw)) return null
  if (
    typeof raw.id !== 'string' ||
    typeof raw.symbol !== 'string' ||
    (raw.side !== 'buy' && raw.side !== 'sell') ||
    typeof raw.quantity !== 'number' ||
    typeof raw.filledQuantity !== 'number' ||
    typeof raw.pnl !== 'number' ||
    typeof raw.status !== 'string' ||
    typeof raw.timeInForce !== 'string' ||
    typeof raw.createdAt !== 'string' ||
    typeof raw.updatedAt !== 'string'
  ) {
    return null
  }
  const order: Order = {
    id: orderId(raw.id),
    symbol: raw.symbol,
    side: raw.side,
    quantity: raw.quantity,
    filledQuantity: raw.filledQuantity,
    pnl: raw.pnl,
    status: raw.status as Order['status'],
    timeInForce: raw.timeInForce as TimeInForce,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
  if (typeof raw.orderType === 'string') order.orderType = raw.orderType as OrderType
  if (typeof raw.clientOrderId === 'string') {
    const v = asNonEmpty(raw.clientOrderId)
    if (v) order.clientOrderId = v
  }
  if (typeof raw.limitPrice === 'number') order.limitPrice = raw.limitPrice
  if (typeof raw.stopPrice === 'number') order.stopPrice = raw.stopPrice
  if (typeof raw.expireAt === 'string') {
    const v = asNonEmpty(raw.expireAt)
    if (v) order.expireAt = v
  }
  if (typeof raw.strategyTag === 'string') {
    const v = asNonEmpty(raw.strategyTag)
    if (v) order.strategyTag = v
  }
  if (typeof raw.displayQuantity === 'number') order.displayQuantity = raw.displayQuantity
  if (typeof raw.averageFillPrice === 'number') order.averageFillPrice = raw.averageFillPrice
  if (typeof raw.venue === 'string') {
    const v = asNonEmpty(raw.venue)
    if (v) order.venue = v
  }
  if (typeof raw.account === 'string') {
    const v = asNonEmpty(raw.account)
    if (v) order.account = v
  }
  if (typeof raw.counterparty === 'string') {
    const v = asNonEmpty(raw.counterparty)
    if (v) order.counterparty = v
  }
  if (typeof raw.rejectionReason === 'string') {
    const v = asNonEmpty(raw.rejectionReason)
    if (v) order.rejectionReason = v
  }
  return order
}

/** Submit via HTTP API, then merge returned row into local store. */
export async function submitOrder(payload: OrderEntryPayload): Promise<void> {
  const normalizedOrderType = payload.orderType ?? 'limit'
  const body: OrderEntryPayload = {
    ...payload,
    orderType: normalizedOrderType,
    symbol: payload.symbol.trim().toUpperCase(),
    account: asNonEmpty(payload.account),
    counterparty: asNonEmpty(payload.counterparty),
    venue: asNonEmpty(payload.venue),
    strategyTag: asNonEmpty(payload.strategyTag),
    clientOrderId: asNonEmpty(payload.clientOrderId),
    limitPrice: normalizedOrderType === 'market' || normalizedOrderType === 'stop' ? undefined : payload.limitPrice,
    stopPrice: normalizedOrderType === 'stop' || normalizedOrderType === 'stop_limit' ? payload.stopPrice : undefined,
    expireAt: payload.timeInForce === 'gtd' ? asNonEmpty(payload.expireAt) : undefined,
  }

  const res = await fetch(getBlotterOrdersListUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    json = null
  }

  if (!res.ok) {
    const msg =
      isRecord(json) && typeof json.message === 'string' && json.message.trim() !== ''
        ? json.message
        : `HTTP ${res.status}`
    throw new Error(msg)
  }

  // TODO: use zod to parse the full submit response envelope (`{ order: ... }`) instead of manual guards.
  if (!isRecord(json) || !isRecord(json.order)) {
    throw new Error('Invalid submit response')
  }
  const order = parseOrderDto(json.order as OrderDto)
  if (!order) throw new Error('Invalid submit response')

  const event: OrderCreatedEvent = {
    type: 'order_created',
    order,
    sequence: nextSequence(),
    emittedAt: order.updatedAt,
    source: 'live',
  }
  useBlotterStore.getState().ingestEvent(event)
}
