import type http from 'node:http'
import { randomUUID } from 'node:crypto'

import { WebSocket, WebSocketServer } from 'ws'

import { persistBlotterStreamEvent } from '../db/streamProjector.js'

/** Must match client `BlotterStreamEvent` envelope — see client/src/features/blotter/types.ts */
export const WS_PATH = '/blotter-stream'
const HEARTBEAT_MS = 4_000
const STREAM_TICK_MS = 600

const SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA']
const ACCOUNTS = ['PB-ALPHA', 'PB-BETA', 'FUND-01', 'HEDGE-A']
const COUNTERPARTIES = ['NMR-US', 'GSCO', 'JPM-PB', 'MS-OTC', 'INTERNAL']
const VENUES = ['MOCK', 'MOCK_ALT']

// this is an order type, just not imported from client to avoid layer boundaries
// TODO: this should be in a shared type
type OrderLike = {
  id: string
  clientOrderId: string
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  limitPrice?: number
  filledQuantity: number
  averageFillPrice?: number
  pnl: number
  status: 'pending_new' | 'new' | 'partially_filled' | 'filled' | 'cancelled' | 'rejected'
  timeInForce: 'day' | 'gtc'
  venue: string
  account: string
  counterparty: string
  createdAt: string
  updatedAt: string
}

type ConnectionState = {
  seq: number
  live: Map<string, OrderLike>
}

function isoNow(): string {
  return new Date().toISOString()
}

function randInt(min: number, maxInclusive: number): number {
  return Math.floor(Math.random() * (maxInclusive - min + 1)) + min
}

function pickOne<T>(items: readonly T[]): T {
  return items[randInt(0, items.length - 1)]!
}

function nextSequence(state: ConnectionState): number {
  state.seq += 1
  return state.seq
}

function envelope(state: ConnectionState) {
  return {
    sequence: nextSequence(state),
    emittedAt: isoNow(),
    source: 'live' as const,
  }
}

function heartbeatPayload(state: ConnectionState) {
  return {
    ...envelope(state),
    type: 'heartbeat' as const,
  }
}

function generateMockOrder(): OrderLike {
  const now = isoNow()
  const quantity = randInt(1, 50) * 100
  const limitPrice = Math.round((20 + Math.random() * 400) * 100) / 100
  return {
    // Globally unique ids so reconnects / new sockets do not collide with rows already in `orders`
    // (numeric counters reused to reuse `ORD-SERVER-0001` + UNIQUE `client_order_id` caused upserts / insert failures).
    id: `ORD-${randomUUID()}`,
    clientOrderId: `cl-${randomUUID()}`,
    symbol: pickOne(SYMBOLS),
    side: Math.random() > 0.5 ? 'buy' : 'sell',
    quantity,
    limitPrice,
    filledQuantity: 0,
    pnl: 0,
    status: Math.random() > 0.15 ? 'new' : 'pending_new',
    timeInForce: Math.random() > 0.7 ? 'gtc' : 'day',
    venue: pickOne(VENUES),
    account: pickOne(ACCOUNTS),
    counterparty: pickOne(COUNTERPARTIES),
    createdAt: now,
    updatedAt: now,
  }
}

function orderCreatedPayload(state: ConnectionState, order: OrderLike) {
  return {
    ...envelope(state),
    type: 'order_created' as const,
    order,
  }
}

function emitCreated(state: ConnectionState) {
  const order = generateMockOrder()
  state.live.set(order.id, order)
  return orderCreatedPayload(state, order)
}

function pickLiveOrder(state: ConnectionState): OrderLike | undefined {
  if (state.live.size === 0) return undefined
  return [...state.live.values()][randInt(0, state.live.size - 1)]
}

function emitCancelled(state: ConnectionState) {
  const order = pickLiveOrder(state)
  if (!order) return emitCreated(state)
  state.live.delete(order.id)
  return {
    ...envelope(state),
    type: 'order_cancelled' as const,
    orderId: order.id,
    reason: 'User requested (mock)',
  }
}

function emitRejected(state: ConnectionState) {
  const order = pickLiveOrder(state)
  if (!order) return emitCreated(state)
  if (order.status !== 'new' && order.status !== 'pending_new') return emitUpdated(state)
  state.live.delete(order.id)
  return {
    ...envelope(state),
    type: 'order_rejected' as const,
    orderId: order.id,
    reason: 'Risk check failed (mock)',
  }
}

function emitUpdated(state: ConnectionState) {
  const current = pickLiveOrder(state)
  if (!current) return emitCreated(state)

  const now = isoNow()
  const patch: Partial<Omit<OrderLike, 'id'>> = { updatedAt: now }
  const active = current.status !== 'filled' && current.status !== 'cancelled' && current.status !== 'rejected'

  if (active && Math.random() < 0.55) {
    const fillQty = Math.max(0, Math.floor(current.quantity * (0.2 + Math.random() * 0.8)))
    const nextFilled = Math.min(current.quantity, current.filledQuantity + fillQty)
    const limitRef = current.limitPrice ?? 100
    const avgPx = Math.round(limitRef * (1 + (Math.random() - 0.5) * 0.008) * 100) / 100
    patch.filledQuantity = nextFilled
    patch.averageFillPrice = avgPx
    patch.pnl =
      nextFilled > 0
        ? Math.round((current.side === 'buy' ? limitRef - avgPx : avgPx - limitRef) * nextFilled * 100) / 100
        : 0
    patch.status = nextFilled >= current.quantity ? 'filled' : nextFilled > 0 ? 'partially_filled' : current.status
  } else {
    patch.venue = Math.random() > 0.5 ? pickOne(VENUES) : current.venue
    if (typeof current.limitPrice === 'number' && active && Math.random() < 0.7) {
      const pctMove = 0.001 + Math.random() * 0.007
      const direction = Math.random() > 0.5 ? 1 : -1
      patch.limitPrice = Math.round(Math.max(0.01, current.limitPrice * (1 + direction * pctMove)) * 100) / 100
    }
  }

  state.live.set(current.id, { ...current, ...patch })
  return {
    ...envelope(state),
    type: 'order_updated' as const,
    orderId: current.id,
    patch,
  }
}

function sendStreamPayload(ws: WebSocket, payload: object): void {
  void persistBlotterStreamEvent(payload)
  ws.send(JSON.stringify(payload))
}

function nextMockEvent(state: ConnectionState) {
  const r = Math.random()
  if (r < 0.08) return heartbeatPayload(state)
  if (state.live.size === 0 || r < 0.42) return emitCreated(state)
  if (r < 0.78) return emitUpdated(state)
  if (r < 0.9) return emitRejected(state)
  if (r < 0.96) return emitCancelled(state)
  return emitUpdated(state)
}

export function attachBlotterStream(server: http.Server): void {
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (request, socket, head) => {
    const host = request.headers.host ?? 'localhost'
    const pathname = new URL(request.url ?? '/', `http://${host}`).pathname

    if (pathname === WS_PATH) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request)
      })
      return
    }

    socket.destroy()
  })

  wss.on('connection', (ws) => {
    const state: ConnectionState = { seq: 0, live: new Map() }

    if (ws.readyState === WebSocket.OPEN) {
      sendStreamPayload(ws, emitCreated(state))
    }

    const timer = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return
      sendStreamPayload(ws, nextMockEvent(state))
    }, STREAM_TICK_MS)

    const heartbeatTimer = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return
      sendStreamPayload(ws, heartbeatPayload(state))
    }, HEARTBEAT_MS)

    ws.on('close', () => {
      clearInterval(timer)
      clearInterval(heartbeatTimer)
      state.live.clear()
    })
  })
}
