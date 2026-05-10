import './env/bootstrap.js'
import http from 'node:http'

import express from 'express'

import { nlpRouter } from './api/nlpRouter.js'
import { ordersRouter } from './api/ordersRouter.js'
import { attachBlotterStream, WS_PATH } from './realtime/blotterStream.js'

const PORT = Number(process.env.PORT) || 8000

const app = express()

app.use(express.json())

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

app.use('/orders', ordersRouter)
app.use('/nlp', nlpRouter)

app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express error arity
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[api]', err)
    res.status(500).json({ error: 'internal_error', message: 'Request failed' })
  },
)

const server = http.createServer(app)
attachBlotterStream(server)

server.listen(PORT, () => {
  console.log(`FlowDesk stream server http://localhost:${PORT}`)
  console.log(`  GET  http://localhost:${PORT}/health`)
  console.log(`  GET  http://localhost:${PORT}/orders`)
  console.log(`  POST http://localhost:${PORT}/orders`)
  console.log(`  GET  http://localhost:${PORT}/orders/:id`)
  console.log(`  GET  http://localhost:${PORT}/orders/:id/audit`)
  console.log(`  POST http://localhost:${PORT}/nlp/parse-order-filter`)
  console.log(`  POST http://localhost:${PORT}/nlp/breach-insight`)
  console.log(`  POST http://localhost:${PORT}/nlp/trade-booking`)
  console.log(`  POST http://localhost:${PORT}/nlp/trade-booking/stream`)
  console.log(`  WS   ws://localhost:${PORT}${WS_PATH}`)
})
