import http from 'node:http'
import express from 'express'
import { WebSocket, WebSocketServer } from 'ws'

/** Must match client `BlotterStreamEvent` envelope — see client/src/features/blotter/types.ts */
const WS_PATH = '/blotter-stream'
const HEARTBEAT_MS = 4_000

const PORT = Number(process.env.PORT) || 8000

const app = express()

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true })
})

/** Plain HTTP GET hits this path in the browser — WebSocket uses the same path with `ws:` / upgrade. */
app.get(WS_PATH, (_req, res) => {
  res.status(200).json({
    ok: true,
    message: 'Use a WebSocket client on this path (not HTTP GET).',
    websocketUrl: `ws://127.0.0.1:${PORT}${WS_PATH}`,
  })
})

const server = http.createServer(app)

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

const STREAM_TICK_MS = 600
const SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA']
const ACCOUNTS = ['PB-ALPHA', 'PB-BETA', 'FUND-01', 'HEDGE-A']
const COUNTERPARTIES = ['NMR-US', 'GSCO', 'JPM-PB', 'MS-OTC', 'INTERNAL']
const VENUES = ['MOCK', 'MOCK_ALT']

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
  orderCounter: number
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

function createClientOrderId(n: number): string {
  return `cl-${String(n).padStart(4, '0')}`
}

function createOrderId(n: number): string {
  return `ORD-SERVER-${String(n).padStart(4, '0')}`
}

function generateMockOrder(state: ConnectionState): OrderLike {
  state.orderCounter += 1
  const now = isoNow()
  const quantity = randInt(1, 50) * 100
  const limitPrice = Math.round((20 + Math.random() * 400) * 100) / 100
  return {
    id: createOrderId(state.orderCounter),
    clientOrderId: createClientOrderId(state.orderCounter),
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
  const order = generateMockOrder(state)
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

function nextMockEvent(state: ConnectionState) {
  const r = Math.random()
  if (r < 0.08) return heartbeatPayload(state)
  if (state.live.size === 0 || r < 0.42) return emitCreated(state)
  if (r < 0.78) return emitUpdated(state)
  if (r < 0.9) return emitRejected(state)
  if (r < 0.96) return emitCancelled(state)
  return emitUpdated(state)
}

wss.on('connection', (ws) => {
  const state: ConnectionState = { seq: 0, orderCounter: 0, live: new Map() }

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(emitCreated(state)))
  }

  const timer = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify(nextMockEvent(state)))
  }, STREAM_TICK_MS)

  const heartbeatTimer = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify(heartbeatPayload(state)))
  }, HEARTBEAT_MS)

  ws.on('close', () => {
    clearInterval(timer)
    clearInterval(heartbeatTimer)
    state.live.clear()
  })
})

server.listen(PORT, () => {
  console.log(`FlowDesk stream server http://localhost:${PORT}`)
  console.log(`  GET  http://localhost:${PORT}/health`)
  console.log(`  WS   ws://localhost:${PORT}${WS_PATH}`)
})
