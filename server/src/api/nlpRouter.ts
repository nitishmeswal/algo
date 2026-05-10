import { Router, type Request, type Response } from 'express'

import { breachInsightRequestSchema } from '../../../shared/nlp/breachInsight.js'
import { tradeBookingRequestSchema } from '../../../shared/nlp/tradeBookingAgent.js'
import { generateBreachInsight } from '../nlp/generateBreachInsight.js'
import { getOpenAIClient } from '../nlp/openaiClient.js'
import { parseOrderFilterFromNlp } from '../nlp/parseOrderFilterNlp.js'
import { runTradeBookingAgent } from '../nlp/tradeBooking/runTradeBookingAgent.js'

export const nlpRouter = Router()

nlpRouter.post('/parse-order-filter', async (req: Request, res: Response) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : ''
  const result = await parseOrderFilterFromNlp(text)

  // #TODO: remove nested ternaries
  if (!result.ok) {
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

  res.status(200).json({ filter: result.filter })
})

nlpRouter.post('/breach-insight', async (req: Request, res: Response) => {
  const body = breachInsightRequestSchema.safeParse(req.body)
  if (!body.success) {
    res.status(400).json({
      error: 'invalid_request',
      message: 'Invalid breach insight payload.',
      zodIssues: body.error.flatten(),
    })
    return
  }

  const result = await generateBreachInsight(body.data)
  if (!result.ok) {
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
