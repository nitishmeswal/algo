import type { ParsedTradeIntent, StepLog, TradeBookingDefaults } from '../../../../../shared/nlp/tradeBookingAgent.js'
import type { OrderRow } from '../../../db/models.js'

export type ToolJsonResult = Record<string, unknown> & {
  success: boolean
  message?: string
}

export type TradeBookingToolContext = {
  /** Correlates tool calls + final decision for one agent run. */
  sessionId: string
  userText: string
  defaults?: TradeBookingDefaults
  steps: StepLog[]
  parsedIntent?: ParsedTradeIntent
  orderRow?: OrderRow
  symbolValidated: boolean
  riskValidated: boolean
  priceValidated: boolean
}

export function initStepLogs(now: string): StepLog[] {
  const tools = [
    'parse_trade_intent',
    'validate_symbol',
    'validate_risk',
    'validate_price',
    'book_trade',
  ] as const
  return tools.map((tool, i) => ({
    id: (i + 1) as 1 | 2 | 3 | 4 | 5,
    tool,
    status: 'pending' as const,
    at: now,
  }))
}

export function stepIndexForTool(name: string): number {
  const map: Record<string, number> = {
    parse_trade_intent: 0,
    validate_symbol: 1,
    validate_risk: 2,
    validate_price: 3,
    book_trade: 4,
  }
  return map[name] ?? -1
}

export function touchStep(ctx: TradeBookingToolContext, toolName: string, patch: Partial<Pick<StepLog, 'status' | 'detail'>>): void {
  const i = stepIndexForTool(toolName)
  if (i < 0 || i >= ctx.steps.length) return
  const at = new Date().toISOString()
  const cur = ctx.steps[i]
  if (!cur) return
  ctx.steps[i] = {
    ...cur,
    ...patch,
    at,
  }
}
