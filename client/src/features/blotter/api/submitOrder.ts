import { createClientOrderId, createOrderId } from '../ids'
import { useBlotterStore } from '../store/useBlotterStore'
import {
  streamSequence,
  type OrderType,
  type Order,
  type OrderCreatedEvent,
  type Side,
  type TimeInForce,
} from '../types'

/** Simulated network latency before the blotter receives `order_created`. */
const SUBMIT_DELAY_MS = 450

function isoNow(): string {
  return new Date().toISOString()
}

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

function buildOrder(payload: OrderEntryPayload): Order {
  const t = isoNow()
  const rnd = () => Math.random()
  const id = createOrderId(rnd)
  const clientTrim = payload.clientOrderId?.trim()
  const strategyTag = payload.strategyTag?.trim()
  const normalizedOrderType = payload.orderType ?? 'limit'
  const limitPrice = normalizedOrderType === 'market' || normalizedOrderType === 'stop' ? undefined : payload.limitPrice
  const stopPrice = normalizedOrderType === 'stop' || normalizedOrderType === 'stop_limit' ? payload.stopPrice : undefined
  const expireAt = payload.timeInForce === 'gtd' && payload.expireAt ? new Date(payload.expireAt).toISOString() : undefined
  return {
    id,
    clientOrderId: clientTrim && clientTrim.length > 0 ? clientTrim : createClientOrderId(rnd),
    symbol: payload.symbol.trim().toUpperCase(),
    side: payload.side,
    orderType: normalizedOrderType,
    quantity: payload.quantity,
    limitPrice,
    stopPrice,
    expireAt,
    strategyTag: strategyTag && strategyTag.length > 0 ? strategyTag : undefined,
    displayQuantity: payload.displayQuantity,
    filledQuantity: 0,
    pnl: 0,
    status: 'new',
    timeInForce: payload.timeInForce,
    venue: payload.venue,
    account: payload.account?.trim() || undefined,
    counterparty: payload.counterparty?.trim() || undefined,
    createdAt: t,
    updatedAt: t,
  }
}

/**
 * Fake API: waits, then builds an `order_created` event and ingests it into the blotter store.
 */
export function submitOrder(payload: OrderEntryPayload): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const order = buildOrder(payload)
        const event: OrderCreatedEvent = {
          type: 'order_created',
          order,
          sequence: nextSequence(),
          emittedAt: isoNow(),
          source: 'live',
        }
        useBlotterStore.getState().ingestEvent(event)
        resolve()
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    }, SUBMIT_DELAY_MS)
  })
}
