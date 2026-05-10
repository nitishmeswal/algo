import { submitOrderBodySchema } from '../../../../../shared/nlp/submitOrderBody.js'
import { createOrderFromValidatedSubmit } from '../../../orders/createOrderFromValidatedSubmit.js'
import { validatePriceForTrade } from './validatePrice.js'
import { validateRiskForTrade } from './validateRisk.js'
import { mergeIntentWithDefaults } from './mergeIntentWithDefaults.js'
import { parseTradeIntentFromNlp } from './parseTradeIntentFromNlp.js'
import { validateSymbolForTrade } from './validateSymbol.js'
import { orderRowToJson } from '../../../api/orderDto.js'
import type { TradeBookingToolContext, ToolJsonResult } from './types.js'
import { touchStep } from './types.js'

export async function executeTradeBookingTool(name: string, ctx: TradeBookingToolContext): Promise<ToolJsonResult> {
  switch (name) {
    case 'parse_trade_intent': {
      touchStep(ctx, name, { status: 'running' })
      const res = await parseTradeIntentFromNlp(ctx.userText)
      if (!res.ok) {
        touchStep(ctx, name, { status: 'fail', detail: res.message })
        return { success: false, message: res.message, code: res.error }
      }
      ctx.parsedIntent = res.intent
      touchStep(ctx, name, { status: 'ok', detail: `${res.intent.side} ${res.intent.quantity} ${res.intent.symbol}` })
      return { success: true, intent: res.intent }
    }
    case 'validate_symbol': {
      touchStep(ctx, name, { status: 'running' })
      if (!ctx.parsedIntent) {
        touchStep(ctx, name, { status: 'fail', detail: 'No parsed intent' })
        return { success: false, message: 'parse_trade_intent must succeed first.' }
      }
      const sym = validateSymbolForTrade(ctx.parsedIntent.symbol)
      if (!sym.success) {
        touchStep(ctx, name, { status: 'fail', detail: sym.message })
        return sym
      }
      ctx.symbolValidated = true
      touchStep(ctx, name, { status: 'ok', detail: String(sym.symbol) })
      return sym
    }
    case 'validate_risk': {
      touchStep(ctx, name, { status: 'running' })
      if (!ctx.parsedIntent) {
        touchStep(ctx, name, { status: 'fail', detail: 'No parsed intent' })
        return { success: false, message: 'parse_trade_intent must succeed first.' }
      }
      const risk = validateRiskForTrade(ctx.parsedIntent)
      if (!risk.success) {
        touchStep(ctx, name, { status: 'fail', detail: risk.message })
        return risk
      }
      ctx.riskValidated = true
      touchStep(ctx, name, { status: 'ok', detail: 'Within caps' })
      return risk
    }
    case 'validate_price': {
      touchStep(ctx, name, { status: 'running' })
      if (!ctx.parsedIntent) {
        touchStep(ctx, name, { status: 'fail', detail: 'No parsed intent' })
        return { success: false, message: 'parse_trade_intent must succeed first.' }
      }
      const px = validatePriceForTrade(ctx.parsedIntent)
      if (!px.success) {
        touchStep(ctx, name, { status: 'fail', detail: px.message })
        return px
      }
      ctx.priceValidated = true
      touchStep(ctx, name, { status: 'ok', detail: px.message ? String(px.message) : 'OK' })
      return px
    }
    case 'book_trade': {
      touchStep(ctx, name, { status: 'running' })
      if (!ctx.parsedIntent) {
        touchStep(ctx, name, { status: 'fail', detail: 'No parsed intent' })
        return { success: false, message: 'parse_trade_intent must succeed first.' }
      }
      if (!ctx.symbolValidated || !ctx.riskValidated || !ctx.priceValidated) {
        touchStep(ctx, name, { status: 'fail', detail: 'All validation tools must succeed before booking.' })
        return { success: false, message: 'Complete validate_symbol, validate_risk, and validate_price first.' }
      }
      const rawBody = mergeIntentWithDefaults(ctx.parsedIntent, ctx.defaults)
      const parsed = submitOrderBodySchema.safeParse(rawBody)
      if (!parsed.success) {
        const first = parsed.error.issues[0]
        const msg = first?.message ?? 'Order body validation failed'
        touchStep(ctx, name, { status: 'fail', detail: msg })
        return { success: false, message: msg }
      }
      try {
        const row = await createOrderFromValidatedSubmit(parsed.data)
        ctx.orderRow = row
        const dto = orderRowToJson(row)
        touchStep(ctx, name, { status: 'ok', detail: `Order ${dto.id}` })
        return { success: true, orderId: dto.id, order: dto }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        touchStep(ctx, name, { status: 'fail', detail: message })
        return { success: false, message }
      }
    }
    default:
      return { success: false, message: `Unknown tool: ${name}` }
  }
}
