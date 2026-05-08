import { Router } from 'express'
import { z } from 'zod'

import type { OrderAuditEventRow, OrderRow } from '../db/models.js'
import { listAuditEventsByOrderId } from '../db/repos/auditRepo.js'
import { findOrderById, insertOrderWithAudit, listOrders } from '../db/repos/ordersRepo.js'

const router = Router()

function orderRowToJson(row: OrderRow) {
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

type ValidationErrorResponse = {
  error: 'validation_error'
  message: string
}

type ConflictResponse = {
  error: 'conflict'
  message: string
}

const submitOrderSchema = z
  .object({
    clientOrderId: z.string().trim().min(1).max(64).optional(),
    symbol: z.string().trim().min(1).max(16),
    side: z.enum(['buy', 'sell']),
    quantity: z.number().int().positive(),
    orderType: z.enum(['market', 'limit', 'stop', 'stop_limit']).optional(),
    limitPrice: z.number().finite().positive().optional(),
    stopPrice: z.number().finite().positive().optional(),
    timeInForce: z.enum(['day', 'gtc', 'gtd', 'ioc', 'fok', 'at_open', 'at_close']),
    expireAt: z.string().trim().min(1).optional(),
    venue: z.string().trim().min(1).max(64).optional(),
    account: z.string().trim().min(1).max(64).optional(),
    counterparty: z.string().trim().min(1).max(64).optional(),
    strategyTag: z.string().trim().max(48).optional(),
    displayQuantity: z.number().int().positive().optional(),
  })
  .superRefine((v, ctx) => {
    const ot = v.orderType ?? 'limit'
    const requiresLimit = ot === 'limit' || ot === 'stop_limit'
    if (requiresLimit && v.limitPrice == null) {
      ctx.addIssue({ code: 'custom', message: 'limitPrice is required for limit/stop_limit', path: ['limitPrice'] })
    }
    const requiresStop = ot === 'stop' || ot === 'stop_limit'
    if (requiresStop && v.stopPrice == null) {
      ctx.addIssue({ code: 'custom', message: 'stopPrice is required for stop/stop_limit', path: ['stopPrice'] })
    }
    if (v.timeInForce === 'gtd') {
      if (!v.expireAt) {
        ctx.addIssue({ code: 'custom', message: 'expireAt is required when timeInForce is gtd', path: ['expireAt'] })
      } else if (Number.isNaN(Date.parse(v.expireAt))) {
        ctx.addIssue({ code: 'custom', message: 'expireAt must be a valid datetime', path: ['expireAt'] })
      }
    }
    if (v.displayQuantity != null && v.displayQuantity > v.quantity) {
      ctx.addIssue({ code: 'custom', message: 'displayQuantity cannot exceed quantity', path: ['displayQuantity'] })
    }
  })

router.get('/', async (_req, res, next) => {
  try {
    const rows = await listOrders()
    const payload: OrdersListResponse = { rowCount: rows.length, orders: rows.map(orderRowToJson) }
    res.status(200).json(payload)
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const parsed = submitOrderSchema.safeParse(req.body)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      const payload: ValidationErrorResponse = {
        error: 'validation_error',
        message: first?.message ?? 'Invalid order payload',
      }
      res.status(400).json(payload)
      return
    }
    const row = await insertOrderWithAudit(parsed.data)
    const payload: OrderByIdResponse = { order: orderRowToJson(row) }
    res.status(201).json(payload)
  } catch (err) {
    const pgCode = (err as { code?: string })?.code
    if (pgCode === '23505') {
      const payload: ConflictResponse = {
        error: 'conflict',
        message: 'client_order_id already exists',
      }
      res.status(409).json(payload)
      return
    }
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
