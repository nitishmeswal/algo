import { getRecentCycles, getRecentTrades, getWinLossStats } from '../db/supabase/persistence.js'

export async function buildMemoryContext(
  symbol: string,
  model: string,
): Promise<string> {
  const [recentTrades, recentCycles, stats] = await Promise.all([
    getRecentTrades(symbol, 10),
    getRecentCycles(symbol, 10),
    getWinLossStats(symbol, model),
  ])

  if (recentTrades.length === 0 && recentCycles.length === 0) {
    console.log('[memory] No history found — first cycle (stateless)')
    return '' // No history yet
  }

  console.log(`[memory] Retrieved ${recentTrades.length} trades, ${recentCycles.length} cycles for ${symbol}/${model}`)

  const parts: string[] = []

  // Performance summary
  if (stats.wins + stats.losses > 0) {
    parts.push(`PERFORMANCE HISTORY (${symbol}, ${model}):
- Total trades: ${stats.wins + stats.losses}
- Win rate: ${((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1)}%
- Avg profit per win: $${stats.avgProfit.toFixed(4)}
- Avg loss per loss: $${stats.avgLoss.toFixed(4)}
- Max drawdown: ${stats.maxDrawdown.toFixed(2)}%
- Profit factor: ${stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
- Sharpe ratio: ${stats.sharpeRatio.toFixed(2)}`)
  }

  // Recent trades
  if (recentTrades.length > 0) {
    const tradeLines = recentTrades.slice(-5).map((t) => {
      const time = new Date(t.ts).toISOString().slice(11, 19)
      const pnlStr = t.pnl >= 0 ? `+$${t.pnl.toFixed(4)}` : `-$${Math.abs(t.pnl).toFixed(4)}`
      return `  ${time} ${t.side.toUpperCase()} @ $${t.price.toFixed(2)} → ${pnlStr}`
    })
    parts.push(`RECENT TRADES (last ${tradeLines.length}):
${tradeLines.join('\n')}`)
  }

  // Recent decisions for pattern awareness
  if (recentCycles.length > 0) {
    const holdStreak = recentCycles.filter((c) => c.action === 'hold').length
    const lastActions = recentCycles.slice(-5).map((c) => c.action.toUpperCase()).join(' → ')
    parts.push(`RECENT DECISIONS: ${lastActions}
- Hold decisions in last 10 cycles: ${holdStreak}/10`)

    // Detect patterns to warn about
    if (holdStreak >= 8) {
      parts.push(`WARNING: You have been HOLDING for ${holdStreak} consecutive cycles. Consider if conditions have changed enough to act.`)
    }

    // Check if recent trades were losses
    const recentLosses = recentTrades.filter((t) => t.pnl < 0).length
    if (recentLosses >= 3 && recentTrades.length >= 4) {
      parts.push(`CAUTION: ${recentLosses} of your last ${recentTrades.length} trades were losses. Be more selective and wait for stronger signals.`)
    }
  }

  if (parts.length > 0) {
    const contextSize = parts.join('\n\n').length
    console.log(`[memory] ✓ Injected ${parts.length} memory sections (${contextSize} chars) into prompt`)
    return '\n\n' + parts.join('\n\n')
  }
  return ''
}
