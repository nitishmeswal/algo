import type { Order } from '../types'

/**
 * Client-side “base” filter: case-insensitive substring match across common row fields.
 * Empty / whitespace-only query returns all orders.
 */
export function filterOrdersByTextQuery(orders: Order[], query: string): Order[] {
  const q = query.trim().toLowerCase()
  if (!q) return orders

  return orders.filter((o) => {
    const parts: string[] = [
      String(o.id),
      o.clientOrderId ?? '',
      o.symbol,
      o.side,
      o.status,
      o.timeInForce,
      o.venue ?? '',
      o.account ?? '',
      o.counterparty ?? '',
      o.rejectionReason ?? '',
      String(o.quantity),
      o.limitPrice != null ? String(o.limitPrice) : '',
      o.averageFillPrice != null ? String(o.averageFillPrice) : '',
      String(o.filledQuantity),
      String(o.pnl),
    ]
    return parts.some((p) => p.toLowerCase().includes(q))
  })
}
