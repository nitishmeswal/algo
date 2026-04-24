/**
 * What is it simulating? A real-time stream of order events from a backend.
 * How does it emit events? setInterval calling a callback with a randomly generated BlotterStreamEvent.
 * Why does it use the same types as the real stream? So the store and table work identically in production.
 * How would you swap it for a real WebSocket? Replace the adapter, nothing else changes.
 */
import { createClientOrderId, createOrderId } from '../ids'
import {
  type BlotterStreamEvent,
  type Order,
  type OrderId,
  streamSequence,
} from '../types'

export type MockBlotterStreamOptions = {
  onEvent: (event: BlotterStreamEvent) => void
  intervalMs?: number
  seed?: number
  /** Stop emitting after this many events (default 100). */
  maxEvents?: number
}

export type MockBlotterStreamHandle = {
  start: () => void
  stop: () => void
  isRunning: () => boolean
}

const SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA'] as const

const MOCK_ACCOUNTS = ['PB-ALPHA', 'PB-BETA', 'FUND-01', 'HEDGE-A'] as const
const MOCK_COUNTERPARTIES = ['NMR-US', 'GSCO', 'JPM-PB', 'MS-OTC', 'INTERNAL'] as const

function isoNow(): string {
  return new Date().toISOString()
}

function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(48271, s) % 0x7fffffff) >>> 0
    return s / 0x7fffffff
  }
}

function pickSymbol(rnd: () => number): string {
  return SYMBOLS[Math.floor(rnd() * SYMBOLS.length)]!
}

function buildOrder(rnd: () => number, id: OrderId): Order {
  const t = isoNow()
  const quantity = (Math.floor(rnd() * 50) + 1) * 100
  const limitPrice = Math.round((rnd() * 400 + 20) * 100) / 100
  return {
    id,
    clientOrderId: createClientOrderId(rnd),
    symbol: pickSymbol(rnd),
    side: rnd() > 0.5 ? 'buy' : 'sell',
    quantity,
    limitPrice,
    filledQuantity: 0,
    pnl: 0,
    status: rnd() > 0.15 ? 'new' : 'pending_new',
    timeInForce: rnd() > 0.7 ? 'gtc' : 'day',
    venue: 'MOCK',
    account: MOCK_ACCOUNTS[Math.floor(rnd() * MOCK_ACCOUNTS.length)],
    counterparty: MOCK_COUNTERPARTIES[Math.floor(rnd() * MOCK_COUNTERPARTIES.length)],
    createdAt: t,
    updatedAt: t,
  }
}

type EmitterState = {
  seq: number
  orderCounter: { n: number }
  live: Map<OrderId, Order>
  rnd: () => number
}

function meta(state: EmitterState) {
  state.seq += 1
  return {
    sequence: streamSequence(state.seq),
    emittedAt: isoNow(),
    source: 'mock' as const,
  }
}

function emitHeartbeat(state: EmitterState, onEvent: (e: BlotterStreamEvent) => void) {
  onEvent({
    ...meta(state),
    type: 'heartbeat',
  })
}

function emitCreated(state: EmitterState, onEvent: (e: BlotterStreamEvent) => void) {
  state.orderCounter.n += 1
  const id = createOrderId(state.rnd)
  const order = buildOrder(state.rnd, id)
  state.live.set(id, order)
  onEvent({
    ...meta(state),
    type: 'order_created',
    order,
  })
}

function pickLiveId(state: EmitterState): OrderId | undefined {
  if (state.live.size === 0) return undefined
  const keys = [...state.live.keys()]
  return keys[Math.floor(state.rnd() * keys.length)]
}

function emitUpdated(state: EmitterState, onEvent: (e: BlotterStreamEvent) => void) {
  const id = pickLiveId(state)
  if (!id) {
    emitCreated(state, onEvent)
    return
  }

  const current = state.live.get(id)!
  const t = isoNow()

  if (current.status === 'pending_new' || current.status === 'new') {
    const fillPortion = state.rnd()
    if (fillPortion < 0.55) {
      const fillQty = Math.min(
        current.quantity,
        Math.max(0, Math.floor(current.quantity * (0.2 + state.rnd() * 0.8))),
      )
      const nextFilled = Math.min(current.quantity, current.filledQuantity + fillQty)
      const limitRef = current.limitPrice ?? 100
      const slip = 1 + (state.rnd() - 0.5) * 0.008
      const avgPx = Math.round(limitRef * slip * 100) / 100
      const pnl =
        nextFilled > 0
          ? Math.round(
              (current.side === 'buy' ? limitRef - avgPx : avgPx - limitRef) * nextFilled * 100,
            ) / 100
          : 0
      const patch: Partial<Omit<Order, 'id'>> = {
        filledQuantity: nextFilled,
        averageFillPrice: avgPx,
        pnl,
        updatedAt: t,
        status:
          nextFilled >= current.quantity
            ? 'filled'
            : nextFilled > 0
              ? 'partially_filled'
              : current.status === 'pending_new'
                ? 'new'
                : current.status,
      }
      state.live.set(id, { ...current, ...patch })
      onEvent({ ...meta(state), type: 'order_updated', orderId: id, patch })
      return
    }
  }

  if (current.status !== 'filled' && current.status !== 'cancelled' && current.status !== 'rejected') {
    if (state.rnd() < 0.35) {
      state.live.delete(id)
      onEvent({ ...meta(state), type: 'order_cancelled', orderId: id, reason: 'User requested' })
      return
    }
  }

  const patch: Partial<Omit<Order, 'id'>> = {
    updatedAt: t,
    venue: state.rnd() > 0.5 ? 'MOCK_ALT' : current.venue,
  }

  // Reprice working orders frequently so limit-price flash behavior is visible.
  if (
    typeof current.limitPrice === 'number' &&
    current.status !== 'filled' &&
    current.status !== 'cancelled' &&
    current.status !== 'rejected' &&
    state.rnd() < 0.7
  ) {
    const pctMove = 0.001 + state.rnd() * 0.007
    const direction = state.rnd() > 0.5 ? 1 : -1
    const repriced = Math.max(0.01, current.limitPrice * (1 + direction * pctMove))
    patch.limitPrice = Math.round(repriced * 100) / 100
  }

  state.live.set(id, { ...current, ...patch })
  onEvent({ ...meta(state), type: 'order_updated', orderId: id, patch })
}

function emitRejected(state: EmitterState, onEvent: (e: BlotterStreamEvent) => void) {
  const id = pickLiveId(state)
  if (!id) {
    emitCreated(state, onEvent)
    return
  }
  const current = state.live.get(id)!
  if (current.status !== 'pending_new' && current.status !== 'new') {
    emitUpdated(state, onEvent)
    return
  }
  state.live.delete(id)
  onEvent({
    ...meta(state),
    type: 'order_rejected',
    orderId: id,
    reason: 'Risk check failed (mock)',
  })
}

export function createMockBlotterStream(options: MockBlotterStreamOptions): MockBlotterStreamHandle {
  /** Default 350ms — faster ticks flood dev React (Performance.measure / render logging) and can OOM the tab. */
  const { onEvent, intervalMs = 350, seed, maxEvents = 50 } = options
  const rnd = seed !== undefined ? createSeededRandom(seed) : () => Math.random()

  const state: EmitterState = {
    seq: 0,
    orderCounter: { n: 0 },
    live: new Map(),
    rnd,
  }

  let timer: ReturnType<typeof setInterval> | undefined
  let emitted = 0

  const dispatch = (event: BlotterStreamEvent) => {
    if (emitted >= maxEvents) return
    emitted += 1
    onEvent(event)
    if (emitted >= maxEvents && timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
  }

  function tick() {
    if (emitted >= maxEvents) {
      if (timer !== undefined) {
        clearInterval(timer)
        timer = undefined
      }
      return
    }
    const r = state.rnd()
    if (r < 0.08) {
      emitHeartbeat(state, dispatch)
      return
    }
    if (state.live.size === 0 || r < 0.42) {
      emitCreated(state, dispatch)
      return
    }
    if (r < 0.78) {
      emitUpdated(state, dispatch)
      return
    }
    if (r < 0.9) {
      emitRejected(state, dispatch)
      return
    }
    emitUpdated(state, dispatch)
  }

  return {
    start: () => {
      if (timer !== undefined) return
      timer = setInterval(tick, intervalMs)
    },
    stop: () => {
      if (timer === undefined) return
      clearInterval(timer)
      timer = undefined
    },
    isRunning: () => timer !== undefined,
  }
}
