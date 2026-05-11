import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { aiModelSchema, tradingModeSchema } from '../../../shared/crypto/types.js'
import { fetchCandles, fetchTicker, getDetectedExchangeName } from '../crypto/exchange.js'
import { computeIndicators } from '../crypto/indicators.js'
import { getPaperPortfolio, resetPaperPortfolio } from '../crypto/paperEngine.js'
import {
  getAgentState,
  getAvailableModels,
  getSettings,
  startAgent,
  stopAgent,
  updateSettings,
} from '../ai/tradingAgent.js'

export const cryptoRouter = Router()

const VALID_SYMBOLS = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT',
  'XRP/USDT', 'ADA/USDT', 'DOGE/USDT', 'AVAX/USDT',
  'DOT/USDT', 'LINK/USDT', 'MATIC/USDT', 'LTC/USDT',
]

function validateSymbol(raw: string): string {
  const symbol = decodeURIComponent(raw).toUpperCase().trim()
  if (!symbol.includes('/') || symbol.length > 20) {
    throw new Error(`Invalid symbol format: ${symbol}. Use format like BTC/USDT`)
  }
  return symbol
}

// ── Market data ─────────────────────────────────────────────────────────────

cryptoRouter.get('/price/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = validateSymbol(req.params.symbol as string)
    const ticker = await fetchTicker(symbol)
    res.json(ticker)
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

cryptoRouter.get('/candles/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = validateSymbol(req.params.symbol as string)
    const validTimeframes = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d']
    const timeframe = validTimeframes.includes(req.query.timeframe as string)
      ? (req.query.timeframe as string)
      : '5m'
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 10), 500)
    const candles = await fetchCandles(symbol, timeframe, limit)
    res.json({ candles })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

cryptoRouter.get('/indicators/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = validateSymbol(req.params.symbol as string)
    const timeframe = (req.query.timeframe as string) || '5m'
    const candles = await fetchCandles(symbol, timeframe, 100)
    const indicators = computeIndicators(candles)
    res.json(indicators)
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

cryptoRouter.get('/symbols', (_req: Request, res: Response) => {
  res.json({ symbols: VALID_SYMBOLS, exchange: getDetectedExchangeName() })
})

// ── Portfolio ───────────────────────────────────────────────────────────────

cryptoRouter.get('/portfolio', (_req: Request, res: Response) => {
  res.json(getPaperPortfolio())
})

cryptoRouter.post('/portfolio/reset', (req: Request, res: Response) => {
  try {
    const balance = Number(req.body?.initialBalance) || 10
    if (balance < 1 || balance > 1_000_000) {
      res.status(400).json({ error: 'Initial balance must be $1–$1,000,000' })
      return
    }
    res.json(resetPaperPortfolio(balance))
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// ── Agent ───────────────────────────────────────────────────────────────────

cryptoRouter.get('/agent/state', (_req: Request, res: Response) => {
  res.json(getAgentState())
})

cryptoRouter.get('/agent/models', (_req: Request, res: Response) => {
  res.json({ available: getAvailableModels() })
})

const startSchema = z.object({
  model: aiModelSchema,
  mode: tradingModeSchema.default('paper'),
  symbol: z.string().min(3).max(20).optional(),
  initialBalance: z.number().positive().max(1_000_000).optional(),
})

cryptoRouter.post('/agent/start', async (req: Request, res: Response) => {
  try {
    const body = startSchema.parse(req.body)
    const state = await startAgent(body.model, body.mode, body.symbol, body.initialBalance)
    res.json(state)
  } catch (err) {
    const status = err instanceof z.ZodError ? 400 : 500
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

cryptoRouter.post('/agent/stop', (_req: Request, res: Response) => {
  res.json(stopAgent())
})

// ── Settings ────────────────────────────────────────────────────────────────

function maskKey(key: string | undefined): string | undefined {
  if (!key) return undefined
  return key.length > 8 ? '••••' + key.slice(-4) : '••••'
}

cryptoRouter.get('/settings', (_req: Request, res: Response) => {
  const s = getSettings()
  res.json({
    ...s,
    binanceApiKey: maskKey(s.binanceApiKey),
    binanceApiSecret: s.binanceApiSecret ? '••••' : undefined,
    anthropicApiKey: maskKey(s.anthropicApiKey),
    openaiApiKey: maskKey(s.openaiApiKey),
    deepseekApiKey: maskKey(s.deepseekApiKey),
    grokApiKey: maskKey(s.grokApiKey),
  })
})

const settingsSchema = z.object({
  maxPositionUSDT: z.number().min(1).max(100_000).optional(),
  stopLossPct: z.number().min(0.1).max(50).optional(),
  takeProfitPct: z.number().min(0.1).max(100).optional(),
  tradeIntervalMs: z.number().min(10_000).max(3_600_000).optional(),
  symbol: z.string().min(3).max(20).optional(),
  nightMode: z.boolean().optional(),
  binanceApiKey: z.string().optional(),
  binanceApiSecret: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  deepseekApiKey: z.string().optional(),
  grokApiKey: z.string().optional(),
}).strict()

cryptoRouter.post('/settings', (req: Request, res: Response) => {
  try {
    const patch = settingsSchema.parse(req.body)
    updateSettings(patch)
    const s = getSettings()
    res.json({
      ...s,
      binanceApiKey: maskKey(s.binanceApiKey),
      binanceApiSecret: s.binanceApiSecret ? '••••' : undefined,
      anthropicApiKey: maskKey(s.anthropicApiKey),
      openaiApiKey: maskKey(s.openaiApiKey),
      deepseekApiKey: maskKey(s.deepseekApiKey),
      grokApiKey: maskKey(s.grokApiKey),
    })
  } catch (err) {
    const status = err instanceof z.ZodError ? 400 : 500
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) })
  }
})
