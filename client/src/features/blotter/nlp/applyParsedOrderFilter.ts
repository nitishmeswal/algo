import type { ParsedOrderFilter } from './parsedOrderFilter'
import type { Order } from '../types'
import { isParsedOrderFilterEmpty } from './parsedOrderFilter'

function norm(s: string): string {
  return s.trim().toLowerCase()
}

/** Row-level predicate for a validated `ParsedOrderFilter` (AND across set fields). */
export function orderMatchesParsedFilter(order: Order, f: ParsedOrderFilter): boolean {
  if (isParsedOrderFilterEmpty(f)) return true

  if (f.symbol != null && norm(order.symbol) !== norm(f.symbol)) return false
  if (f.side != null && order.side !== f.side) return false
  if (f.status != null && f.status.length > 0 && !f.status.includes(order.status)) return false
  if (f.timeInForce != null && f.timeInForce.length > 0 && !f.timeInForce.includes(order.timeInForce)) return false
  if (f.venue != null && norm(order.venue ?? '') !== norm(f.venue)) return false
  if (f.account != null && norm(order.account ?? '') !== norm(f.account)) return false
  if (f.counterparty != null && norm(order.counterparty ?? '') !== norm(f.counterparty)) return false
  if (f.clientOrderId != null && norm(order.clientOrderId ?? '') !== norm(f.clientOrderId)) return false

  if (f.idContains != null && !String(order.id).toLowerCase().includes(f.idContains.trim().toLowerCase())) return false
  if (
    f.rejectionReasonContains != null &&
    !(order.rejectionReason ?? '').toLowerCase().includes(f.rejectionReasonContains.trim().toLowerCase())
  ) {
    return false
  }

  if (f.quantityMin != null && order.quantity < f.quantityMin) return false
  if (f.quantityMax != null && order.quantity > f.quantityMax) return false
  if (f.filledQuantityMin != null && order.filledQuantity < f.filledQuantityMin) return false
  if (f.filledQuantityMax != null && order.filledQuantity > f.filledQuantityMax) return false

  if (f.limitPriceMin != null) {
    const px = order.limitPrice
    if (px == null || px < f.limitPriceMin) return false
  }
  if (f.limitPriceMax != null) {
    const px = order.limitPrice
    if (px == null || px > f.limitPriceMax) return false
  }

  if (f.pnlMin != null && order.pnl < f.pnlMin) return false
  if (f.pnlMax != null && order.pnl > f.pnlMax) return false

  const created = Date.parse(order.createdAt)
  if (f.createdAtOrAfter != null && (Number.isNaN(created) || created < Date.parse(f.createdAtOrAfter))) return false
  if (f.createdAtOrBefore != null && (Number.isNaN(created) || created > Date.parse(f.createdAtOrBefore))) return false

  const updated = Date.parse(order.updatedAt)
  if (f.updatedAtOrAfter != null && (Number.isNaN(updated) || updated < Date.parse(f.updatedAtOrAfter))) return false
  if (f.updatedAtOrBefore != null && (Number.isNaN(updated) || updated > Date.parse(f.updatedAtOrBefore))) return false

  return true
}

/** Pre-filter: returns only rows matching the structured filter (empty filter → full list). */
export function filterOrdersByParsedFilter(orders: Order[], f: ParsedOrderFilter | null): Order[] {
  if (f == null || isParsedOrderFilterEmpty(f)) return orders
  return orders.filter((o) => orderMatchesParsedFilter(o, f))
}
