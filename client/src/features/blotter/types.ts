/**
 * Branded types over plain string — prevents accidentally passing any string where an OrderId is
 * specifically required, caught at compile time.
 */
/** Unique identifier for an order row in the blotter. */
export type OrderId = string & { readonly __brand: 'OrderId' }

/** Helper to explicitly cast raw strings to branded `OrderId`. */
export function orderId(value: string): OrderId {
  return value as OrderId
}

/** Buy or sell direction for an order. */
export type Side = 'buy' | 'sell'

/** Entry style for an order. */
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit'

/** Lifecycle states an order can move through in the blotter. */
export type OrderStatus =
  | 'pending_new'
  | 'new'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'rejected'
  | 'replaced'

/** Execution constraint defining how long an order remains active. */
export type TimeInForce = 'day' | 'gtc' | 'gtd' | 'ioc' | 'fok' | 'at_open' | 'at_close'

/** Canonical order snapshot as shown on the blotter and in detail views. */
export type Order = {
  id: OrderId
  clientOrderId?: string
  symbol: string
  side: Side
  orderType?: OrderType
  quantity: number
  /** Limit price; undefined for market-style orders in mocks. */
  limitPrice?: number
  /** Stop trigger for stop/stop-limit orders. */
  stopPrice?: number
  /** ISO timestamp when TIF=GTD. */
  expireAt?: string
  /** Optional attribution tag (desk/strategy bucket). */
  strategyTag?: string
  /** Visible quantity for iceberg-style behavior in demos. */
  displayQuantity?: number
  filledQuantity: number
  /** Volume-weighted average fill price when partially or fully filled. */
  averageFillPrice?: number
  /** Mark-to-market / realized P&L for the working position (USD). */
  pnl: number
  status: OrderStatus
  timeInForce: TimeInForce
  /** Venue or route label for display only. */
  venue?: string
  /** Trading / prime account or book the order belongs to. */
  account?: string
  /** Bilateral or disclosed counterparty when applicable (e.g. OTC, contra broker). */
  counterparty?: string
  /** Set when status is `rejected` (e.g. from `order_rejected` stream event). */
  rejectionReason?: string
  /** ISO 8601 timestamps from mock or real backend. */
  createdAt: string
  updatedAt: string
}

/** Monotonic sequence for ordering and deduping stream events. */
export type StreamSequence = number & { readonly __brand: 'StreamSequence' }

/** Helper to explicitly cast raw numbers to branded `StreamSequence`. */
export function streamSequence(value: number): StreamSequence {
  return value as StreamSequence
}

/** Identifies whether events come from test mocks or a real backend feed. */
export type StreamSource = 'mock' | 'live'

/** Common metadata attached to every stream event. */
export type StreamEnvelopeMeta = {
  sequence: StreamSequence
  emittedAt: string
  source: StreamSource
}

/** Order fully materialized (new row). */
export type OrderCreatedEvent = StreamEnvelopeMeta & {
  type: 'order_created'
  order: Order
}

/** Partial or full snapshot patch; server may send sparse fields. */
export type OrderUpdatedEvent = StreamEnvelopeMeta & {
  type: 'order_updated'
  orderId: OrderId
  /**
   * Partial<Omit<Order, 'id'>> — id is immutable after creation so it's excluded from patches,
   * Partial allows sparse field updates without sending the full order.
   */
  patch: Partial<Omit<Order, 'id'>>
}

/** Event indicating an order is cancelled and no longer working. */
export type OrderCancelledEvent = StreamEnvelopeMeta & {
  type: 'order_cancelled'
  orderId: OrderId
  /** Optional textual reason shown in details/audit UI. */
  reason?: string
}

/** Event indicating the order was rejected by venue/risk checks. */
export type OrderRejectedEvent = StreamEnvelopeMeta & {
  type: 'order_rejected'
  orderId: OrderId
  /** Human-readable rejection explanation from the source. */
  reason: string
}

/** Optional keepalive for connection UI; no blotter row change. */
export type HeartbeatEvent = StreamEnvelopeMeta & {
  type: 'heartbeat'
}

/**
 * Discriminated unions over generic event — lets TypeScript narrow the exact event shape in a
 * switch statement with no casting.
 */
/** Complete discriminated union of all stream events the blotter can ingest. */
export type BlotterStreamEvent =
  | OrderCreatedEvent
  | OrderUpdatedEvent
  | OrderCancelledEvent
  | OrderRejectedEvent
  | HeartbeatEvent
/** Union of all event discriminator values, useful in switches/maps. */
export type BlotterStreamEventType = BlotterStreamEvent['type']

/**
 * Type guard purpose — validates unknown runtime data before trusting it as a typed event,
 * protects the stream consumer.
 */
export function isBlotterStreamEvent(value: unknown): value is BlotterStreamEvent {
  if (typeof value !== 'object' || value === null) return false
  const o = value as Record<string, unknown>
  if (typeof o.type !== 'string') return false
  switch (o.type as BlotterStreamEventType) {
    case 'order_created':
      return typeof o.order === 'object' && o.order !== null
    case 'order_updated':
      return typeof o.orderId === 'string' && typeof o.patch === 'object' && o.patch !== null
    case 'order_cancelled':
    case 'order_rejected':
      return typeof o.orderId === 'string'
    case 'heartbeat':
      return true
    default:
      return false
  }
}

