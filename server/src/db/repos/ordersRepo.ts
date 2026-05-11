import type { PoolClient } from 'pg'
import { randomUUID } from 'node:crypto'

import { requirePool } from '../connection.js'
import type { OrderRow } from '../models.js'
import { tryInsertAuditEvent } from './auditRepo.js'

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

export type SubmitOrderInput = {
  clientOrderId?: string
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  orderType?: 'market' | 'limit' | 'stop' | 'stop_limit'
  limitPrice?: number
  stopPrice?: number
  timeInForce: 'day' | 'gtc' | 'gtd' | 'ioc' | 'fok' | 'at_open' | 'at_close'
  expireAt?: string
  venue?: string
  account?: string
  counterparty?: string
  strategyTag?: string
  displayQuantity?: number
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
  id, client_order_id, symbol, side, quantity, order_type, limit_price, stop_price, expire_at, strategy_tag, display_quantity,
  filled_quantity, average_fill_price, pnl, status, time_in_force, venue, account, counterparty, rejection_reason, created_at, updated_at
`

export async function insertOrderWithAudit(input: SubmitOrderInput): Promise<OrderRow> {
  const client = await requirePool().connect()
  const now = new Date()
  const id = randomUUID()
  const clientOrderId = input.clientOrderId?.trim() || randomUUID()
  const orderType = input.orderType ?? 'limit'
  const strategyTag = input.strategyTag?.trim() || null
  const venue = input.venue?.trim() || null
  const account = input.account?.trim() || null
  const counterparty = input.counterparty?.trim() || null
  const expireAt = input.expireAt?.trim() ? new Date(input.expireAt) : null
  const resultOrder = {
    id,
    clientOrderId,
    symbol: input.symbol.trim().toUpperCase(),
    side: input.side,
    quantity: input.quantity,
    orderType,
    limitPrice: input.limitPrice ?? null,
    stopPrice: input.stopPrice ?? null,
    expireAt,
    strategyTag,
    displayQuantity: input.displayQuantity ?? null,
    filledQuantity: 0,
    averageFillPrice: null,
    pnl: 0,
    status: 'new',
    timeInForce: input.timeInForce,
    venue,
    account,
    counterparty,
    rejectionReason: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
  try {
    await client.query('BEGIN')
    const inserted = await client.query<OrderRow>(
      `
      INSERT INTO orders (
        id, client_order_id, symbol, side, quantity, order_type, limit_price, stop_price, expire_at, strategy_tag, display_quantity,
        filled_quantity, average_fill_price, pnl, status, time_in_force, venue, account, counterparty, rejection_reason, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::TIMESTAMPTZ, $10, $11,
        0, NULL, 0, 'new', $12, $13, $14, $15, NULL, $16::TIMESTAMPTZ, $17::TIMESTAMPTZ
      )
      RETURNING ${ORDERS_SELECT_COLUMNS}
      `,
      [
        resultOrder.id,
        resultOrder.clientOrderId,
        resultOrder.symbol,
        resultOrder.side,
        resultOrder.quantity,
        resultOrder.orderType,
        resultOrder.limitPrice,
        resultOrder.stopPrice,
        resultOrder.expireAt ? resultOrder.expireAt.toISOString() : null,
        resultOrder.strategyTag,
        resultOrder.displayQuantity,
        resultOrder.timeInForce,
        resultOrder.venue,
        resultOrder.account,
        resultOrder.counterparty,
        resultOrder.createdAt,
        resultOrder.updatedAt,
      ],
    )

    const row = inserted.rows[0]
    if (!row) throw new Error('Insert failed: no row returned')

    const insertedAudit = await tryInsertAuditEvent(client, {
      id: randomUUID(),
      orderId: row.id,
      sequence: 1,
      eventType: 'order_created',
      source: 'live',
      emittedAt: now,
      summary: `Order created ${row.symbol} ${row.side} ${row.quantity}`,
      reason: null,
      patchJson: null,
      orderSnapshotJson: {
        id: row.id,
        clientOrderId: row.client_order_id ?? undefined,
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
        venue: row.venue ?? undefined,
        account: row.account ?? undefined,
        counterparty: row.counterparty ?? undefined,
        rejectionReason: row.rejection_reason ?? undefined,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      },
    })
    if (!insertedAudit) throw new Error('Insert failed: audit row not inserted')

    await client.query('COMMIT')
    return row
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function listOrders(): Promise<OrderRow[]> {
  const result = await requirePool().query<OrderRow>(
    `SELECT ${ORDERS_SELECT_COLUMNS} FROM orders ORDER BY updated_at DESC`,
  )
  return result.rows
}

export async function findOrderById(id: string): Promise<OrderRow | undefined> {
  const result = await requirePool().query<OrderRow>(
    `SELECT ${ORDERS_SELECT_COLUMNS} FROM orders WHERE id = $1`,
    [id],
  )
  return result.rows[0]
}
