import type { ParsedTradeIntent, TradeBookingDefaults } from '../../../../../shared/nlp/tradeBookingAgent.js'

/** Build POST /orders body fields from parsed intent + request defaults (before `submitOrderBodySchema`). */
export function mergeIntentWithDefaults(intent: ParsedTradeIntent, defaults?: TradeBookingDefaults): Record<string, unknown> {
  const orderType = intent.orderType ?? 'limit'
  const timeInForce = intent.timeInForce ?? defaults?.timeInForce ?? 'day'
  return {
    symbol: intent.symbol.trim().toUpperCase(),
    side: intent.side,
    quantity: intent.quantity,
    orderType,
    limitPrice: intent.limitPrice,
    stopPrice: intent.stopPrice,
    timeInForce,
    expireAt: intent.expireAt,
    venue: intent.venue ?? defaults?.venue,
    account: intent.account ?? defaults?.account,
    counterparty: intent.counterparty ?? defaults?.counterparty,
    strategyTag: intent.strategyTag,
    displayQuantity: intent.displayQuantity,
  }
}
