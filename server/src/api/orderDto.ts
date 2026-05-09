import type { OrderRow } from '../db/models.js'

export function orderRowToJson(row: OrderRow) {
  return {
    id: row.id,
    clientOrderId: row.client_order_id ?? '',
    symbol: row.symbol,
    side: row.side,
    quantity: row.quantity,
    orderType: row.order_type ?? undefined,
    limitPrice: row.limit_price != null ? Number(row.limit_price) : undefined,
    stopPrice: row.stop_price != null ? Number(row.stop_price) : undefined,
    expireAt: row.expire_at ? row.expire_at.toISOString() : undefined,
    strategyTag: row.strategy_tag ?? undefined,
    displayQuantity: row.display_quantity ?? undefined,
    filledQuantity: row.filled_quantity,
    averageFillPrice: row.average_fill_price != null ? Number(row.average_fill_price) : undefined,
    pnl: Number(row.pnl),
    status: row.status,
    timeInForce: row.time_in_force,
    venue: row.venue ?? '',
    account: row.account ?? '',
    counterparty: row.counterparty ?? '',
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export type OrderDto = ReturnType<typeof orderRowToJson>
