import type { BlotterStreamEvent, Order } from '../types'
import type { AuditTrailEntry } from './types'

function money(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function summarizeCreated(order: Order): string {
  const px =
    typeof order.limitPrice === 'number' ? `@ ${money(order.limitPrice)}` : 'MKT'
  return `Created · ${order.symbol} ${order.side.toUpperCase()} × ${order.quantity} ${px}`
}

function summarizePatch(prev: Order, patch: Partial<Omit<Order, 'id'>>): string {
  const parts: string[] = []

  if (patch.quantity !== undefined && patch.quantity !== prev.quantity) {
    parts.push(`qty ${prev.quantity} → ${patch.quantity}`)
  }
  if (patch.limitPrice !== undefined && patch.limitPrice !== prev.limitPrice) {
    const a = prev.limitPrice != null ? money(prev.limitPrice) : '—'
    const b = patch.limitPrice != null ? money(patch.limitPrice) : '—'
    parts.push(`limit ${a} → ${b}`)
  }
  if (patch.status !== undefined && patch.status !== prev.status) {
    parts.push(`status ${prev.status} → ${patch.status}`)
  }
  if (patch.filledQuantity !== undefined && patch.filledQuantity !== prev.filledQuantity) {
    parts.push(`filled ${prev.filledQuantity} → ${patch.filledQuantity}`)
  }
  if (patch.averageFillPrice !== undefined && patch.averageFillPrice !== prev.averageFillPrice) {
    parts.push(`avg px ${money(prev.averageFillPrice ?? 0)} → ${money(patch.averageFillPrice ?? 0)}`)
  }
  if (patch.pnl !== undefined && patch.pnl !== prev.pnl) {
    parts.push(`P&L ${money(prev.pnl)} → ${money(patch.pnl)}`)
  }
  if (patch.venue !== undefined && patch.venue !== prev.venue) {
    parts.push(`venue ${prev.venue ?? '—'} → ${patch.venue}`)
  }

  return parts.length > 0 ? `Updated · ${parts.join(' · ')}` : 'Updated'
}

/**
 * Maps a stream event to zero or one audit row. Heartbeats return an empty array.
 *
 * @param prevOrder Snapshot before this event is applied (undefined for `order_created` and if missing).
 */
export function mapEventToAudit(event: BlotterStreamEvent, prevOrder: Order | undefined): AuditTrailEntry[] {
  switch (event.type) {
    case 'heartbeat':
      return []

    case 'order_created': {
      const { order, emittedAt, source, sequence } = event
      return [
        {
          id: `audit-${Number(sequence)}`,
          orderId: order.id,
          emittedAt,
          source,
          sequence,
          kind: 'created',
          summary: summarizeCreated(order),
        },
      ]
    }

    case 'order_updated': {
      if (!prevOrder) {
        return [
          {
            id: `audit-${Number(event.sequence)}`,
            orderId: event.orderId,
            emittedAt: event.emittedAt,
            source: event.source,
            sequence: event.sequence,
            kind: 'updated',
            summary: 'Updated (no prior snapshot)',
          },
        ]
      }
      return [
        {
          id: `audit-${Number(event.sequence)}`,
          orderId: event.orderId,
          emittedAt: event.emittedAt,
          source: event.source,
          sequence: event.sequence,
          kind: 'updated',
          summary: summarizePatch(prevOrder, event.patch),
        },
      ]
    }

    case 'order_cancelled': {
      const reason = event.reason?.trim()
      return [
        {
          id: `audit-${Number(event.sequence)}`,
          orderId: event.orderId,
          emittedAt: event.emittedAt,
          source: event.source,
          sequence: event.sequence,
          kind: 'cancelled',
          summary: reason ? `Cancelled · ${reason}` : 'Cancelled',
        },
      ]
    }

    case 'order_rejected': {
      return [
        {
          id: `audit-${Number(event.sequence)}`,
          orderId: event.orderId,
          emittedAt: event.emittedAt,
          source: event.source,
          sequence: event.sequence,
          kind: 'rejected',
          summary: `Rejected · ${event.reason}`,
        },
      ]
    }

    default: {
      const _exhaustive: never = event
      return _exhaustive
    }
  }
}
