import { priceBandHalfWidth, referencePriceForSymbol } from './constants.js'
import type { ParsedTradeIntent } from '../../../../../shared/nlp/tradeBookingAgent.js'
import type { ToolJsonResult } from './types.js'

function withinBand(price: number, ref: number): boolean {
  const w = priceBandHalfWidth()
  const lo = ref * (1 - w)
  const hi = ref * (1 + w)
  return price >= lo && price <= hi
}

export function validatePriceForTrade(intent: ParsedTradeIntent): ToolJsonResult {
  const orderType = intent.orderType ?? 'limit'
  const ref = referencePriceForSymbol(intent.symbol)
  if (ref == null) {
    return { success: false, message: 'No reference price for symbol.' }
  }

  if (orderType === 'market') {
    return { success: true, message: 'Market order: reference band check skipped.' }
  }

  if (orderType === 'limit' || orderType === 'stop_limit') {
    const lp = intent.limitPrice
    if (lp == null) {
      return { success: false, message: 'limitPrice required for limit/stop_limit before price validation.' }
    }
    if (!withinBand(lp, ref)) {
      return {
        success: false,
        message: `Limit price ${lp} is outside ±${(priceBandHalfWidth() * 100).toFixed(0)}% band around reference ${ref}.`,
      }
    }
  }

  if (orderType === 'stop' || orderType === 'stop_limit') {
    const sp = intent.stopPrice
    if (sp == null) {
      return { success: false, message: 'stopPrice required for stop/stop_limit before price validation.' }
    }
    if (!withinBand(sp, ref)) {
      return {
        success: false,
        message: `Stop price ${sp} is outside ±${(priceBandHalfWidth() * 100).toFixed(0)}% band around reference ${ref}.`,
      }
    }
  }

  return { success: true, reference: ref }
}
