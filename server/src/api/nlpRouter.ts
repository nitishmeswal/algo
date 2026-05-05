import { Router, type Request, type Response } from 'express'

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
