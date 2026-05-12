import type { IndicatorSnapshot } from '../../../../shared/crypto/types.js'
import { getSupabase } from './client.js'

// ----- Types for DB rows -----

export interface CycleRow {
  id?: string
  ts: string
  symbol: string
  model: string
  mode: string
  price: number
  change_24h: number
  indicators: Record<string, number | null>
  prompt_tokens?: number
  raw_response?: string
  action: string
  confidence: number
  reasoning: string
  trade_executed: boolean
  trade_side?: string
  trade_amount_usdt?: number
  trade_price?: number
  pnl_after?: number
  balance_after?: number
  error?: string
  latency_ms?: number
}

export interface TradeRow {
  id?: string
  ts: string
  symbol: string
  side: string
  price: number
  quantity: number
  cost_usdt: number
  fee: number
  pnl: number
  model: string
  reasoning: string
  mode: string
  paper: boolean
  balance_after: number
  indicators_at_trade?: Record<string, number | null>
}

export interface PerformanceRow {
  id?: string
  ts: string
  symbol: string
  model: string
  mode: string
  balance_usdt: number
  total_pnl: number
  total_pnl_pct: number
  win_rate: number
  total_trades: number
  wins: number
  losses: number
  max_drawdown?: number
  sharpe_ratio?: number
  avg_profit?: number
  avg_loss?: number
  profit_factor?: number
}

export interface ErrorRow {
  id?: string
  ts: string
  symbol: string
  model: string
  error_type: string
  error_message: string
  cycle_count: number
}

// ----- Persistence Functions -----

export async function persistCycle(row: CycleRow): Promise<void> {
  const sb = getSupabase()
  if (!sb) return

  const { error } = await sb.from('cycles').insert(row)
  if (error) {
    console.warn('[supabase] ✗ cycle persist failed:', error.message)
  } else {
    console.log(`[supabase] ✓ cycle persisted — ${row.action.toUpperCase()} (${row.confidence}%) @ $${row.price.toFixed(2)} [${row.latency_ms ?? '?'}ms]`)
  }
}

export async function persistTrade(row: TradeRow): Promise<void> {
  const sb = getSupabase()
  if (!sb) return

  const { error } = await sb.from('trades').insert(row)
  if (error) {
    console.warn('[supabase] ✗ trade persist failed:', error.message)
  } else {
    console.log(`[supabase] ✓ trade persisted — ${row.side.toUpperCase()} ${row.symbol} @ $${row.price.toFixed(2)} | P&L: $${row.pnl.toFixed(4)} | balance: $${row.balance_after.toFixed(2)}`)
  }
}

export async function persistPerformance(row: PerformanceRow): Promise<void> {
  const sb = getSupabase()
  if (!sb) return

  const { error } = await sb.from('performance_snapshots').insert(row)
  if (error) {
    console.warn('[supabase] ✗ performance persist failed:', error.message)
  } else {
    console.log(`[supabase] ✓ performance snapshot — W/L: ${row.wins}/${row.losses} | WR: ${row.win_rate.toFixed(1)}% | PnL: $${row.total_pnl.toFixed(4)}`)
  }
}

export async function persistError(row: ErrorRow): Promise<void> {
  const sb = getSupabase()
  if (!sb) return

  const { error } = await sb.from('errors').insert(row)
  if (error) {
    console.warn('[supabase] ✗ error persist failed:', error.message)
  } else {
    console.log(`[supabase] ✓ error persisted — ${row.error_type}: ${row.error_message.slice(0, 80)}`)
  }
}

// ----- Memory Retrieval -----

export async function getRecentCycles(symbol: string, limit = 20): Promise<CycleRow[]> {
  const sb = getSupabase()
  if (!sb) return []

  const { data, error } = await sb
    .from('cycles')
    .select('*')
    .eq('symbol', symbol)
    .order('ts', { ascending: false })
    .limit(limit)

  if (error) {
    console.warn('[supabase] Failed to fetch recent cycles:', error.message)
    return []
  }
  return (data ?? []).reverse()
}

export async function getRecentTrades(symbol: string, limit = 20): Promise<TradeRow[]> {
  const sb = getSupabase()
  if (!sb) return []

  const { data, error } = await sb
    .from('trades')
    .select('*')
    .eq('symbol', symbol)
    .order('ts', { ascending: false })
    .limit(limit)

  if (error) {
    console.warn('[supabase] Failed to fetch recent trades:', error.message)
    return []
  }
  return (data ?? []).reverse()
}

export async function getPerformanceMetrics(symbol: string, model: string): Promise<PerformanceRow | null> {
  const sb = getSupabase()
  if (!sb) return null

  const { data, error } = await sb
    .from('performance_snapshots')
    .select('*')
    .eq('symbol', symbol)
    .eq('model', model)
    .order('ts', { ascending: false })
    .limit(1)

  if (error || !data?.length) return null
  return data[0]
}

export async function getTotalCycleCount(): Promise<number> {
  const sb = getSupabase()
  if (!sb) return 0

  const { count, error } = await sb
    .from('cycles')
    .select('*', { count: 'exact', head: true })

  if (error) return 0
  return count ?? 0
}

export async function getWinLossStats(symbol: string, model: string): Promise<{
  wins: number
  losses: number
  avgProfit: number
  avgLoss: number
  maxDrawdown: number
  profitFactor: number
  sharpeRatio: number
}> {
  const sb = getSupabase()
  if (!sb) return { wins: 0, losses: 0, avgProfit: 0, avgLoss: 0, maxDrawdown: 0, profitFactor: 0, sharpeRatio: 0 }

  const { data, error } = await sb
    .from('trades')
    .select('pnl, balance_after')
    .eq('symbol', symbol)
    .eq('model', model)
    .order('ts', { ascending: true })

  if (error || !data?.length) {
    return { wins: 0, losses: 0, avgProfit: 0, avgLoss: 0, maxDrawdown: 0, profitFactor: 0, sharpeRatio: 0 }
  }

  const profits = data.filter((t) => t.pnl > 0).map((t) => t.pnl)
  const losses = data.filter((t) => t.pnl < 0).map((t) => t.pnl)

  const avgProfit = profits.length > 0 ? profits.reduce((a, b) => a + b, 0) / profits.length : 0
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0
  const totalProfit = profits.reduce((a, b) => a + b, 0)
  const totalLoss = Math.abs(losses.reduce((a, b) => a + b, 0))
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0

  // Max drawdown from balance history
  let peak = 0
  let maxDrawdown = 0
  for (const t of data) {
    if (t.balance_after > peak) peak = t.balance_after
    const dd = peak > 0 ? ((peak - t.balance_after) / peak) * 100 : 0
    if (dd > maxDrawdown) maxDrawdown = dd
  }

  // Sharpe ratio (simplified: mean return / stddev of returns)
  const returns = data.map((t) => t.pnl)
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length
  const stddev = Math.sqrt(variance)
  const sharpeRatio = stddev > 0 ? (mean / stddev) * Math.sqrt(252) : 0 // Annualized

  return {
    wins: profits.length,
    losses: losses.length,
    avgProfit,
    avgLoss,
    maxDrawdown,
    profitFactor,
    sharpeRatio,
  }
}
