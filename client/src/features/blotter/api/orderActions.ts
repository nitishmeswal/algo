import { useBlotterStore } from '../store/useBlotterStore'
import { orderId, streamSequence, type Order, type OrderCancelledEvent, type OrderUpdatedEvent } from '../types'

const ACTION_DELAY_MS = 450

function isoNow(): string {
  return new Date().toISOString()
}

function nextSequence() {
  const last = useBlotterStore.getState().lastStreamSequence
  const n = last == null ? 1 : Number(last) + 1
  return streamSequence(n)
}

/** Rows that can still be cancelled or amended in the mock (terminal fills / prior cancels / rejects excluded). */
export function isOrderOpenForAction(o: Order): boolean {
  return o.status !== 'filled' && o.status !== 'cancelled' && o.status !== 'rejected'
}

/**
 * Fake API: after a short delay, emits `order_cancelled` for each id that still exists and is open.
 * @returns How many cancel events were applied.
 */
export function cancelOrders(rawIds: readonly string[]): Promise<number> {
  const ids = rawIds.map((id) => orderId(id))
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        let applied = 0
        for (const id of ids) {
          const order = useBlotterStore.getState().ordersById[id]
          if (!order || !isOrderOpenForAction(order)) continue
          const event: OrderCancelledEvent = {
            type: 'order_cancelled',
            orderId: id,
            reason: 'User cancelled',
            sequence: nextSequence(),
            emittedAt: isoNow(),
            source: 'live',
          }
          useBlotterStore.getState().ingestEvent(event)
          applied += 1
        }
        resolve(applied)
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    }, ACTION_DELAY_MS)
  })
}

export type AmendOrderPayload = {
  limitPrice?: number
  quantity: number
}

/**
 * Fake API: emits `order_updated` with a new limit and/or total quantity (must remain ≥ filled qty).
 */
export function amendOrder(orderIdStr: string, payload: AmendOrderPayload): Promise<void> {
  const id = orderId(orderIdStr)
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const order = useBlotterStore.getState().ordersById[id]
        if (!order || !isOrderOpenForAction(order)) {
          resolve()
          return
        }
        if (!Number.isFinite(payload.quantity) || payload.quantity < 1) {
          reject(new Error('Invalid quantity'))
          return
        }
        if (payload.quantity < order.filledQuantity) {
          reject(new Error('Quantity cannot be below filled quantity'))
          return
        }
        const t = isoNow()
        const patch: OrderUpdatedEvent['patch'] = {
          quantity: payload.quantity,
          updatedAt: t,
        }
        if (typeof payload.limitPrice === 'number' && Number.isFinite(payload.limitPrice)) {
          patch.limitPrice = Math.round(payload.limitPrice * 100) / 100
        }
        const event: OrderUpdatedEvent = {
          type: 'order_updated',
          orderId: id,
          patch,
          sequence: nextSequence(),
          emittedAt: t,
          source: 'live',
        }
        useBlotterStore.getState().ingestEvent(event)
        resolve()
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    }, ACTION_DELAY_MS)
  })
}
