import { orderId, streamSequence, type Order, type OrderUpdatedEvent } from '../types'

const TARGET_SYMBOL = 'AAPL'
const TARGET_PNL_IMPACT = -30_000
const TARGET_RECOVERY_IMPACT = 35_000

function pickTargetOrder(orders: readonly Order[]): Order | null {
  if (orders.length === 0) return null
  const bySymbolAndSide = orders.find((o) => o.symbol.toUpperCase() === TARGET_SYMBOL && o.side === 'sell')
  if (bySymbolAndSide) return bySymbolAndSide
  const bySymbol = orders.find((o) => o.symbol.toUpperCase() === TARGET_SYMBOL)
  if (bySymbol) return bySymbol
  const bySide = orders.find((o) => o.side === 'sell')
  if (bySide) return bySide
  return orders[0] ?? null
}

/** Build a deterministic adverse fill update. P&L is recomputed from fill inputs (not hardcoded directly). */
export function buildSimulatedBreachEvent(
  orders: readonly Order[],
  lastSequence: number | null,
): OrderUpdatedEvent | null {
  const target = pickTargetOrder(orders)
  if (!target) return null

  const now = new Date().toISOString()
  const nextSequence = (lastSequence ?? 0) + 1

  const side = 'sell' as const
  const quantity = Math.max(target.quantity, 10_000)
  const nextFilledQty = Math.max(target.filledQuantity, Math.floor(quantity * 0.8))
  const limitRef = target.limitPrice ?? target.averageFillPrice ?? 175

  const nextPnl = target.pnl + TARGET_PNL_IMPACT
  const requiredAvgFillPx = limitRef + nextPnl / nextFilledQty
  const avgFillPrice = Math.max(0.01, Math.round(requiredAvgFillPx * 10_000) / 10_000)
  const recomputedPnl = Math.round((avgFillPrice - limitRef) * nextFilledQty * 100) / 100

  return {
    type: 'order_updated',
    orderId: orderId(String(target.id)),
    sequence: streamSequence(nextSequence),
    emittedAt: now,
    source: 'live',
    patch: {
      symbol: TARGET_SYMBOL,
      side,
      quantity,
      filledQuantity: nextFilledQty,
      limitPrice: limitRef,
      averageFillPrice: avgFillPrice,
      pnl: recomputedPnl,
      status: nextFilledQty >= quantity ? 'filled' : 'partially_filled',
      updatedAt: now,
    },
  }
}

/** Build a deterministic favorable fill update to normalize/recover aggregate P&L. */
export function buildSimulatedRecoveryEvent(
  orders: readonly Order[],
  lastSequence: number | null,
): OrderUpdatedEvent | null {
  const target = pickTargetOrder(orders)
  if (!target) return null

  const now = new Date().toISOString()
  const nextSequence = (lastSequence ?? 0) + 1

  const side = 'sell' as const
  const quantity = Math.max(target.quantity, 10_000)
  const nextFilledQty = Math.max(target.filledQuantity, Math.floor(quantity * 0.8))
  const limitRef = target.limitPrice ?? target.averageFillPrice ?? 175

  const nextPnl = target.pnl + TARGET_RECOVERY_IMPACT
  const requiredAvgFillPx = limitRef + nextPnl / nextFilledQty
  const avgFillPrice = Math.max(0.01, Math.round(requiredAvgFillPx * 10_000) / 10_000)
  const recomputedPnl = Math.round((avgFillPrice - limitRef) * nextFilledQty * 100) / 100

  return {
    type: 'order_updated',
    orderId: orderId(String(target.id)),
    sequence: streamSequence(nextSequence),
    emittedAt: now,
    source: 'live',
    patch: {
      symbol: TARGET_SYMBOL,
      side,
      quantity,
      filledQuantity: nextFilledQty,
      limitPrice: limitRef,
      averageFillPrice: avgFillPrice,
      pnl: recomputedPnl,
      status: nextFilledQty >= quantity ? 'filled' : 'partially_filled',
      updatedAt: now,
    },
  }
}
