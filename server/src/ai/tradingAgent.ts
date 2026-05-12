import type {
  AgentDecision,
  AgentState,
  AiModel,
  CryptoSettings,
  IndicatorSnapshot,
  TradingMode,
} from '../../../shared/crypto/types.js'
import { fetchCandles, fetchTicker, placeOrder } from '../crypto/exchange.js'
import { computeIndicators } from '../crypto/indicators.js'
import {
  executePaperTrade,
  getPaperPortfolio,
  resetPaperPortfolio,
  updatePositionPrices,
} from '../crypto/paperEngine.js'
import { callModel, availableModels, type AdapterSettings } from './modelAdapters.js'
import { buildMemoryContext } from './memoryContext.js'
import {
  persistCycle,
  persistTrade,
  persistPerformance,
  persistError,
  type CycleRow,
  type TradeRow,
  type PerformanceRow,
} from '../db/supabase/persistence.js'
import { isSupabaseEnabled } from '../db/supabase/client.js'
import { registerTradeForValidation, checkPendingValidations } from './signalValidator.js'
import { markSessionStart, recordCycleSuccess, recordCycleError } from './sessionHealth.js'

const LLM_TIMEOUT_MS = 30_000
const MAX_CONSECUTIVE_ERRORS = 5

const TRADING_SYSTEM_PROMPT = `You are an expert cryptocurrency trading AI agent with memory of past performance. You analyze technical indicators, market context, and your own trade history to make decisions.

RULES:
1. You MUST respond with EXACTLY one JSON object — no markdown, no explanation outside the JSON.
2. Format: {"action":"buy"|"sell"|"hold","confidence":0-100,"reasoning":"...","position_size_pct":10-100,"stop_loss_pct":1-10,"take_profit_pct":2-20}
3. Be conservative — only trade when confidence > 65.
4. For BUY: look for oversold RSI (<35), price near lower Bollinger, bullish MACD crossover, high volume.
5. For SELL: look for overbought RSI (>70), price near upper Bollinger, bearish MACD crossover, take profit or stop loss.
6. For HOLD: when signals are mixed, uncertainty is high, or confidence is below threshold.
7. Never risk more than the allocated budget on a single trade.
8. You CAN add to an existing position (scale in) if signals strengthen. Use position_size_pct to control how much more to buy.
9. Factor in 24h price change and volume trends.
10. Keep reasoning under 200 characters.
11. LEARN from your performance history — if recent trades lost money, be more selective.
12. Use position_size_pct to size trades dynamically (50=half of max, 100=full max position).
13. Adjust stop_loss_pct and take_profit_pct based on volatility (ATR) — wider in volatile markets.
14. If already holding and position is profitable, consider adding more. If position is losing, be cautious about adding.

You are managing a trading portfolio. Every dollar counts. Be precise and adaptive.`

const agentState: AgentState = {
  status: 'idle',
  mode: 'paper',
  activeModel: 'claude',
  symbol: 'BTC/USDT',
  interval: '5m',
  portfolio: getPaperPortfolio(),
  lastDecision: null,
  decisionHistory: [],
  error: null,
  cycleCount: 0,
  startedAt: null,
}

let intervalHandle: ReturnType<typeof setInterval> | null = null
let cycleRunning = false
let consecutiveErrors = 0

let currentSettings: CryptoSettings = {
  maxPositionUSDT: 5,
  stopLossPct: 3,
  takeProfitPct: 5,
  tradeIntervalMs: 60_000,
  symbol: 'BTC/USDT',
  nightMode: false,
}

// Max percentage of total balance that can be in a single position
const MAX_POSITION_PCT = 50 // 50% of balance per position
const MAX_TOTAL_EXPOSURE_PCT = 80 // 80% of balance total exposure

export function getAgentState(): AgentState {
  agentState.portfolio = getPaperPortfolio()
  return { ...agentState }
}

export function getSettings(): CryptoSettings {
  return { ...currentSettings }
}

export function updateSettings(patch: Partial<CryptoSettings>): CryptoSettings {
  // Validate numeric settings
  if (patch.maxPositionUSDT !== undefined) {
    const v = Number(patch.maxPositionUSDT)
    if (isNaN(v) || v < 1 || v > 100_000) throw new Error('maxPositionUSDT must be 1–100,000')
    patch.maxPositionUSDT = v
  }
  if (patch.stopLossPct !== undefined) {
    const v = Number(patch.stopLossPct)
    if (isNaN(v) || v < 0.1 || v > 50) throw new Error('stopLossPct must be 0.1–50')
    patch.stopLossPct = v
  }
  if (patch.takeProfitPct !== undefined) {
    const v = Number(patch.takeProfitPct)
    if (isNaN(v) || v < 0.1 || v > 100) throw new Error('takeProfitPct must be 0.1–100')
    patch.takeProfitPct = v
  }
  if (patch.tradeIntervalMs !== undefined) {
    const v = Number(patch.tradeIntervalMs)
    if (isNaN(v) || v < 10_000 || v > 3_600_000) throw new Error('tradeIntervalMs must be 10s–1h')
    patch.tradeIntervalMs = v
  }
  currentSettings = { ...currentSettings, ...patch }
  if (patch.symbol) agentState.symbol = patch.symbol
  return currentSettings
}

function getAdapterSettings(): AdapterSettings {
  return {
    anthropicApiKey: currentSettings.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    openaiApiKey: currentSettings.openaiApiKey || process.env.OPENAI_API_KEY,
    deepseekApiKey: currentSettings.deepseekApiKey || process.env.DEEPSEEK_API_KEY,
    grokApiKey: currentSettings.grokApiKey || process.env.GROK_API_KEY,
    ollamaBaseUrl: currentSettings.ollamaBaseUrl || process.env.OLLAMA_BASE_URL,
    ollamaModel: currentSettings.ollamaModel || process.env.OLLAMA_MODEL,
  }
}

export function getAvailableModels(): AiModel[] {
  return availableModels(getAdapterSettings())
}

function buildMarketContext(
  symbol: string,
  price: number,
  change24h: number,
  indicators: IndicatorSnapshot,
  hasPosition: boolean,
  positionPnlPct: number,
  balanceUSDT: number,
  positionCostUSDT: number,
): string {
  const totalBalance = balanceUSDT + positionCostUSDT
  const exposurePct = totalBalance > 0 ? (positionCostUSDT / totalBalance) * 100 : 0
  const maxTradeSize = computeMaxTradeSize(balanceUSDT, positionCostUSDT, totalBalance)

  return `MARKET DATA for ${symbol}:
- Current price: $${price.toFixed(2)}
- 24h change: ${change24h.toFixed(2)}%
- RSI(14): ${indicators.rsi14?.toFixed(1) ?? 'N/A'}
- SMA(20): ${indicators.sma20?.toFixed(2) ?? 'N/A'}
- EMA(12): ${indicators.ema12?.toFixed(2) ?? 'N/A'}
- EMA(26): ${indicators.ema26?.toFixed(2) ?? 'N/A'}
- MACD line: ${indicators.macdLine?.toFixed(4) ?? 'N/A'}
- MACD signal: ${indicators.macdSignal?.toFixed(4) ?? 'N/A'}
- MACD histogram: ${indicators.macdHist?.toFixed(4) ?? 'N/A'}
- Bollinger upper: ${indicators.bollingerUpper?.toFixed(2) ?? 'N/A'}
- Bollinger middle: ${indicators.bollingerMiddle?.toFixed(2) ?? 'N/A'}
- Bollinger lower: ${indicators.bollingerLower?.toFixed(2) ?? 'N/A'}
- ATR(14): ${indicators.atr14?.toFixed(2) ?? 'N/A'}
- Volume vs avg: ${indicators.currentVolume && indicators.volumeSma20 ? ((indicators.currentVolume / indicators.volumeSma20) * 100).toFixed(0) + '%' : 'N/A'}

PORTFOLIO:
- Total portfolio value: $${totalBalance.toFixed(2)}
- Available cash: $${balanceUSDT.toFixed(2)}
- Currently holding: ${hasPosition ? 'YES' : 'NO'}${hasPosition ? `\n- Position cost: $${positionCostUSDT.toFixed(2)}` : ''}${hasPosition ? `\n- Position P&L: ${positionPnlPct.toFixed(2)}%` : ''}${hasPosition ? `\n- Current exposure: ${exposurePct.toFixed(0)}% of portfolio` : ''}
- Max trade size available: $${maxTradeSize.toFixed(2)}
- Stop loss: -${currentSettings.stopLossPct}%
- Take profit: +${currentSettings.takeProfitPct}%
${hasPosition ? '- You CAN add to position if signals are strong (scale in).' : ''}
Provide your trading decision now.`
}

function computeMaxTradeSize(
  balanceUSDT: number,
  currentExposure: number,
  totalPortfolioValue: number,
): number {
  // Limit: max single trade = maxPositionUSDT or MAX_POSITION_PCT of portfolio
  const maxFromSettings = currentSettings.maxPositionUSDT
  const maxFromPortfolioPct = totalPortfolioValue * (MAX_POSITION_PCT / 100)
  const maxFromExposureLimit = totalPortfolioValue * (MAX_TOTAL_EXPOSURE_PCT / 100) - currentExposure
  const maxFromBalance = balanceUSDT * 0.95 // keep 5% cash buffer

  return Math.max(0, Math.min(maxFromSettings, maxFromPortfolioPct, maxFromExposureLimit, maxFromBalance))
}

function callModelWithTimeout(
  model: AiModel,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  settings: AdapterSettings,
): Promise<{ text: string; model: string; tokensUsed: number }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`LLM timeout after ${LLM_TIMEOUT_MS / 1000}s — model may be overloaded`)),
      LLM_TIMEOUT_MS,
    )
    callModel(model, messages, settings)
      .then((r) => { clearTimeout(timer); resolve(r) })
      .catch((e) => { clearTimeout(timer); reject(e) })
  })
}

function parseDecisionJson(text: string): { action: 'buy' | 'sell' | 'hold'; confidence: number; reasoning: string } {
  // Strip markdown fences, leading/trailing whitespace
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  // Try to extract JSON object if surrounded by other text
  const jsonMatch = cleaned.match(/\{[\s\S]*"action"[\s\S]*\}/)
  if (jsonMatch) cleaned = jsonMatch[0]

  const parsed = JSON.parse(cleaned)

  // Validate required fields
  const action = parsed.action
  if (action !== 'buy' && action !== 'sell' && action !== 'hold') {
    throw new Error(`Invalid action: ${action}`)
  }
  const confidence = Number(parsed.confidence)
  if (isNaN(confidence)) throw new Error('Invalid confidence')

  return {
    action,
    confidence: Math.min(100, Math.max(0, confidence)),
    reasoning: String(parsed.reasoning ?? '').slice(0, 500),
  }
}

async function executeTrade(
  symbol: string,
  side: 'buy' | 'sell',
  amountUSDT: number,
  model: string,
  reasoning: string,
  confidence = 0,
) {
  let result: { price?: number; quantity?: number; fee?: number; pnl?: number } | undefined

  if (agentState.mode === 'paper') {
    const trade = await executePaperTrade(symbol, side, amountUSDT, model, reasoning)
    result = { price: trade.price, quantity: trade.quantity, fee: trade.fee, pnl: trade.pnl }
  } else {
    // Live trading
    const apiKey = currentSettings.binanceApiKey
    const secret = currentSettings.binanceApiSecret
    if (!apiKey || !secret) {
      throw new Error('Live trading requires exchange API key and secret in settings')
    }

    const ticker = await fetchTicker(symbol)
    const price = ticker.price
    const cryptoQty = (amountUSDT * 0.999) / price // 0.1% fee buffer

    console.log(`[agent] LIVE ${side.toUpperCase()}: ${symbol} — $${amountUSDT.toFixed(2)} (~${cryptoQty.toFixed(8)} @ $${price.toFixed(2)})`)
    const order = await placeOrder(apiKey, secret, symbol, side, cryptoQty)
    console.log(`[agent] LIVE order placed: ${order.id} — status: ${order.status}`)

    // Shadow-track in paper portfolio so position state, stop-loss, and take-profit work
    try {
      const shadowTrade = await executePaperTrade(symbol, side, amountUSDT, model, reasoning)
      result = { price: shadowTrade.price, quantity: shadowTrade.quantity, fee: shadowTrade.fee, pnl: shadowTrade.pnl }
    } catch (shadowErr) {
      console.warn('[agent] Paper shadow-track failed (live order was placed):', shadowErr)
      result = { price, quantity: cryptoQty, fee: amountUSDT * 0.001, pnl: 0 }
    }
  }

  // Persist trade to Supabase
  if (result) {
    const updatedPortfolio = getPaperPortfolio()
    const tradeRow: TradeRow = {
      ts: new Date().toISOString(),
      symbol,
      side,
      price: result.price ?? 0,
      quantity: result.quantity ?? 0,
      cost_usdt: amountUSDT,
      fee: result.fee ?? 0,
      pnl: result.pnl ?? 0,
      model,
      reasoning,
      mode: agentState.mode,
      paper: agentState.mode === 'paper',
      balance_after: updatedPortfolio.balanceUSDT,
    }
    persistTrade(tradeRow).catch(() => {})

    // Register for signal validation
    registerTradeForValidation(
      tradeRow.ts, symbol, model, side,
      result.price ?? 0, confidence, reasoning, agentState.cycleCount,
    )
  }

  return result
}

async function runOneCycle(): Promise<AgentDecision | null> {
  if (cycleRunning) return null
  cycleRunning = true

  try {
    const symbol = agentState.symbol
    const [ticker, candles] = await Promise.all([
      fetchTicker(symbol),
      fetchCandles(symbol, agentState.interval, 100),
    ])

    // Check pending signal validations with current price
    await checkPendingValidations(ticker.price, agentState.cycleCount).catch((e) =>
      console.warn('[validator] check failed:', e instanceof Error ? e.message : e),
    )

    const indicators = computeIndicators(candles)
    const portfolio = getPaperPortfolio()
    const position = portfolio.positions.find((p) => p.symbol === symbol)
    const hasPosition = !!position && position.quantity > 0
    const positionPnlPct = hasPosition && position
      ? ((ticker.price - position.avgEntryPrice) / position.avgEntryPrice) * 100
      : 0

    // Check stop-loss / take-profit
    if (hasPosition && position) {
      if (positionPnlPct <= -currentSettings.stopLossPct) {
        const sellAmount = position.quantity * ticker.price
        await executeTrade(
          symbol, 'sell', sellAmount, agentState.activeModel, `Stop-loss triggered at ${positionPnlPct.toFixed(2)}%`, 95,
        )
        const decision: AgentDecision = {
          action: 'sell',
          confidence: 95,
          reasoning: `Stop-loss triggered: P&L ${positionPnlPct.toFixed(2)}% exceeded -${currentSettings.stopLossPct}% threshold`,
          model: agentState.activeModel,
          indicators: flatIndicators(indicators),
          ts: Date.now(),
        }
        agentState.lastDecision = decision
        agentState.decisionHistory.push(decision)
        agentState.portfolio = getPaperPortfolio()
        console.log(`[agent] STOP-LOSS SELL — P&L: ${positionPnlPct.toFixed(2)}%`)
        consecutiveErrors = 0
        return decision
      }
      if (positionPnlPct >= currentSettings.takeProfitPct) {
        const sellAmount = position.quantity * ticker.price
        await executeTrade(
          symbol, 'sell', sellAmount, agentState.activeModel, `Take-profit triggered at ${positionPnlPct.toFixed(2)}%`, 95,
        )
        const decision: AgentDecision = {
          action: 'sell',
          confidence: 95,
          reasoning: `Take-profit triggered: P&L ${positionPnlPct.toFixed(2)}% exceeded +${currentSettings.takeProfitPct}% threshold`,
          model: agentState.activeModel,
          indicators: flatIndicators(indicators),
          ts: Date.now(),
        }
        agentState.lastDecision = decision
        agentState.decisionHistory.push(decision)
        agentState.portfolio = getPaperPortfolio()
        console.log(`[agent] TAKE-PROFIT SELL — P&L: ${positionPnlPct.toFixed(2)}%`)
        consecutiveErrors = 0
        return decision
      }
    }

    // Calculate current position exposure
    const positionCostUSDT = hasPosition && position
      ? position.quantity * position.avgEntryPrice
      : 0

    const marketContext = buildMarketContext(
      symbol, ticker.price, ticker.change24h, indicators,
      hasPosition, positionPnlPct, portfolio.balanceUSDT, positionCostUSDT,
    )

    // Build memory context from Supabase history
    const memoryContext = await buildMemoryContext(symbol, agentState.activeModel)

    const adapterSettings = getAdapterSettings()
    const cycleStart = Date.now()
    const response = await callModelWithTimeout(agentState.activeModel, [
      { role: 'system', content: TRADING_SYSTEM_PROMPT },
      { role: 'user', content: marketContext + memoryContext },
    ], adapterSettings)
    const latencyMs = Date.now() - cycleStart

    let parsed: { action: 'buy' | 'sell' | 'hold'; confidence: number; reasoning: string }
    try {
      parsed = parseDecisionJson(response.text)
    } catch {
      console.error('[agent] Failed to parse LLM response:', response.text.slice(0, 200))
      persistError({
        ts: new Date().toISOString(),
        symbol,
        model: agentState.activeModel,
        error_type: 'parse',
        error_message: `JSON parse failed: ${response.text.slice(0, 120)}`,
        cycle_count: agentState.cycleCount,
      }).catch(() => {})
      const decision: AgentDecision = {
        action: 'hold',
        confidence: 0,
        reasoning: 'Failed to parse model response — holding',
        model: agentState.activeModel,
        indicators: flatIndicators(indicators),
        ts: Date.now(),
      }
      agentState.lastDecision = decision
      agentState.decisionHistory.push(decision)
      consecutiveErrors++
      return decision
    }

    const decision: AgentDecision = {
      action: parsed.action,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      model: agentState.activeModel,
      indicators: flatIndicators(indicators),
      ts: Date.now(),
    }

    // Execute trade if confidence is high enough
    // Allow BUY even with existing position (scale in) as long as exposure limit not hit
    const maxTradeSize = computeMaxTradeSize(portfolio.balanceUSDT, positionCostUSDT, portfolio.balanceUSDT + positionCostUSDT)
    if (decision.action === 'buy' && decision.confidence > 65 && maxTradeSize >= 1) {
      const tradeAmount = Math.min(maxTradeSize, portfolio.balanceUSDT * 0.95)
      if (tradeAmount >= 1) {
        const isScaleIn = hasPosition
        try {
          await executeTrade(symbol, 'buy', tradeAmount, agentState.activeModel, decision.reasoning, decision.confidence)
          if (isScaleIn) {
            console.log(`[agent] BUY (scale-in) — +$${tradeAmount.toFixed(2)} at $${ticker.price.toFixed(2)}`)
          } else {
            console.log(`[agent] BUY executed — $${tradeAmount.toFixed(2)} at $${ticker.price.toFixed(2)}`)
          }
        } catch (err) {
          console.error('[agent] Buy failed:', err)
          decision.action = 'hold'
          decision.reasoning += ' (buy failed: ' + (err instanceof Error ? err.message : String(err)) + ')'
        }
      } else {
        decision.action = 'hold'
        decision.reasoning += ' (insufficient balance for min trade)'
      }
    } else if (decision.action === 'buy' && decision.confidence > 65 && maxTradeSize < 1) {
      decision.action = 'hold'
      decision.reasoning += ' (max exposure reached — cannot add more)'
    } else if (decision.action === 'sell' && decision.confidence > 65 && hasPosition) {
      try {
        const sellAmount = position!.quantity * ticker.price
        await executeTrade(symbol, 'sell', sellAmount, agentState.activeModel, decision.reasoning, decision.confidence)
        console.log(`[agent] SELL executed at $${ticker.price.toFixed(2)}`)
      } catch (err) {
        console.error('[agent] Sell failed:', err)
        decision.action = 'hold'
        decision.reasoning += ' (sell failed: ' + (err instanceof Error ? err.message : String(err)) + ')'
      }
    }

    agentState.lastDecision = decision
    agentState.decisionHistory.push(decision)
    if (agentState.decisionHistory.length > 200) {
      agentState.decisionHistory = agentState.decisionHistory.slice(-100)
    }
    agentState.cycleCount++
    agentState.portfolio = getPaperPortfolio()
    agentState.error = null
    consecutiveErrors = 0

    console.log(`[agent] Cycle #${agentState.cycleCount}: ${decision.action.toUpperCase()} (${decision.confidence}%) — ${decision.reasoning}`)
    recordCycleSuccess(latencyMs)

    // --- Persist to Supabase ---
    const updatedPortfolio = getPaperPortfolio()
    const cycleRow: CycleRow = {
      ts: new Date().toISOString(),
      symbol,
      model: agentState.activeModel,
      mode: agentState.mode,
      price: ticker.price,
      change_24h: ticker.change24h,
      indicators: flatIndicators(indicators),
      raw_response: response.text.slice(0, 2000),
      action: decision.action,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      trade_executed: decision.action !== 'hold' && decision.confidence > 65,
      trade_side: decision.action !== 'hold' ? decision.action : undefined,
      trade_amount_usdt: decision.action === 'buy' ? Math.min(currentSettings.maxPositionUSDT, portfolio.balanceUSDT * 0.95) : undefined,
      trade_price: ticker.price,
      pnl_after: updatedPortfolio.totalPnl,
      balance_after: updatedPortfolio.balanceUSDT,
      latency_ms: latencyMs,
    }
    persistCycle(cycleRow).catch(() => {})

    // Persist performance snapshot every 10 cycles
    if (agentState.cycleCount % 10 === 0) {
      const perfRow: PerformanceRow = {
        ts: new Date().toISOString(),
        symbol,
        model: agentState.activeModel,
        mode: agentState.mode,
        balance_usdt: updatedPortfolio.balanceUSDT,
        total_pnl: updatedPortfolio.totalPnl,
        total_pnl_pct: updatedPortfolio.totalPnlPct,
        win_rate: updatedPortfolio.winRate,
        total_trades: updatedPortfolio.totalTrades,
        wins: updatedPortfolio.wins,
        losses: updatedPortfolio.losses,
      }
      persistPerformance(perfRow).catch(() => {})
    }

    return decision
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[agent] Cycle error:', msg)
    agentState.error = msg
    consecutiveErrors++

    // Classify error with fine-grained types
    let errorType = 'runtime'
    if (msg.includes('timeout')) errorType = 'timeout'
    else if (msg.includes('parse') || msg.includes('JSON')) errorType = 'parse'
    else if (msg.includes('empty response')) errorType = 'empty_response'
    else if (msg.includes('not found') && msg.includes('model')) errorType = 'model_not_found'
    else if (msg.includes('NetworkError') || msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) errorType = 'network'
    else if (msg.includes('exchange') || msg.includes('Exchange')) errorType = 'exchange'
    else if (msg.includes('rate limit') || msg.includes('429')) errorType = 'rate_limit'
    else if (msg.includes('API key') || msg.includes('Unauthorized') || msg.includes('401')) errorType = 'auth'

    recordCycleError(errorType, msg)

    // Persist error to Supabase
    persistError({
      ts: new Date().toISOString(),
      symbol: agentState.symbol,
      model: agentState.activeModel,
      error_type: errorType,
      error_message: msg,
      cycle_count: agentState.cycleCount,
    }).catch(() => {})

    // Auto-stop if too many consecutive errors
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      console.error(`[agent] ${MAX_CONSECUTIVE_ERRORS} consecutive errors — auto-stopping agent`)
      stopAgent()
      agentState.error = `Agent auto-stopped after ${MAX_CONSECUTIVE_ERRORS} consecutive errors. Last: ${msg}`
    }
    return null
  } finally {
    cycleRunning = false
  }
}

export async function startAgent(
  model: AiModel,
  mode: TradingMode,
  symbol?: string,
  initialBalance?: number,
): Promise<AgentState> {
  if (agentState.status === 'running') {
    return getAgentState()
  }

  const models = getAvailableModels()
  if (!models.includes(model)) {
    throw new Error(`Model ${model} is not available. Configure its API key. Available: ${models.join(', ') || 'none'}`)
  }

  // Validate live trading prerequisites
  if (mode === 'live') {
    if (!currentSettings.binanceApiKey || !currentSettings.binanceApiSecret) {
      throw new Error('Live trading requires Binance API key and secret. Configure them in Settings.')
    }
  }

  if (mode === 'paper' && initialBalance) {
    resetPaperPortfolio(initialBalance)
  }

  // Auto-scale maxPositionUSDT based on portfolio balance
  const balance = initialBalance ?? getPaperPortfolio().balanceUSDT
  const autoMaxPosition = Math.max(5, Math.floor(balance * (MAX_POSITION_PCT / 100)))
  if (currentSettings.maxPositionUSDT <= 5 || currentSettings.maxPositionUSDT < autoMaxPosition) {
    currentSettings.maxPositionUSDT = autoMaxPosition
    console.log(`[agent] Auto-scaled max position to $${autoMaxPosition} (${MAX_POSITION_PCT}% of $${balance})`)
  }

  agentState.status = 'running'
  agentState.activeModel = model
  agentState.mode = mode
  agentState.error = null
  agentState.startedAt = Date.now()
  agentState.cycleCount = 0
  agentState.decisionHistory = []
  consecutiveErrors = 0
  markSessionStart()
  if (symbol) agentState.symbol = symbol
  agentState.portfolio = getPaperPortfolio()

  console.log(`[agent] Started — model=${model}, mode=${mode}, symbol=${agentState.symbol}`)

  // Run first cycle immediately
  await runOneCycle()

  // Schedule recurring cycles
  intervalHandle = setInterval(async () => {
    if (agentState.status !== 'running') return
    try {
      await updatePositionPrices()
      await runOneCycle()
    } catch (err) {
      console.error('[agent] Interval error:', err)
    }
  }, currentSettings.tradeIntervalMs)

  return getAgentState()
}

export function stopAgent(): AgentState {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
  agentState.status = 'idle'
  cycleRunning = false
  console.log('[agent] Stopped')
  return getAgentState()
}

function flatIndicators(ind: IndicatorSnapshot): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(ind)) {
    if (v != null) out[k] = v
  }
  return out
}
