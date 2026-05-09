import { Router } from 'express'

import type { OrderAuditEventRow } from '../db/models.js'
import { listAuditEventsByOrderId } from '../db/repos/auditRepo.js'
import { findOrderById, listOrders } from '../db/repos/ordersRepo.js'
import { createOrderFromValidatedSubmit } from '../orders/createOrderFromValidatedSubmit.js'
import { submitOrderBodySchema } from '../../../shared/nlp/submitOrderBody.js'

import { orderRowToJson } from './orderDto.js'

const router = Router()

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
    const parsed = submitOrderBodySchema.safeParse(req.body)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      const payload: ValidationErrorResponse = {
        error: 'validation_error',
        message: first?.message ?? 'Invalid order payload',
      }
      res.status(400).json(payload)
      return
    }
    const row = await createOrderFromValidatedSubmit(parsed.data)
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
