import { Router } from 'express'

import type { OrderAuditEventRow, OrderRow } from '../db/models.js'
import { listAuditEventsByOrderId } from '../db/repos/auditRepo.js'
import { findOrderById, listOrders } from '../db/repos/ordersRepo.js'

const router = Router()

function orderRowToJson(row: OrderRow) {
  return {
    id: row.id,
    clientOrderId: row.client_order_id ?? '',
    symbol: row.symbol,
    side: row.side,
    quantity: row.quantity,
    limitPrice: row.limit_price != null ? Number(row.limit_price) : undefined,
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

type OrderDto = ReturnType<typeof orderRowToJson>

type OrdersListResponse = {
  rowCount: number
  orders: OrderDto[]
}

type OrderByIdResponse = {
  order: OrderDto
}

type AuditEventDto = {
  id: string
  orderId: string
  sequence: number
  eventType: string
  source: string
  emittedAt: string
  summary: string
  reason: string | null
  patch: Record<string, unknown> | null
  orderSnapshot: Record<string, unknown> | null
  createdAt: string
}

function auditEventRowToJson(row: OrderAuditEventRow): AuditEventDto {
  const seq = row.sequence
  const sequence = typeof seq === 'bigint' ? Number(seq) : typeof seq === 'string' ? Number(seq) : seq
  return {
    id: row.id,
    orderId: row.order_id,
    sequence,
    eventType: row.event_type,
    source: row.source,
    emittedAt: row.emitted_at.toISOString(),
    summary: row.summary,
    reason: row.reason,
    patch: row.patch_json,
    orderSnapshot: row.order_snapshot_json,
    createdAt: row.created_at.toISOString(),
  }
}

type OrderAuditResponse = {
  orderId: string
  rowCount: number
  events: AuditEventDto[]
}

type NotFoundResponse = {
  error: 'not_found'
  message: string
}

router.get('/', async (_req, res, next) => {
  try {
    const rows = await listOrders()
    const payload: OrdersListResponse = { rowCount: rows.length, orders: rows.map(orderRowToJson) }
    res.status(200).json(payload)
  } catch (err) {
    next(err)
  }
})

router.get('/:id/audit', async (req, res, next) => {
  try {
    const orderId = req.params.id
    const order = await findOrderById(orderId)
    if (!order) {
      const payload: NotFoundResponse = { error: 'not_found', message: 'Order not found' }
      res.status(404).json(payload)
      return
    }
    const rows = await listAuditEventsByOrderId(orderId)
    const payload: OrderAuditResponse = {
      orderId,
      rowCount: rows.length,
      events: rows.map(auditEventRowToJson),
    }
    res.status(200).json(payload)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const row = await findOrderById(req.params.id)
    if (!row) {
      const payload: NotFoundResponse = { error: 'not_found', message: 'Order not found' }
      res.status(404).json(payload)
      return
    }
    const payload: OrderByIdResponse = { order: orderRowToJson(row) }
    res.status(200).json(payload)
  } catch (err) {
    next(err)
  }
})

export const ordersRouter = router
