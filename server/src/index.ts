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

function nextSequence(seq: { n: number }): number {
  seq.n += 1
  return seq.n
}

function heartbeatPayload(seq: { n: number }) {
  return {
    type: 'heartbeat' as const,
    sequence: nextSequence(seq),
    emittedAt: new Date().toISOString(),
    source: 'live' as const,
  }
}

function orderCreatedPayload(seq: { n: number }, order: Record<string, unknown>) {
  return {
    type: 'order_created' as const,
    sequence: nextSequence(seq),
    emittedAt: new Date().toISOString(),
    source: 'live' as const,
    order,
  }
}

/** One sample `order_created` for shape smoke tests (wscat / client later). */
function sampleOrder(createdAt: string): Record<string, unknown> {
  return {
    id: 'ORD-SERVER-001',
    clientOrderId: 'cl-001',
    symbol: 'AAPL',
    side: 'buy',
    quantity: 100,
    limitPrice: 180.5,
    filledQuantity: 0,
    pnl: 0,
    status: 'new',
    timeInForce: 'day',
    venue: 'DEMO',
    account: 'PB-ALPHA',
    createdAt,
    updatedAt: createdAt,
  }
}

wss.on('connection', (ws) => {
  const seq = { n: 0 }
  const t = new Date().toISOString()

  ws.send(JSON.stringify(orderCreatedPayload(seq, sampleOrder(t))))

  const sendHeartbeat = () => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(heartbeatPayload(seq)))
    }
  }

  const timer = setInterval(sendHeartbeat, HEARTBEAT_MS)

  ws.on('close', () => {
    clearInterval(timer)
  })
})

server.listen(PORT, () => {
  console.log(`FlowDesk stream server http://localhost:${PORT}`)
  console.log(`  GET  http://localhost:${PORT}/health`)
  console.log(`  WS   ws://localhost:${PORT}${WS_PATH}`)
})
