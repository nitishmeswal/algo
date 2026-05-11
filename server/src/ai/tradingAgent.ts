import type {
  AgentDecision,
  AgentState,
  AiModel,
  CryptoSettings,
  IndicatorSnapshot,
  TradingMode,
} from '../../../shared/crypto/types.js'
import { fetchCandles, fetchTicker } from '../crypto/exchange.js'
import { computeIndicators } from '../crypto/indicators.js'
import {
  executePaperTrade,
  getPaperPortfolio,
  resetPaperPortfolio,
  updatePositionPrices,
} from '../crypto/paperEngine.js'
import { callModel, availableModels, type AdapterSettings } from './modelAdapters.js'

const TRADING_SYSTEM_PROMPT = `You are an expert cryptocurrency trading agent. You analyze technical indicators and market data to make trading decisions.

RULES:
1. You MUST respond with EXACTLY one JSON object — no markdown, no explanation outside the JSON.
2. Format: {"action":"buy"|"sell"|"hold","confidence":0-100,"reasoning":"..."}
3. Be conservative — only trade when confidence > 65.
4. For BUY: look for oversold RSI (<35), price near lower Bollinger, bullish MACD crossover, high volume.
5. For SELL: look for overbought RSI (>70), price near upper Bollinger, bearish MACD crossover, take profit or stop loss.
6. For HOLD: when signals are mixed, uncertainty is high, or confidence is below threshold.
7. Never risk more than the allocated budget on a single trade.
8. Consider the current position — don't buy if already holding, suggest sell if profit target hit.
9. Factor in 24h price change and volume trends.
10. Keep reasoning under 200 characters.

You are managing a small portfolio ($5-50 range). Every dollar counts. Be precise.`

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
let currentSettings: CryptoSettings = {
  maxPositionUSDT: 5,
  stopLossPct: 3,
  takeProfitPct: 5,
  tradeIntervalMs: 60_000,
  symbol: 'BTC/USDT',
  nightMode: false,
}

export function getAgentState(): AgentState {
  agentState.portfolio = getPaperPortfolio()
  return agentState
}

export function getSettings(): CryptoSettings {
  return currentSettings
}

export function updateSettings(patch: Partial<CryptoSettings>): CryptoSettings {
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
): string {
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
- Available balance: $${balanceUSDT.toFixed(2)}
- Currently holding: ${hasPosition ? 'YES' : 'NO'}${hasPosition ? `\n- Position P&L: ${positionPnlPct.toFixed(2)}%` : ''}
- Stop loss: -${currentSettings.stopLossPct}%
- Take profit: +${currentSettings.takeProfitPct}%
- Max position size: $${currentSettings.maxPositionUSDT}

Provide your trading decision now.`
}

async function runOneCycle(): Promise<AgentDecision | null> {
  try {
    const symbol = agentState.symbol
    const [ticker, candles] = await Promise.all([
      fetchTicker(symbol),
      fetchCandles(symbol, agentState.interval, 100),
    ])

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
        const trade = await executePaperTrade(
          symbol, 'sell', sellAmount, agentState.activeModel, `Stop-loss triggered at ${positionPnlPct.toFixed(2)}%`,
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
        console.log(`[agent] STOP-LOSS SELL: ${trade.id} — P&L: ${positionPnlPct.toFixed(2)}%`)
        return decision
      }
      if (positionPnlPct >= currentSettings.takeProfitPct) {
        const sellAmount = position.quantity * ticker.price
        const trade = await executePaperTrade(
          symbol, 'sell', sellAmount, agentState.activeModel, `Take-profit triggered at ${positionPnlPct.toFixed(2)}%`,
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
        console.log(`[agent] TAKE-PROFIT SELL: ${trade.id} — P&L: ${positionPnlPct.toFixed(2)}%`)
        return decision
      }
    }

    const marketContext = buildMarketContext(
      symbol, ticker.price, ticker.change24h, indicators,
      hasPosition, positionPnlPct, portfolio.balanceUSDT,
    )

    const adapterSettings = getAdapterSettings()
    const response = await callModel(agentState.activeModel, [
      { role: 'system', content: TRADING_SYSTEM_PROMPT },
      { role: 'user', content: marketContext },
    ], adapterSettings)

    let parsed: { action: 'buy' | 'sell' | 'hold'; confidence: number; reasoning: string }
    try {
      const cleaned = response.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('[agent] Failed to parse LLM response:', response.text)
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
      return decision
    }

    const decision: AgentDecision = {
      action: parsed.action,
      confidence: Math.min(100, Math.max(0, parsed.confidence)),
      reasoning: parsed.reasoning?.slice(0, 500) ?? '',
      model: agentState.activeModel,
      indicators: flatIndicators(indicators),
      ts: Date.now(),
    }

    // Execute trade if confidence is high enough
    if (decision.action === 'buy' && decision.confidence > 65 && !hasPosition) {
      const tradeAmount = Math.min(currentSettings.maxPositionUSDT, portfolio.balanceUSDT * 0.95)
      if (tradeAmount >= 1) {
        try {
          const trade = await executePaperTrade(symbol, 'buy', tradeAmount, agentState.activeModel, decision.reasoning)
          console.log(`[agent] BUY executed: ${trade.id} — $${tradeAmount.toFixed(2)} at $${trade.price.toFixed(2)}`)
        } catch (err) {
          console.error('[agent] Buy failed:', err)
          decision.action = 'hold'
          decision.reasoning += ' (buy failed: ' + (err instanceof Error ? err.message : String(err)) + ')'
        }
      }
    } else if (decision.action === 'sell' && decision.confidence > 65 && hasPosition) {
      try {
        const sellAmount = position!.quantity * ticker.price
        const trade = await executePaperTrade(symbol, 'sell', sellAmount, agentState.activeModel, decision.reasoning)
        console.log(`[agent] SELL executed: ${trade.id} — P&L: $${(trade.pnl ?? 0).toFixed(4)}`)
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

    console.log(`[agent] Cycle #${agentState.cycleCount}: ${decision.action.toUpperCase()} (${decision.confidence}%) — ${decision.reasoning}`)
    return decision
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[agent] Cycle error:', msg)
    agentState.error = msg
    return null
  }
}

export async function startAgent(
  model: AiModel,
  mode: TradingMode,
  symbol?: string,
  initialBalance?: number,
): Promise<AgentState> {
  if (agentState.status === 'running') {
    return agentState
  }

  const models = getAvailableModels()
  if (!models.includes(model)) {
    throw new Error(`Model ${model} is not available. Configure its API key. Available: ${models.join(', ') || 'none'}`)
  }

  if (mode === 'paper' && initialBalance) {
    resetPaperPortfolio(initialBalance)
  }

  agentState.status = 'running'
  agentState.activeModel = model
  agentState.mode = mode
  agentState.error = null
  agentState.startedAt = Date.now()
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

  return agentState
}

export function stopAgent(): AgentState {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
  agentState.status = 'idle'
  console.log('[agent] Stopped')
  return agentState
}

function flatIndicators(ind: IndicatorSnapshot): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(ind)) {
    if (v != null) out[k] = v
  }
  return out
}
