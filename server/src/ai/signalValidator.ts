import { getSupabase } from '../db/supabase/client.js'
import { persistError } from '../db/supabase/persistence.js'

/**
 * Signal Validator — checks whether BUY/SELL decisions were correct after the fact.
 *
 * After every trade, records the entry price. On subsequent cycles, checks if the
 * price moved in the predicted direction and stores a validation result.
 *
 * Validation window: 5 cycles (~5 minutes at 60s intervals).
 */

interface PendingValidation {
  tradeId: string
  symbol: string
  model: string
  side: 'buy' | 'sell'
  entryPrice: number
  confidence: number
  reasoning: string
  cycleAtEntry: number
  ts: string
}

interface ValidationResult {
  trade_id: string
  symbol: string
  model: string
  side: string
  entry_price: number
  exit_price: number
  price_change_pct: number
  signal_correct: boolean
  confidence_at_entry: number
  cycles_elapsed: number
  ts_entry: string
  ts_validated: string
}

const VALIDATION_WINDOW_CYCLES = 5
const pendingValidations: PendingValidation[] = []

// Counters for in-memory stats
let totalValidated = 0
let totalCorrect = 0

export function registerTradeForValidation(
  tradeId: string,
  symbol: string,
  model: string,
  side: 'buy' | 'sell',
  entryPrice: number,
  confidence: number,
  reasoning: string,
  cycleCount: number,
): void {
  pendingValidations.push({
    tradeId,
    symbol,
    model,
    side,
    entryPrice,
    confidence,
    reasoning,
    cycleAtEntry: cycleCount,
    ts: new Date().toISOString(),
  })
  console.log(`[validator] Registered ${side.toUpperCase()} @ $${entryPrice.toFixed(2)} for validation (${VALIDATION_WINDOW_CYCLES} cycle window)`)
}

export async function checkPendingValidations(
  currentPrice: number,
  currentCycle: number,
): Promise<void> {
  const ready = pendingValidations.filter(
    (v) => currentCycle - v.cycleAtEntry >= VALIDATION_WINDOW_CYCLES,
  )

  for (const v of ready) {
    const priceDelta = currentPrice - v.entryPrice
    const priceChangePct = (priceDelta / v.entryPrice) * 100

    // BUY is correct if price went up; SELL is correct if price went down
    const signalCorrect = v.side === 'buy' ? priceDelta > 0 : priceDelta < 0

    totalValidated++
    if (signalCorrect) totalCorrect++

    const result: ValidationResult = {
      trade_id: v.tradeId,
      symbol: v.symbol,
      model: v.model,
      side: v.side,
      entry_price: v.entryPrice,
      exit_price: currentPrice,
      price_change_pct: priceChangePct,
      signal_correct: signalCorrect,
      confidence_at_entry: v.confidence,
      cycles_elapsed: currentCycle - v.cycleAtEntry,
      ts_entry: v.ts,
      ts_validated: new Date().toISOString(),
    }

    const icon = signalCorrect ? '✓' : '✗'
    const direction = priceChangePct >= 0 ? '+' : ''
    console.log(
      `[validator] ${icon} ${v.side.toUpperCase()} signal ${signalCorrect ? 'CORRECT' : 'WRONG'} — ` +
      `entry $${v.entryPrice.toFixed(2)} → $${currentPrice.toFixed(2)} (${direction}${priceChangePct.toFixed(3)}%) | ` +
      `confidence was ${v.confidence}% | accuracy: ${totalCorrect}/${totalValidated} (${((totalCorrect / totalValidated) * 100).toFixed(1)}%)`,
    )

    await persistValidation(result)

    // Remove from pending
    const idx = pendingValidations.indexOf(v)
    if (idx >= 0) pendingValidations.splice(idx, 1)
  }
}

async function persistValidation(result: ValidationResult): Promise<void> {
  const sb = getSupabase()
  if (!sb) return

  const { error } = await sb.from('signal_validations').insert(result)
  if (error) {
    // Table might not exist yet — log but don't crash
    if (error.message.includes('relation') || error.message.includes('does not exist')) {
      console.warn('[validator] signal_validations table not found — run migration 002')
    } else {
      console.warn('[validator] ✗ validation persist failed:', error.message)
    }
    persistError({
      ts: new Date().toISOString(),
      symbol: result.symbol,
      model: result.model,
      error_type: 'validation_persist',
      error_message: error.message,
      cycle_count: result.cycles_elapsed,
    }).catch(() => {})
  } else {
    console.log(`[supabase] ✓ signal validation persisted — ${result.side} ${result.signal_correct ? 'correct' : 'wrong'}`)
  }
}

export function getValidationStats(): {
  totalValidated: number
  totalCorrect: number
  accuracyPct: number
  pendingCount: number
} {
  return {
    totalValidated,
    totalCorrect,
    accuracyPct: totalValidated > 0 ? (totalCorrect / totalValidated) * 100 : 0,
    pendingCount: pendingValidations.length,
  }
}

export async function getValidationHistory(
  symbol: string,
  limit = 50,
): Promise<ValidationResult[]> {
  const sb = getSupabase()
  if (!sb) return []

  const { data, error } = await sb
    .from('signal_validations')
    .select('*')
    .eq('symbol', symbol)
    .order('ts_validated', { ascending: false })
    .limit(limit)

  if (error) return []
  return (data ?? []).reverse() as ValidationResult[]
}
