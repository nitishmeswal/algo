import type OpenAI from 'openai'

import type { StepLog, TradeBookingRequest, TradeBookingResponse } from '../../../../shared/nlp/tradeBookingAgent.js'
import { orderRowToJson } from '../../api/orderDto.js'
import { getOpenAIClient, openaiModel } from '../openaiClient.js'
import { executeTradeBookingTool } from './tools/executeTradeTool.js'
import { createTradeBookingContext } from './tools/tradeBookingContext.js'

const SYSTEM = `You are a trade-booking agent. The user describes a trade in natural language.

You MUST use the provided tools in order:
1) parse_trade_intent — extracts structured fields from the user's text.
2) validate_symbol — universe check.
3) validate_risk — quantity / notional caps.
4) validate_price — price vs reference band (market orders skip band).
5) book_trade — creates the order (only after all prior tools returned success).

Call exactly one tool per turn. If any tool returns success: false, stop calling tools and reply with one short sentence explaining the issue for the trader (do not call book_trade).

If all validations succeed, you MUST call book_trade.`

const EMPTY_PARAMS = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const

function tradeTools(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  const mk = (name: string, description: string): OpenAI.Chat.Completions.ChatCompletionTool => ({
    type: 'function',
    function: { name, description, parameters: EMPTY_PARAMS as unknown as Record<string, unknown> },
  })
  return [
    mk('parse_trade_intent', 'Parse natural language into structured trade intent JSON (server runs extraction).'),
    mk('validate_symbol', 'Verify symbol is in the tradable universe.'),
    mk('validate_risk', 'Verify quantity and notional are within risk caps.'),
    mk('validate_price', 'Verify limit/stop prices vs reference band (market: skipped).'),
    mk('book_trade', 'Insert the order after all validations passed.'),
  ]
}

export type RunTradeBookingAgentResult =
  | { ok: true; response: TradeBookingResponse }
  | { ok: false; response: TradeBookingResponse; httpStatus: number }

export type TradeBookingProgressSnapshot = { steps: StepLog[] }

function cloneSteps(steps: StepLog[]): StepLog[] {
  return steps.map((s) => ({ ...s }))
}

async function emitProgress(
  onProgress: ((snap: TradeBookingProgressSnapshot) => void | Promise<void>) | undefined,
  steps: StepLog[],
): Promise<void> {
  if (!onProgress) return
  await onProgress({ steps: cloneSteps(steps) })
}

export async function runTradeBookingAgent(
  req: TradeBookingRequest,
  options?: { onProgress?: (snap: TradeBookingProgressSnapshot) => void | Promise<void> },
): Promise<RunTradeBookingAgentResult> {
  const ctx = createTradeBookingContext(req.text, req.defaults)
  const onProgress = options?.onProgress

  const client = getOpenAIClient()
  if (!client) {
    return {
      ok: false,
      httpStatus: 503,
      response: {
        outcome: 'error',
        message: 'Set OPENAI_API_KEY in the server environment to enable trade booking.',
        steps: ctx.steps,
      },
    }
  }

  await emitProgress(onProgress, ctx.steps)

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: req.text },
  ]

  const maxTurns = 12

  for (let turn = 0; turn < maxTurns; turn++) {
    let lastFailure: { tool: string; message: string } | null = null
    let completion: OpenAI.Chat.Completions.ChatCompletion
    try {
      completion = await client.chat.completions.create({
        model: openaiModel(),
        temperature: 0.1,
        max_tokens: 1024,
        messages,
        tools: tradeTools(),
        tool_choice: 'auto',
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      await emitProgress(onProgress, ctx.steps)
      return {
        ok: false,
        httpStatus: 502,
        response: { outcome: 'error', message: `OpenAI error: ${message}`, steps: ctx.steps },
      }
    }

    const choice = completion.choices[0]?.message
    if (!choice) {
      await emitProgress(onProgress, ctx.steps)
      return {
        ok: false,
        httpStatus: 502,
        response: { outcome: 'error', message: 'OpenAI returned no choice.', steps: ctx.steps },
      }
    }

    const toolCalls = choice.tool_calls
    if (!toolCalls?.length) {
      if (ctx.orderRow) {
        break
      }
      if (ctx.parsedIntent && ctx.symbolValidated && ctx.riskValidated && ctx.priceValidated) {
        const bookResult = await executeTradeBookingTool('book_trade', ctx)
        await emitProgress(onProgress, ctx.steps)
        if (bookResult.success) {
          break
        }
        return {
          ok: true,
          response: {
            outcome: 'escalated',
            reason: String(bookResult.message ?? 'book_trade failed'),
            failedStep: 'book_trade',
            steps: ctx.steps,
          },
        }
      }
      break
    }

    messages.push(choice)

    let batchStopped = false
    for (const tc of toolCalls) {
      if (tc.type !== 'function') continue
      if (batchStopped) {
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify({ success: false, message: 'Skipped: earlier tool in this turn failed.' }),
        })
        continue
      }
      const name = tc.function.name
      const result = await executeTradeBookingTool(name, ctx)
      await emitProgress(onProgress, ctx.steps)
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      })
      if (!result.success) {
        lastFailure = { tool: name, message: String(result.message ?? 'Tool failed') }
        batchStopped = true
      }
    }

    if (lastFailure) {
      return {
        ok: true,
        response: {
          outcome: 'escalated',
          reason: lastFailure.message,
          failedStep: lastFailure.tool,
          steps: ctx.steps,
        },
      }
    }

    if (ctx.orderRow) {
      break
    }
  }

  if (ctx.orderRow) {
    return {
      ok: true,
      response: {
        outcome: 'booked',
        order: orderRowToJson(ctx.orderRow),
        steps: ctx.steps,
      },
    }
  }

  return {
    ok: true,
    response: {
      outcome: 'error',
      message: 'Agent did not complete booking. Edit the description and try again.',
      steps: ctx.steps,
    },
  }
}
