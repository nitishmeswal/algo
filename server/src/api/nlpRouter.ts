import { randomUUID } from 'node:crypto'

import { Router, type Request, type Response } from 'express'

import { breachInsightRequestSchema } from '../../../shared/nlp/breachInsight.js'
import { tradeBookingRequestSchema } from '../../../shared/nlp/tradeBookingAgent.js'
import { insertAgentAuditLogFireAndForget, listAgentDecisionsRecent } from '../db/repos/agentAuditRepo.js'
import { generateBreachInsight } from '../nlp/generateBreachInsight.js'
import { getOpenAIClient, openaiModel } from '../nlp/openaiClient.js'
import { parseOrderFilterFromNlp } from '../nlp/parseOrderFilterNlp.js'
import { runTradeBookingAgent } from '../nlp/tradeBooking/runTradeBookingAgent.js'

export const nlpRouter = Router()

type TradeBookingRunHistoryItem = {
  id: string
  at: string
  sessionId: string | null
  orderId: string | null
  outcome: 'booked' | 'escalated' | 'error'
  summary: string
  detail: string
}

function tradeSummaryFromDecisionPayload(payload: unknown, decisionReason: string | null): string {
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>
    const preview = p.userTextPreview
    if (typeof preview === 'string' && preview.trim() !== '') return preview.trim()
    const steps = p.steps
    if (Array.isArray(steps)) {
      const parseStep = steps.find(
        (s) =>
          typeof s === 'object' &&
          s !== null &&
          (s as { tool?: string }).tool === 'parse_trade_intent' &&
          typeof (s as { detail?: unknown }).detail === 'string',
      ) as { detail: string } | undefined
      const d = parseStep?.detail?.trim()
      if (d) return d.length > 140 ? `${d.slice(0, 140)}…` : d
    }
  }
  if (decisionReason && decisionReason.trim() !== '') return decisionReason.trim().slice(0, 160)
  return '—'
}

function decisionToOutcome(decision: string | null): 'booked' | 'escalated' | 'error' {
  if (decision === 'booked') return 'booked'
  if (decision === 'escalated') return 'escalated'
  return 'error'
}

function runHistoryDetail(row: { decision: string | null; order_id: string | null; decision_reason: string | null }): string {
  if (row.decision === 'booked' && row.order_id) return `Order ${row.order_id}`
  const r = row.decision_reason?.trim()
  return r && r.length > 0 ? (r.length > 200 ? `${r.slice(0, 200)}…` : r) : '—'
}

nlpRouter.get('/trade-booking/history', async (_req: Request, res: Response, next) => {
  try {
    const rows = await listAgentDecisionsRecent(50)
    const runs: TradeBookingRunHistoryItem[] = rows.map((r) => ({
      id: r.id,
      at: r.created_at.toISOString(),
      sessionId: r.session_id,
      orderId: r.order_id,
      outcome: decisionToOutcome(r.decision),
      summary: tradeSummaryFromDecisionPayload(r.payload, r.decision_reason),
      detail: runHistoryDetail(r),
    }))
    res.status(200).json({ runs })
  } catch (err) {
    next(err)
  }
})

nlpRouter.post('/parse-order-filter', async (req: Request, res: Response) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : ''
  const started = Date.now()
  const result = await parseOrderFilterFromNlp(text)
  const durationMs = Date.now() - started
  const modelUsed = getOpenAIClient() ? openaiModel() : null

  // #TODO: remove nested ternaries
  if (!result.ok) {
    insertAgentAuditLogFireAndForget({
      eventType: 'nlp_filter',
      inputText: text.slice(0, 20_000),
      durationMs,
      modelUsed: modelUsed ?? undefined,
      payload: {
        error: result.error,
        message: result.message,
        ...(result.zodIssues != null ? { zodIssues: result.zodIssues } : {}),
      },
    })
    const status =
      result.error === 'empty_text'
        ? 400
        : result.error === 'openai_unconfigured'
          ? 503
          : result.error === 'validation_failed'
            ? 422
            : 502
    res.status(status).json({
      error: result.error,
      message: result.message,
      ...(result.zodIssues != null ? { zodIssues: result.zodIssues } : {}),
    })
    return
  }

  insertAgentAuditLogFireAndForget({
    eventType: 'nlp_filter',
    inputText: text.slice(0, 20_000),
    filterResult: result.filter,
    durationMs,
    modelUsed: modelUsed ?? undefined,
  })

  res.status(200).json({ filter: result.filter })
})

nlpRouter.post('/breach-insight', async (req: Request, res: Response) => {
  const body = breachInsightRequestSchema.safeParse(req.body)
  if (!body.success) {
    insertAgentAuditLogFireAndForget({
      eventType: 'breach_insight',
      payload: { phase: 'request_validation', error: 'invalid_request', zodIssues: body.error.flatten() },
    })
    res.status(400).json({
      error: 'invalid_request',
      message: 'Invalid breach insight payload.',
      zodIssues: body.error.flatten(),
    })
    return
  }

  const sessionId = randomUUID()
  const data = body.data
  const breached = data.currentPnl <= data.threshold
  if (breached) {
    insertAgentAuditLogFireAndForget({
      eventType: 'breach_detected',
      sessionId,
      breachType: 'pnl_threshold',
      breachValue: data.currentPnl,
      breachThreshold: data.threshold,
      payload: {
        topPositions: data.topPositions,
        lastAuditEvents: data.lastAuditEvents,
      },
    })
  }

  const genStarted = Date.now()
  const result = await generateBreachInsight(data)
  const genDurationMs = Date.now() - genStarted
  const modelUsed = getOpenAIClient() ? openaiModel() : null

  if (!result.ok) {
    insertAgentAuditLogFireAndForget({
      eventType: 'breach_insight',
      sessionId,
      durationMs: genDurationMs,
      modelUsed: modelUsed ?? undefined,
      payload: {
        breached,
        error: result.error,
        message: result.message,
        ...(result.zodIssues != null ? { zodIssues: result.zodIssues } : {}),
      },
    })
    const status =
      result.error === 'invalid_request'
        ? 400
        : result.error === 'openai_unconfigured'
          ? 503
          : result.error === 'validation_failed'
            ? 422
            : 502
    res.status(status).json({
      error: result.error,
      message: result.message,
      ...(result.zodIssues != null ? { zodIssues: result.zodIssues } : {}),
    })
    return
  }

  insertAgentAuditLogFireAndForget({
    eventType: 'breach_insight',
    sessionId,
    durationMs: genDurationMs,
    modelUsed: modelUsed ?? undefined,
    llmInsight: result.insight,
    payload: { breached, insightLength: result.insight.length },
  })

  res.status(200).json({ insight: result.insight })
})

nlpRouter.post('/trade-booking', async (req: Request, res: Response) => {
  const body = tradeBookingRequestSchema.safeParse(req.body)
  if (!body.success) {
    res.status(400).json({
      outcome: 'error',
      message: 'Invalid trade-booking payload.',
      zodIssues: body.error.flatten(),
    })
    return
  }

  const result = await runTradeBookingAgent(body.data)
  if (!result.ok) {
    res.status(result.httpStatus).json(result.response)
    return
  }

  res.status(200).json(result.response)
})

nlpRouter.post('/trade-booking/stream', async (req: Request, res: Response) => {
  const body = tradeBookingRequestSchema.safeParse(req.body)
  if (!body.success) {
    res.status(400).json({
      outcome: 'error',
      message: 'Invalid trade-booking payload.',
      zodIssues: body.error.flatten(),
    })
    return
  }

  if (!getOpenAIClient()) {
    res.status(503).json({
      outcome: 'error',
      message: 'Set OPENAI_API_KEY in the server environment to enable trade booking.',
    })
    return
  }

  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  const writeSse = (payload: unknown) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
  }

  try {
    const result = await runTradeBookingAgent(body.data, {
      onProgress: ({ steps }) => {
        writeSse({ type: 'progress', steps })
      },
    })
    writeSse({ type: 'done', ...result.response })
  } catch (err) {
    console.error('[nlp] trade-booking stream', err)
    writeSse({
      type: 'done',
      outcome: 'error',
      message: err instanceof Error ? err.message : 'Stream failed',
    })
  }
  res.end()
})
