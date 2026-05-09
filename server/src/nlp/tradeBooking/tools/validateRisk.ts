import { maxOrderNotionalUsd, maxOrderQuantity, referencePriceForSymbol } from './constants.js'
import type { ParsedTradeIntent } from '../../../../../shared/nlp/tradeBookingAgent.js'
import type { ToolJsonResult } from './types.js'

export function validateRiskForTrade(intent: ParsedTradeIntent): ToolJsonResult {
  const maxQ = maxOrderQuantity()
  if (intent.quantity > maxQ) {
    return {
      success: false,
      message: `Quantity ${intent.quantity} exceeds max ${maxQ} (TRADE_BOOKING_MAX_QTY).`,
    }
  }

  const orderType = intent.orderType ?? 'limit'
  const ref = referencePriceForSymbol(intent.symbol)
  const px =
    orderType === 'limit' || orderType === 'stop_limit'
      ? intent.limitPrice
      : orderType === 'stop'
        ? intent.stopPrice
        : orderType === 'market'
          ? undefined
          : intent.limitPrice

  const unitPx = px ?? ref
  if (unitPx == null || !Number.isFinite(unitPx)) {
    return {
      success: false,
      message: 'Cannot estimate notional: add an explicit price or use a listed symbol for reference notional.',
    }
  }

  const notional = intent.quantity * unitPx
  const maxN = maxOrderNotionalUsd()
  if (notional > maxN) {
    return {
      success: false,
      message: `Estimated notional ${notional.toFixed(0)} USD exceeds cap ${maxN} (TRADE_BOOKING_MAX_NOTIONAL_USD).`,
    }
  }

  return { success: true, notionalUsd: notional }
}
