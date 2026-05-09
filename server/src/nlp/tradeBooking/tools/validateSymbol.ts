import { ALLOWED_TRADE_SYMBOLS, normalizeSymbol } from './constants.js'
import type { ToolJsonResult } from './types.js'

export function validateSymbolForTrade(symbol: string): ToolJsonResult {
  const s = normalizeSymbol(symbol)
  if (!ALLOWED_TRADE_SYMBOLS.includes(s as (typeof ALLOWED_TRADE_SYMBOLS)[number])) {
    return {
      success: false,
      message: `Symbol ${s} is not in the tradable universe (${ALLOWED_TRADE_SYMBOLS.join(', ')}).`,
    }
  }
  return { success: true, symbol: s }
}
