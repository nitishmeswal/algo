import { useEffect, useState } from 'react'
import { useBlotterStore } from '../store/useBlotterStore'
import { orderId, type Order, type OrderStatus, type Side, type TimeInForce } from '../types'

export type BlotterLiveBootstrapStatus = 'idle' | 'loading' | 'ready' | 'error'

const SIDES: readonly Side[] = ['buy', 'sell']

const ORDER_STATUSES: readonly OrderStatus[] = [
  'pending_new',
  'new',
  'partially_filled',
  'filled',
  'cancelled',
  'rejected',
  'replaced',
]

const TIME_IN_FORCE: readonly TimeInForce[] = ['day', 'gtc', 'gtd', 'ioc', 'fok', 'at_open', 'at_close']

function isSide(v: unknown): v is Side {
  return typeof v === 'string' && (SIDES as readonly string[]).includes(v)
}

function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === 'string' && (ORDER_STATUSES as readonly string[]).includes(v)
}

function isTimeInForce(v: unknown): v is TimeInForce {
  return typeof v === 'string' && (TIME_IN_FORCE as readonly string[]).includes(v)
}

function emptyToOptionalString(v: unknown): string | undefined {
  if (v == null) return undefined
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t === '' ? undefined : t
}

function coerceFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const t = v.trim()
    if (t === '') return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function coerceInt(v: unknown): number | null {
  const n = coerceFiniteNumber(v)
  if (n === null) return null
  return Number.isInteger(n) ? n : Math.trunc(n)
}

function optionalNumber(v: unknown): number | undefined {
  if (v == null) return undefined
  const n = coerceFiniteNumber(v)
  return n === null ? undefined : n
}

function requiredString(v: unknown): string | null {
  if (typeof v !== 'string' || v.trim() === '') return null
  return v
}

function requiredIdOrSymbol(v: unknown): string | null {
  if (typeof v === 'string' && v.trim() !== '') return v.trim()
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return null
}

function parseOrderDto(raw: unknown, index: number): Order | string {
  if (raw === null || typeof raw !== 'object') {
    return `Order at index ${index} is not an object`
  }
  const o = raw as Record<string, unknown>

  const idStr = requiredIdOrSymbol(o.id)
  if (!idStr) return `Order at index ${index}: missing id`

  const symbol = requiredIdOrSymbol(o.symbol)
  if (!symbol) return `Order at index ${index}: missing symbol`

  if (!isSide(o.side)) return `Order at index ${index}: invalid side`
  if (!isOrderStatus(o.status)) return `Order at index ${index}: invalid status`
  if (!isTimeInForce(o.timeInForce)) return `Order at index ${index}: invalid timeInForce`

  const quantity = coerceInt(o.quantity)
  const filledQuantity = coerceInt(o.filledQuantity)
  const pnl = coerceFiniteNumber(o.pnl)
  if (quantity == null) return `Order at index ${index}: invalid quantity`
  if (filledQuantity == null) return `Order at index ${index}: invalid filledQuantity`
  if (pnl == null) return `Order at index ${index}: invalid pnl`

  const createdAt = requiredString(o.createdAt)
  const updatedAt = requiredString(o.updatedAt)
  if (!createdAt) return `Order at index ${index}: missing createdAt`
  if (!updatedAt) return `Order at index ${index}: missing updatedAt`

  const order: Order = {
    id: orderId(idStr),
    symbol,
    side: o.side as Side,
    quantity,
    filledQuantity,
    pnl,
    status: o.status as OrderStatus,
    timeInForce: o.timeInForce as TimeInForce,
    createdAt,
    updatedAt,
  }

  const clientOrderId = emptyToOptionalString(o.clientOrderId)
  if (clientOrderId) order.clientOrderId = clientOrderId

  const limitPrice = optionalNumber(o.limitPrice)
  if (limitPrice !== undefined) order.limitPrice = limitPrice

  const averageFillPrice = optionalNumber(o.averageFillPrice)
  if (averageFillPrice !== undefined) order.averageFillPrice = averageFillPrice

  const venue = emptyToOptionalString(o.venue)
  if (venue) order.venue = venue

  const account = emptyToOptionalString(o.account)
  if (account) order.account = account

  const counterparty = emptyToOptionalString(o.counterparty)
  if (counterparty) order.counterparty = counterparty

  const rejectionReason = emptyToOptionalString(o.rejectionReason)
  if (rejectionReason) order.rejectionReason = rejectionReason

  return order
}

function parseOrdersListResponse(json: unknown): { ok: true; orders: Order[] } | { ok: false; message: string } {
  if (json === null || typeof json !== 'object') {
    return { ok: false, message: 'Response is not a JSON object' }
  }
  const body = json as Record<string, unknown>
  if (!Array.isArray(body.orders)) {
    return { ok: false, message: 'Missing or invalid "orders" array' }
  }
  const orders: Order[] = []
  for (let i = 0; i < body.orders.length; i += 1) {
    const row = parseOrderDto(body.orders[i], i)
    if (typeof row === 'string') return { ok: false, message: row }
    orders.push(row)
  }
  // Trust `orders` length for hydration; `rowCount` is optional metadata from the API.
  const rc = body.rowCount
  if (
    (typeof rc === 'number' && Number.isFinite(rc) && rc !== orders.length) ||
    (typeof rc === 'string' && Number.isFinite(Number(rc)) && Number(rc) !== orders.length)
  ) {
    console.warn(
      `[blotter-bootstrap] rowCount (${String(rc)}) !== orders.length (${orders.length}); using orders array`,
    )
  }
  return { ok: true, orders }
}

/** Same-origin `/orders` when unset (use Vite proxy in dev), or `VITE_BLOTTER_HTTP_URL` + `/orders`. */
export function getBlotterOrdersListUrl(): string {
  const base = (import.meta.env.VITE_BLOTTER_HTTP_URL as string | undefined)?.trim() ?? ''
  if (!base) return '/orders'
  return `${base.replace(/\/$/, '')}/orders`
}

/**
 * When `enabled` is true (live WebSocket mode), fetches `GET /orders`, hydrates the store, then exposes
 * `ready` so callers can open the socket. When `enabled` is false, stays `idle` and does not fetch.
 */
export function useBlotterLiveBootstrap(enabled: boolean): {
  status: BlotterLiveBootstrapStatus
  error: string | null
} {
  const [status, setStatus] = useState<BlotterLiveBootstrapStatus>(() => (enabled ? 'loading' : 'idle'))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      const idleTimer = window.setTimeout(() => {
        setStatus('idle')
        setError(null)
      }, 0)
      return () => window.clearTimeout(idleTimer)
    }

    const ac = new AbortController()

    const run = async () => {
      await Promise.resolve()
      if (ac.signal.aborted) return
      setStatus('loading')
      setError(null)
      try {
        const res = await fetch(getBlotterOrdersListUrl(), { signal: ac.signal })
        if (ac.signal.aborted) return
        if (!res.ok) {
          setStatus('error')
          setError(`HTTP ${res.status}`)
          return
        }
        const json: unknown = await res.json()
        if (ac.signal.aborted) return
        const parsed = parseOrdersListResponse(json)
        if (parsed.ok === false) {
          setStatus('error')
          setError(parsed.message)
          return
        }
        useBlotterStore.getState().hydrateOrdersFromApi(parsed.orders)
        if (!ac.signal.aborted) {
          setStatus('ready')
        }
      } catch (e) {
        if (ac.signal.aborted) return
        const msg =
          e instanceof DOMException && e.name === 'AbortError'
            ? null
            : e instanceof Error
              ? e.message
              : 'Fetch failed'
        if (msg === null) return
        setStatus('error')
        setError(msg)
      }
    }

    void run()

    return () => {
      ac.abort()
    }
  }, [enabled])

  return { status, error }
}
