import type { PoolClient } from 'pg'

import { dbPool } from '../connection.js'
import type { OrderRow } from '../models.js'

/** CamelCase stream order shape → DB row (snake_case columns). */
export type StreamOrderSnapshot = {
  id: string
  clientOrderId: string
  symbol: string
  side: string
  quantity: number
  limitPrice?: number
  filledQuantity: number
  averageFillPrice?: number
  pnl: number
  status: string
  timeInForce: string
  venue: string
  account: string
  counterparty: string
  createdAt: string
  updatedAt: string
}

export async function upsertOrderFromCreated(client: PoolClient, order: StreamOrderSnapshot): Promise<void> {
  await client.query(
    `
    INSERT INTO orders (
      id, client_order_id, symbol, side, quantity, limit_price, filled_quantity, average_fill_price,
      pnl, status, time_in_force, venue, account, counterparty, rejection_reason, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NULL, $15::TIMESTAMPTZ, $16::TIMESTAMPTZ
    )
    ON CONFLICT (id) DO UPDATE SET
      client_order_id = EXCLUDED.client_order_id,
      symbol = EXCLUDED.symbol,
      side = EXCLUDED.side,
      quantity = EXCLUDED.quantity,
      limit_price = EXCLUDED.limit_price,
      filled_quantity = EXCLUDED.filled_quantity,
      average_fill_price = EXCLUDED.average_fill_price,
      pnl = EXCLUDED.pnl,
      status = EXCLUDED.status,
      time_in_force = EXCLUDED.time_in_force,
      venue = EXCLUDED.venue,
      account = EXCLUDED.account,
      counterparty = EXCLUDED.counterparty,
      updated_at = EXCLUDED.updated_at
    `,
    [
      order.id,
      order.clientOrderId,
      order.symbol,
      order.side,
      order.quantity,
      order.limitPrice ?? null,
      order.filledQuantity,
      order.averageFillPrice ?? null,
      order.pnl,
      order.status,
      order.timeInForce,
      order.venue,
      order.account,
      order.counterparty,
      order.createdAt,
      order.updatedAt,
    ],
  )
}

const patchKeyToColumn: Record<string, string> = {
  clientOrderId: 'client_order_id',
  symbol: 'symbol',
  side: 'side',
  quantity: 'quantity',
  limitPrice: 'limit_price',
  filledQuantity: 'filled_quantity',
  averageFillPrice: 'average_fill_price',
  pnl: 'pnl',
  status: 'status',
  timeInForce: 'time_in_force',
  venue: 'venue',
  account: 'account',
  counterparty: 'counterparty',
  rejectionReason: 'rejection_reason',
  updatedAt: 'updated_at',
}

export async function applyOrderPatch(client: PoolClient, orderId: string, patch: Record<string, unknown>): Promise<void> {
  const assignments: string[] = []
  const values: unknown[] = []
  let i = 1

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const column = patchKeyToColumn[key]
    if (!column) continue
    if (column === 'updated_at') {
      assignments.push(`${column} = $${i}::TIMESTAMPTZ`)
      values.push(String(value))
    } else {
      assignments.push(`${column} = $${i}`)
      values.push(value)
    }
    i += 1
  }

  if (assignments.length === 0) return

  values.push(orderId)
  const idParam = `$${i}`
  await client.query(`UPDATE orders SET ${assignments.join(', ')} WHERE id = ${idParam}`, values)
}

export async function markOrderCancelled(client: PoolClient, orderId: string, _reason: string | null): Promise<void> {
  await client.query(
    `
    UPDATE orders
    SET status = 'cancelled', rejection_reason = NULL, updated_at = NOW()
    WHERE id = $1
    `,
    [orderId],
  )
}

export async function markOrderRejected(client: PoolClient, orderId: string, reason: string): Promise<void> {
  await client.query(
    `
    UPDATE orders
    SET status = 'rejected', rejection_reason = $2, updated_at = NOW()
    WHERE id = $1
    `,
    [orderId, reason],
  )
}

const ORDERS_SELECT_COLUMNS = `
  id, client_order_id, symbol, side, quantity, limit_price, filled_quantity, average_fill_price,
  pnl, status, time_in_force, venue, account, counterparty, rejection_reason, created_at, updated_at
`

export async function listOrders(): Promise<OrderRow[]> {
  const result = await dbPool.query<OrderRow>(
    `SELECT ${ORDERS_SELECT_COLUMNS} FROM orders ORDER BY updated_at DESC`,
  )
  return result.rows
}

export async function findOrderById(id: string): Promise<OrderRow | undefined> {
  const result = await dbPool.query<OrderRow>(
    `SELECT ${ORDERS_SELECT_COLUMNS} FROM orders WHERE id = $1`,
    [id],
  )
  return result.rows[0]
}
