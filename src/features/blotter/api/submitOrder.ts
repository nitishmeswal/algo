import { useBlotterStore } from '../store/useBlotterStore'
import {
  orderId,
  streamSequence,
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
  quantity: number
  limitPrice?: number
  timeInForce: TimeInForce
  venue?: string
}

function nextSequence() {
  const last = useBlotterStore.getState().lastStreamSequence
  const n = last == null ? 1 : Number(last) + 1
  return streamSequence(n)
}

function buildOrder(payload: OrderEntryPayload): Order {
  const t = isoNow()
  const id = orderId(`ord_form_${Date.now()}`)
  return {
    id,
    clientOrderId: `cl_${id}`,
    symbol: payload.symbol.trim().toUpperCase(),
    side: payload.side,
    quantity: payload.quantity,
    limitPrice: payload.limitPrice,
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
