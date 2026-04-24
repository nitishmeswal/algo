import type { OrderId, StreamSequence, StreamSource } from '../types'

/** High-level category for tree nodes and filtering. */
export type AuditTrailKind = 'created' | 'updated' | 'cancelled' | 'rejected'

/**
 * One append-only audit line for an order, derived from a {@link BlotterStreamEvent}.
 * Heartbeats do not produce entries.
 */
export type AuditTrailEntry = {
  /** Stable key; unique per ingested stream sequence for order-scoped events. */
  id: string
  orderId: OrderId
  emittedAt: string
  source: StreamSource
  sequence: StreamSequence
  kind: AuditTrailKind
  /** Human-readable line for the tree / table. */
  summary: string
}
