import { randomUUID } from 'node:crypto'

import { dbPool } from './connection.js'
import { tryInsertAuditEvent } from './repos/auditRepo.js'
import {
  applyOrderPatch,
  markOrderCancelled,
  markOrderRejected,
  upsertOrderFromCreated,
  type StreamOrderSnapshot,
} from './repos/ordersRepo.js'

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function parseEmittedAt(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function snapshotFromUnknown(order: unknown): StreamOrderSnapshot | null {
  if (!isRecord(order)) return null
  const id = order.id
  const clientOrderId = order.clientOrderId
  const symbol = order.symbol
  const side = order.side
  const quantity = order.quantity
  const status = order.status
  const timeInForce = order.timeInForce
  const venue = order.venue
  const account = order.account
  const counterparty = order.counterparty
  const createdAt = order.createdAt
  const updatedAt = order.updatedAt
  const filledQuantity = order.filledQuantity
  const pnl = order.pnl
  if (
    typeof id !== 'string' ||
    typeof clientOrderId !== 'string' ||
    typeof symbol !== 'string' ||
    typeof side !== 'string' ||
    typeof quantity !== 'number' ||
    typeof status !== 'string' ||
    typeof timeInForce !== 'string' ||
    typeof venue !== 'string' ||
    typeof account !== 'string' ||
    typeof counterparty !== 'string' ||
    typeof createdAt !== 'string' ||
    typeof updatedAt !== 'string' ||
    typeof filledQuantity !== 'number' ||
    typeof pnl !== 'number'
  ) {
    return null
  }
  const snap: StreamOrderSnapshot = {
    id,
    clientOrderId,
    symbol,
    side,
    quantity,
    filledQuantity,
    pnl,
    status,
    timeInForce,
    venue,
    account,
    counterparty,
    createdAt,
    updatedAt,
  }
  if (typeof order.limitPrice === 'number') snap.limitPrice = order.limitPrice
  if (typeof order.averageFillPrice === 'number') snap.averageFillPrice = order.averageFillPrice
  return snap
}

async function projectInTransaction(event: Record<string, unknown>): Promise<void> {
  const type = event.type
  const sequence = event.sequence
  const source = event.source
  const emittedAtRaw = event.emittedAt

  if (type === 'heartbeat') return

  if (typeof type !== 'string' || typeof source !== 'string') return
  const sequenceNum =
    typeof sequence === 'number' && Number.isFinite(sequence)
      ? sequence
      : typeof sequence === 'string' && Number.isFinite(Number(sequence))
        ? Number(sequence)
        : NaN
  if (!Number.isFinite(sequenceNum)) return

  const emittedAt = parseEmittedAt(emittedAtRaw)
  if (emittedAt === null) return

  const client = await dbPool.connect()
  try {
    await client.query('BEGIN')

    if (type === 'order_created') {
      const order = snapshotFromUnknown(event.order)
      if (!order) {
        await client.query('ROLLBACK')
        return
      }
      await upsertOrderFromCreated(client, order)
      await tryInsertAuditEvent(client, {
        id: randomUUID(),
        orderId: order.id,
        sequence: sequenceNum,
        eventType: type,
        source,
        emittedAt,
        summary: 'Order created',
        reason: null,
        patchJson: null,
        orderSnapshotJson: order as unknown as Record<string, unknown>,
      })
      await client.query('COMMIT')
      return
    }

    const orderId =
      type === 'order_updated' || type === 'order_cancelled' || type === 'order_rejected'
        ? event.orderId
        : null
    if (typeof orderId !== 'string') {
      await client.query('ROLLBACK')
      return
    }

    const patchJson =
      type === 'order_updated' && isRecord(event.patch) ? (event.patch as Record<string, unknown>) : null
    const reason =
      type === 'order_cancelled' || type === 'order_rejected'
        ? typeof event.reason === 'string'
          ? event.reason
          : null
        : null

    const summary =
      type === 'order_updated'
        ? 'Order updated'
        : type === 'order_cancelled'
          ? 'Order cancelled'
          : type === 'order_rejected'
            ? 'Order rejected'
            : 'Stream event'

    const inserted = await tryInsertAuditEvent(client, {
      id: randomUUID(),
      orderId,
      sequence: sequenceNum,
      eventType: type,
      source,
      emittedAt,
      summary,
      reason,
      patchJson,
      orderSnapshotJson: null,
    })

    if (!inserted) {
      await client.query('COMMIT')
      return
    }

    if (type === 'order_updated') {
      if (patchJson) await applyOrderPatch(client, orderId, patchJson)
    } else if (type === 'order_cancelled') {
      await markOrderCancelled(client, orderId, reason)
    } else if (type === 'order_rejected') {
      await markOrderRejected(client, orderId, reason ?? 'Rejected')
    }

    await client.query('COMMIT')
  } catch (e) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // ignore rollback errors
    }
    throw e
  } finally {
    client.release()
  }
}

/** Persists one outbound blotter stream envelope into `orders` + `order_audit_events` (heartbeats skipped). */
export async function persistBlotterStreamEvent(event: unknown): Promise<void> {
  if (!isRecord(event)) return
  try {
    await projectInTransaction(event)
  } catch (err) {
    console.warn('[stream-projector] persist failed', err)
  }
}
