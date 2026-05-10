import { randomUUID } from 'node:crypto'

import type { TradeBookingDefaults } from '../../../../../shared/nlp/tradeBookingAgent.js'

import { initStepLogs, type TradeBookingToolContext } from './types.js'

export function createTradeBookingContext(userText: string, defaults?: TradeBookingDefaults): TradeBookingToolContext {
  const now = new Date().toISOString()
  return {
    sessionId: randomUUID(),
    userText,
    defaults,
    steps: initStepLogs(now),
    symbolValidated: false,
    riskValidated: false,
    priceValidated: false,
  }
}
