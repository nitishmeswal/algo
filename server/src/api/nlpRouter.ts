import { Router, type Request, type Response } from 'express'

import { breachInsightRequestSchema } from '../../../shared/nlp/breachInsight.js'
import { generateBreachInsight } from '../nlp/generateBreachInsight.js'
import { parseOrderFilterFromNlp } from '../nlp/parseOrderFilterNlp.js'

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
