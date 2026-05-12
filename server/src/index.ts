import './env/bootstrap.js'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import express from 'express'

import { auditRouter } from './api/auditRouter.js'
import { cryptoRouter } from './api/cryptoRouter.js'
import { nlpRouter } from './api/nlpRouter.js'
import { ordersRouter } from './api/ordersRouter.js'
import { attachBlotterStream, WS_PATH } from './realtime/blotterStream.js'
import { getSupabase, isSupabaseEnabled } from './db/supabase/client.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.resolve(__dirname, '../../dist')
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

app.use('/audit', auditRouter)
app.use('/orders', ordersRouter)
app.use('/nlp', nlpRouter)
app.use('/crypto', cryptoRouter)

// Serve built frontend if dist/ exists (monolith mode)
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
  app.get('{*path}', (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'))
  })
}

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
  const hasFrontend = fs.existsSync(DIST_DIR)
  console.log(`AlgoTrader AI server http://localhost:${PORT}`)
  if (hasFrontend) {
    console.log(`  UI   http://localhost:${PORT}/        (frontend)`)
    console.log(`  UI   http://localhost:${PORT}/agent   (trading agent)`)
  } else {
    console.log(`  [!]  Frontend not built. Run "npm run build" first, or use "npm start" from the project root.`)
  }
  console.log(`  API  http://localhost:${PORT}/crypto/price/:symbol`)
  console.log(`  API  http://localhost:${PORT}/crypto/agent/state`)
  console.log(`  API  http://localhost:${PORT}/crypto/agent/start`)
  console.log(`  API  http://localhost:${PORT}/crypto/agent/stop`)
  console.log(`  WS   ws://localhost:${PORT}${WS_PATH}`)

  // Initialize Supabase connection
  if (isSupabaseEnabled()) {
    getSupabase()
    console.log(`  DB   Supabase persistence enabled (cycles, trades, metrics stored)`)
    console.log(`  API  http://localhost:${PORT}/crypto/metrics/:symbol`)
  } else {
    console.log(`  [!]  SUPABASE_URL not set — persistence disabled. Agent still works but no history stored.`)
  }
})
