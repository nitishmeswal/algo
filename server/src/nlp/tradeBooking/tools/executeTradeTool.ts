import { submitOrderBodySchema } from '../../../../../shared/nlp/submitOrderBody.js'
import { insertAgentAuditLogFireAndForget } from '../../../db/repos/agentAuditRepo.js'
import { createOrderFromValidatedSubmit } from '../../../orders/createOrderFromValidatedSubmit.js'
import { openaiModel } from '../../openaiClient.js'
import { validatePriceForTrade } from './validatePrice.js'
import { validateRiskForTrade } from './validateRisk.js'
import { mergeIntentWithDefaults } from './mergeIntentWithDefaults.js'
import { parseTradeIntentFromNlp } from './parseTradeIntentFromNlp.js'
import { validateSymbolForTrade } from './validateSymbol.js'
import { orderRowToJson } from '../../../api/orderDto.js'
import type { TradeBookingToolContext, ToolJsonResult } from './types.js'
import { touchStep } from './types.js'

function sanitizeToolAuditOutput(result: ToolJsonResult): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...result }
  if ('order' in copy) delete copy.order
  return copy
}

function logAgentToolCall(ctx: TradeBookingToolContext, toolName: string, result: ToolJsonResult): void {
  const orderId =
    result.success === true && typeof result.orderId === 'string'
      ? result.orderId
      : (ctx.orderRow?.id ?? null)

  let toolInput: Record<string, unknown> | null = null
  if (toolName === 'parse_trade_intent') {
    toolInput = { userTextPreview: ctx.userText.slice(0, 4000), defaults: ctx.defaults ?? undefined }
  } else if (ctx.parsedIntent) {
    toolInput = {
      symbol: ctx.parsedIntent.symbol,
      side: ctx.parsedIntent.side,
      quantity: ctx.parsedIntent.quantity,
      orderType: ctx.parsedIntent.orderType,
    }
  }

  insertAgentAuditLogFireAndForget({
    eventType: 'agent_tool_call',
    sessionId: ctx.sessionId,
    toolName,
    toolStatus: result.success ? 'ok' : 'fail',
    toolInput: toolInput ?? undefined,
    toolOutput: sanitizeToolAuditOutput(result),
    orderId,
    modelUsed: openaiModel(),
  })
}

export async function executeTradeBookingTool(name: string, ctx: TradeBookingToolContext): Promise<ToolJsonResult> {
  switch (name) {
    case 'parse_trade_intent': {
      touchStep(ctx, name, { status: 'running' })
      const res = await parseTradeIntentFromNlp(ctx.userText)
      if (!res.ok) {
        touchStep(ctx, name, { status: 'fail', detail: res.message })
        const out: ToolJsonResult = { success: false, message: res.message, code: res.error }
        logAgentToolCall(ctx, name, out)
        return out
      }
      ctx.parsedIntent = res.intent
      touchStep(ctx, name, { status: 'ok', detail: `${res.intent.side} ${res.intent.quantity} ${res.intent.symbol}` })
      const out: ToolJsonResult = { success: true, intent: res.intent }
      logAgentToolCall(ctx, name, out)
      return out
    }
    case 'validate_symbol': {
      touchStep(ctx, name, { status: 'running' })
      if (!ctx.parsedIntent) {
        touchStep(ctx, name, { status: 'fail', detail: 'No parsed intent' })
        const out: ToolJsonResult = { success: false, message: 'parse_trade_intent must succeed first.' }
        logAgentToolCall(ctx, name, out)
        return out
      }
      const sym = validateSymbolForTrade(ctx.parsedIntent.symbol)
      if (!sym.success) {
        touchStep(ctx, name, { status: 'fail', detail: sym.message })
        logAgentToolCall(ctx, name, sym)
        return sym
      }
      ctx.symbolValidated = true
      touchStep(ctx, name, { status: 'ok', detail: String(sym.symbol) })
      logAgentToolCall(ctx, name, sym)
      return sym
    }
    case 'validate_risk': {
      touchStep(ctx, name, { status: 'running' })
      if (!ctx.parsedIntent) {
        touchStep(ctx, name, { status: 'fail', detail: 'No parsed intent' })
        const out: ToolJsonResult = { success: false, message: 'parse_trade_intent must succeed first.' }
        logAgentToolCall(ctx, name, out)
        return out
      }
      const risk = validateRiskForTrade(ctx.parsedIntent)
      if (!risk.success) {
        touchStep(ctx, name, { status: 'fail', detail: risk.message })
        logAgentToolCall(ctx, name, risk)
        return risk
      }
      ctx.riskValidated = true
      touchStep(ctx, name, { status: 'ok', detail: 'Within caps' })
      logAgentToolCall(ctx, name, risk)
      return risk
    }
    case 'validate_price': {
      touchStep(ctx, name, { status: 'running' })
      if (!ctx.parsedIntent) {
        touchStep(ctx, name, { status: 'fail', detail: 'No parsed intent' })
        const out: ToolJsonResult = { success: false, message: 'parse_trade_intent must succeed first.' }
        logAgentToolCall(ctx, name, out)
        return out
      }
      const px = validatePriceForTrade(ctx.parsedIntent)
      if (!px.success) {
        touchStep(ctx, name, { status: 'fail', detail: px.message })
        logAgentToolCall(ctx, name, px)
        return px
      }
      ctx.priceValidated = true
      touchStep(ctx, name, { status: 'ok', detail: px.message ? String(px.message) : 'OK' })
      logAgentToolCall(ctx, name, px)
      return px
    }
    case 'book_trade': {
      touchStep(ctx, name, { status: 'running' })
      if (!ctx.parsedIntent) {
        touchStep(ctx, name, { status: 'fail', detail: 'No parsed intent' })
        const out: ToolJsonResult = { success: false, message: 'parse_trade_intent must succeed first.' }
        logAgentToolCall(ctx, name, out)
        return out
      }
      if (!ctx.symbolValidated || !ctx.riskValidated || !ctx.priceValidated) {
        touchStep(ctx, name, { status: 'fail', detail: 'All validation tools must succeed before booking.' })
        const out: ToolJsonResult = {
          success: false,
          message: 'Complete validate_symbol, validate_risk, and validate_price first.',
        }
        logAgentToolCall(ctx, name, out)
        return out
      }
      const rawBody = mergeIntentWithDefaults(ctx.parsedIntent, ctx.defaults)
      const parsed = submitOrderBodySchema.safeParse(rawBody)
      if (!parsed.success) {
        const first = parsed.error.issues[0]
        const msg = first?.message ?? 'Order body validation failed'
        touchStep(ctx, name, { status: 'fail', detail: msg })
        const out: ToolJsonResult = { success: false, message: msg }
        logAgentToolCall(ctx, name, out)
        return out
      }
      try {
        const row = await createOrderFromValidatedSubmit(parsed.data)
        ctx.orderRow = row
        const dto = orderRowToJson(row)
        touchStep(ctx, name, { status: 'ok', detail: `Order ${dto.id}` })
        const out: ToolJsonResult = { success: true, orderId: dto.id, order: dto }
        logAgentToolCall(ctx, name, out)
        return out
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        touchStep(ctx, name, { status: 'fail', detail: message })
        const out: ToolJsonResult = { success: false, message }
        logAgentToolCall(ctx, name, out)
        return out
      }
    }
    default: {
      const out: ToolJsonResult = { success: false, message: `Unknown tool: ${name}` }
      logAgentToolCall(ctx, name, out)
      return out
    }
  }
}
