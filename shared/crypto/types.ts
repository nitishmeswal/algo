import { z } from 'zod'

// ── Candle / OHLCV ──────────────────────────────────────────────────────────
export const candleSchema = z.object({
  ts: z.number(),
  o: z.number(),
  h: z.number(),
  l: z.number(),
  c: z.number(),
  v: z.number(),
})
export type Candle = z.infer<typeof candleSchema>

// ── Ticker ──────────────────────────────────────────────────────────────────
export const tickerSchema = z.object({
  symbol: z.string(),
  price: z.number(),
  change24h: z.number(),
  high24h: z.number(),
  low24h: z.number(),
  volume24h: z.number(),
  ts: z.number(),
})
export type Ticker = z.infer<typeof tickerSchema>

// ── Trade ───────────────────────────────────────────────────────────────────
export const tradeSideSchema = z.enum(['buy', 'sell'])
export type TradeSide = z.infer<typeof tradeSideSchema>

export const tradeRecordSchema = z.object({
  id: z.string(),
  ts: z.number(),
  symbol: z.string(),
  side: tradeSideSchema,
  price: z.number(),
  quantity: z.number(),
  cost: z.number(),
  fee: z.number(),
  pnl: z.number().optional(),
  model: z.string(),
  reasoning: z.string(),
  paper: z.boolean(),
})
export type TradeRecord = z.infer<typeof tradeRecordSchema>

// ── Portfolio ───────────────────────────────────────────────────────────────
export const positionSchema = z.object({
  symbol: z.string(),
  quantity: z.number(),
  avgEntryPrice: z.number(),
  currentPrice: z.number(),
  unrealizedPnl: z.number(),
  side: tradeSideSchema,
})
export type Position = z.infer<typeof positionSchema>

export const portfolioSchema = z.object({
  balanceUSDT: z.number(),
  initialBalance: z.number(),
  totalPnl: z.number(),
  totalPnlPct: z.number(),
  positions: z.array(positionSchema),
  trades: z.array(tradeRecordSchema),
  winRate: z.number(),
  totalTrades: z.number(),
  wins: z.number(),
  losses: z.number(),
})
export type Portfolio = z.infer<typeof portfolioSchema>

// ── Agent Personality ────────────────────────────────────────────────────────
export const personalityIdSchema = z.enum(['guardian', 'hunter', 'sniper', 'monk', 'maverick'])
export type PersonalityId = z.infer<typeof personalityIdSchema>

export const agentInstanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  personality: personalityIdSchema,
  allocatedCapital: z.number(),
  status: z.enum(['idle', 'running', 'paused', 'error']),
  cycleCount: z.number(),
  totalPnl: z.number(),
  winRate: z.number(),
  totalTrades: z.number(),
  lastDecision: z.object({
    action: z.enum(['buy', 'sell', 'hold']),
    confidence: z.number(),
    reasoning: z.string(),
    ts: z.number(),
  }).nullable(),
})
export type AgentInstance = z.infer<typeof agentInstanceSchema>

// ── Agent state ─────────────────────────────────────────────────────────────
export const agentStatusSchema = z.enum(['idle', 'running', 'paused', 'error'])
export type AgentStatus = z.infer<typeof agentStatusSchema>

export const aiModelSchema = z.enum(['claude', 'gpt', 'deepseek', 'grok', 'ollama'])
export type AiModel = z.infer<typeof aiModelSchema>

export const tradingModeSchema = z.enum(['paper', 'live'])
export type TradingMode = z.infer<typeof tradingModeSchema>

export const agentDecisionSchema = z.object({
  action: z.enum(['buy', 'sell', 'hold']),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
  model: aiModelSchema,
  indicators: z.record(z.string(), z.number()).optional(),
  ts: z.number(),
})
export type AgentDecision = z.infer<typeof agentDecisionSchema>

export const agentStateSchema = z.object({
  status: agentStatusSchema,
  mode: tradingModeSchema,
  activeModel: aiModelSchema,
  personality: personalityIdSchema.optional(),
  symbol: z.string(),
  interval: z.string(),
  portfolio: portfolioSchema,
  lastDecision: agentDecisionSchema.nullable(),
  decisionHistory: z.array(agentDecisionSchema),
  error: z.string().nullable(),
  cycleCount: z.number(),
  startedAt: z.number().nullable(),
  agents: z.array(agentInstanceSchema).optional(),
})
export type AgentState = z.infer<typeof agentStateSchema>

// ── Settings ────────────────────────────────────────────────────────────────
export const cryptoSettingsSchema = z.object({
  binanceApiKey: z.string().optional(),
  binanceApiSecret: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  deepseekApiKey: z.string().optional(),
  grokApiKey: z.string().optional(),
  ollamaBaseUrl: z.string().optional(),
  ollamaModel: z.string().optional(),
  maxPositionUSDT: z.number().positive().default(5),
  stopLossPct: z.number().min(0.1).max(50).default(3),
  takeProfitPct: z.number().min(0.1).max(100).default(5),
  tradeIntervalMs: z.number().min(10_000).default(60_000),
  symbol: z.string().default('BTC/USDT'),
  nightMode: z.boolean().default(false),
})
export type CryptoSettings = z.infer<typeof cryptoSettingsSchema>

// ── Indicator snapshot ──────────────────────────────────────────────────────
export const indicatorSnapshotSchema = z.object({
  rsi14: z.number().nullable(),
  sma20: z.number().nullable(),
  ema12: z.number().nullable(),
  ema26: z.number().nullable(),
  macdLine: z.number().nullable(),
  macdSignal: z.number().nullable(),
  macdHist: z.number().nullable(),
  bollingerUpper: z.number().nullable(),
  bollingerMiddle: z.number().nullable(),
  bollingerLower: z.number().nullable(),
  atr14: z.number().nullable(),
  volumeSma20: z.number().nullable(),
  currentVolume: z.number().nullable(),
})
export type IndicatorSnapshot = z.infer<typeof indicatorSnapshotSchema>
