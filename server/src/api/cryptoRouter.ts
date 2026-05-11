import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { aiModelSchema, tradingModeSchema } from '../../../shared/crypto/types.js'
import { fetchCandles, fetchTicker } from '../crypto/exchange.js'
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

// ── Market data ─────────────────────────────────────────────────────────────

cryptoRouter.get('/price/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = decodeURIComponent(req.params.symbol as string)
    const ticker = await fetchTicker(symbol)
    res.json(ticker)
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

cryptoRouter.get('/candles/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = decodeURIComponent(req.params.symbol as string)
    const timeframe = (req.query.timeframe as string) || '5m'
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const candles = await fetchCandles(symbol, timeframe, limit)
    res.json({ candles })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

cryptoRouter.get('/indicators/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = decodeURIComponent(req.params.symbol as string)
    const timeframe = (req.query.timeframe as string) || '5m'
    const candles = await fetchCandles(symbol, timeframe, 100)
    const indicators = computeIndicators(candles)
    res.json(indicators)
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// ── Portfolio ───────────────────────────────────────────────────────────────

cryptoRouter.get('/portfolio', (_req: Request, res: Response) => {
  res.json(getPaperPortfolio())
})

cryptoRouter.post('/portfolio/reset', (req: Request, res: Response) => {
  const balance = Number(req.body?.initialBalance) || 10
  res.json(resetPaperPortfolio(balance))
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
  symbol: z.string().optional(),
  initialBalance: z.number().positive().optional(),
})

cryptoRouter.post('/agent/start', async (req: Request, res: Response) => {
  try {
    const body = startSchema.parse(req.body)
    const state = await startAgent(body.model, body.mode, body.symbol, body.initialBalance)
    res.json(state)
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

cryptoRouter.post('/agent/stop', (_req: Request, res: Response) => {
  res.json(stopAgent())
})

// ── Settings ────────────────────────────────────────────────────────────────

cryptoRouter.get('/settings', (_req: Request, res: Response) => {
  const s = getSettings()
  // Never return API keys to the client
  res.json({
    ...s,
    binanceApiKey: s.binanceApiKey ? '••••' + s.binanceApiKey.slice(-4) : undefined,
    binanceApiSecret: s.binanceApiSecret ? '••••' : undefined,
    anthropicApiKey: s.anthropicApiKey ? '••••' + s.anthropicApiKey.slice(-4) : undefined,
    openaiApiKey: s.openaiApiKey ? '••••' + s.openaiApiKey.slice(-4) : undefined,
    deepseekApiKey: s.deepseekApiKey ? '••••' + s.deepseekApiKey.slice(-4) : undefined,
    grokApiKey: s.grokApiKey ? '••••' + s.grokApiKey.slice(-4) : undefined,
  })
})

cryptoRouter.post('/settings', (req: Request, res: Response) => {
  try {
    const patch = req.body as Record<string, unknown>
    updateSettings(patch)
    const s = getSettings()
    res.json({
      ...s,
      binanceApiKey: s.binanceApiKey ? '••••' + s.binanceApiKey.slice(-4) : undefined,
      binanceApiSecret: s.binanceApiSecret ? '••••' : undefined,
      anthropicApiKey: s.anthropicApiKey ? '••••' + s.anthropicApiKey.slice(-4) : undefined,
      openaiApiKey: s.openaiApiKey ? '••••' + s.openaiApiKey.slice(-4) : undefined,
      deepseekApiKey: s.deepseekApiKey ? '••••' + s.deepseekApiKey.slice(-4) : undefined,
      grokApiKey: s.grokApiKey ? '••••' + s.grokApiKey.slice(-4) : undefined,
    })
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
  }
})
