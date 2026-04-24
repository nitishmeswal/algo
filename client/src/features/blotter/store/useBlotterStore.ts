import { create } from 'zustand'
import { mapEventToAudit } from '../audit/mapEventToAudit'
import type { AuditTrailEntry } from '../audit/types'
import type { BlotterStreamEvent, Order, OrderId, StreamSequence } from '../types'

/** Max audit lines kept per order to bound memory during long sessions. */
export const MAX_AUDIT_ENTRIES_PER_ORDER = 200

export type BlotterState = {
  ordersById: Record<OrderId, Order>
  orderIds: OrderId[]
  selectedOrderId: OrderId | null
  eventCount: number
  lastHeartbeatAt: string | null
  lastStreamSequence: StreamSequence | null
  /** Append-only audit lines keyed by order; derived from ingested stream events. */
  auditByOrderId: Record<OrderId, AuditTrailEntry[]>
  ingestEvent: (event: BlotterStreamEvent) => void
  selectOrder: (id: OrderId | null) => void
  reset: () => void
}

type BlotterSnapshot = Pick<
  BlotterState,
  'ordersById' | 'orderIds' | 'eventCount' | 'lastHeartbeatAt' | 'lastStreamSequence'
>

const emptySnapshot: BlotterSnapshot = {
  ordersById: {} as Record<OrderId, Order>,
  orderIds: [] as OrderId[],
  eventCount: 0,
  lastHeartbeatAt: null,
  lastStreamSequence: null,
}

const emptyAudit: Record<OrderId, AuditTrailEntry[]> = {}

function appendAuditEntries(
  auditByOrderId: Record<OrderId, AuditTrailEntry[]>,
  entries: AuditTrailEntry[],
): Record<OrderId, AuditTrailEntry[]> {
  if (entries.length === 0) return auditByOrderId
  const next: Record<OrderId, AuditTrailEntry[]> = { ...auditByOrderId }
  for (const e of entries) {
    const existing = next[e.orderId] ?? []
    const merged = [...existing, e]
    next[e.orderId] =
      merged.length > MAX_AUDIT_ENTRIES_PER_ORDER
        ? merged.slice(merged.length - MAX_AUDIT_ENTRIES_PER_ORDER)
        : merged
  }
  return next
}

/** Order snapshot before applying `event`, for audit diffing. */
function prevOrderForAudit(state: BlotterState, event: BlotterStreamEvent): Order | undefined {
  switch (event.type) {
    case 'heartbeat':
    case 'order_created':
      return undefined
    case 'order_updated':
    case 'order_cancelled':
    case 'order_rejected':
      return state.ordersById[event.orderId]
  }
}

// idempotent insertion, when the network misbehaves
function appendOrderId(ids: OrderId[], id: OrderId): OrderId[] {
  return ids.includes(id) ? ids : [...ids, id]
}

export function applyBlotterEvent(snapshot: BlotterSnapshot, event: BlotterStreamEvent): BlotterSnapshot {
  const seqMeta: Pick<BlotterSnapshot, 'eventCount' | 'lastStreamSequence'> = {
    eventCount: snapshot.eventCount + 1,
    lastStreamSequence: event.sequence,
  }

  switch (event.type) {
    case 'heartbeat':
      return {
        ...snapshot,
        ...seqMeta,
        lastHeartbeatAt: event.emittedAt,
      }

    case 'order_created': {
      const { order } = event
      return {
        ...snapshot,
        ...seqMeta,
        ordersById: { ...snapshot.ordersById, [order.id]: order },
        orderIds: appendOrderId(snapshot.orderIds, order.id),
      }
    }

    case 'order_updated': {
      const prev = snapshot.ordersById[event.orderId]
      if (!prev) {
        return { ...snapshot, ...seqMeta }
      }
      const merged: Order = {
        ...prev,
        ...event.patch,
        id: prev.id,
      }
      return {
        ...snapshot,
        ...seqMeta,
        ordersById: { ...snapshot.ordersById, [event.orderId]: merged },
      }
    }

    case 'order_cancelled': {
      const prev = snapshot.ordersById[event.orderId]
      if (!prev) {
        return { ...snapshot, ...seqMeta }
      }
      const merged: Order = {
        ...prev,
        status: 'cancelled',
        updatedAt: event.emittedAt,
        rejectionReason: undefined,
      }
      return {
        ...snapshot,
        ...seqMeta,
        ordersById: { ...snapshot.ordersById, [event.orderId]: merged },
      }
    }

    case 'order_rejected': {
      const prev = snapshot.ordersById[event.orderId]
      if (!prev) {
        return { ...snapshot, ...seqMeta }
      }
      const merged: Order = {
        ...prev,
        status: 'rejected',
        updatedAt: event.emittedAt,
        rejectionReason: event.reason,
      }
      return {
        ...snapshot,
        ...seqMeta,
        ordersById: { ...snapshot.ordersById, [event.orderId]: merged },
      }
    }
  }
}

export const useBlotterStore = create<BlotterState>((set) => ({
  ...emptySnapshot,
  auditByOrderId: emptyAudit,
  selectedOrderId: null,
  ingestEvent: (event) =>
    set((state) => {
      const prevOrder = prevOrderForAudit(state, event)
      const entries = mapEventToAudit(event, prevOrder)
      return {
        ...state,
        ...applyBlotterEvent(
          {
            ordersById: state.ordersById,
            orderIds: state.orderIds,
            eventCount: state.eventCount,
            lastHeartbeatAt: state.lastHeartbeatAt,
            lastStreamSequence: state.lastStreamSequence,
          },
          event,
        ),
        auditByOrderId: appendAuditEntries(state.auditByOrderId, entries),
      }
    }),
  selectOrder: (id) => set({ selectedOrderId: id }),
  reset: () =>
    set({
      ...emptySnapshot,
      auditByOrderId: emptyAudit,
      selectedOrderId: null,
    }),
}))

export function selectOrdersInStoreOrder(state: BlotterState): Order[] {
  return state.orderIds.map((id) => state.ordersById[id]).filter(Boolean)
}
