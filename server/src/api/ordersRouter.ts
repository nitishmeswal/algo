import { Router } from 'express'

import type { OrderRow } from '../db/models.js'
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
